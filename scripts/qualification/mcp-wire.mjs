import assert from "node:assert/strict";
import {
  args,
  required,
  entryIdentity,
  childProcess,
  availablePort,
  waitTcp,
  timeout,
  fetchRecorded,
  guard,
} from "./common.mjs";

const REVISION = "2025-11-25";
const initialize = (id = 1) => ({
  jsonrpc: "2.0",
  id,
  method: "initialize",
  params: {
    protocolVersion: REVISION,
    capabilities: {},
    clientInfo: { name: "askr-packed-qualification", version: "0.5.0" },
  },
});
const rpc = (id, method, params) => ({
  jsonrpc: "2.0",
  id,
  method,
  ...(params === undefined ? {} : { params }),
});
function envelope(message, id) {
  assert.equal(message.jsonrpc, "2.0");
  assert.equal(message.id, id);
  return message;
}
function initialized(message, name) {
  envelope(message, 1);
  assert.equal(message.result.protocolVersion, REVISION);
  assert.equal(message.result.serverInfo.name, name);
  assert.ok(message.result.capabilities.tools);
}
async function ordinaryChecks(call) {
  const list = await call(rpc(2, "tools/list"));
  envelope(list, 2);
  assert.deepEqual(
    list.result.tools.map((tool) => tool.name),
    ["greet"],
  );
  assert.equal(list.result.tools[0].inputSchema.type, "object");
  const greeting = await call(rpc(3, "tools/call", { name: "greet", arguments: { name: "Ada" } }));
  envelope(greeting, 3);
  assert.deepEqual(greeting.result.structuredContent, { greeting: "Hello, Ada!" });
  assert.deepEqual(greeting.result.content, [{ type: "text", text: "Hello, Ada!" }]);
  const resource = await call(rpc(4, "resources/read", { uri: "askr://guide" }));
  envelope(resource, 4);
  assert.equal(resource.result.contents[0].uri, "askr://guide");
  assert.equal(resource.result.contents[0].text, "Build MCP servers with Askr.");
  const invalid = await call(rpc(5, "tools/call", { name: "greet", arguments: { name: 42 } }));
  assert.equal(envelope(invalid, 5).error.code, -32602);
  const unknown = await call(rpc(6, "qualification/unknown"));
  assert.equal(envelope(unknown, 6).error.code, -32601);
  assert.deepEqual(envelope(await call(rpc(7, "ping")), 7).result, {});
}
async function stdio(stage, out) {
  const process = await childProcess(globalThis.process.execPath, ["dist/main.js", "--stdio"], {
    cwd: stage,
    out,
    label: "mcp-stdio",
  });
  const messages = [];
  const waiting = new Map();
  let buffer = "";
  let protocolFailure;
  process.child.stdout.setEncoding("utf8");
  process.child.stdout.on("data", (chunk) => {
    buffer += chunk;
    while (buffer.includes("\n")) {
      const end = buffer.indexOf("\n");
      const line = buffer.slice(0, end).replace(/\r$/, "");
      buffer = buffer.slice(end + 1);
      if (!line) continue;
      try {
        const message = JSON.parse(line);
        assert.equal(message.jsonrpc, "2.0", "stdio stdout must contain protocol only");
        messages.push(message);
        const request = waiting.get(message.id);
        if (request) {
          waiting.delete(message.id);
          request.resolve(message);
        }
      } catch (error) {
        protocolFailure = error;
        for (const request of waiting.values()) request.reject(error);
        waiting.clear();
      }
    }
  });
  process.closed.then(
    (exit) => {
      for (const request of waiting.values())
        request.reject(Error(`MCP closed before response: ${JSON.stringify(exit)}`));
      waiting.clear();
    },
    () => {},
  );
  const call = (message) => {
    if (protocolFailure) throw protocolFailure;
    const response = new Promise((resolve, reject) => waiting.set(message.id, { resolve, reject }));
    process.child.stdin.write(JSON.stringify(message) + "\n");
    return timeout(response, 8000, `stdio ${message.method}`).finally(() =>
      waiting.delete(message.id),
    );
  };
  let shutdown;
  try {
    initialized(await call(initialize()), "askr-example");
    process.child.stdin.write(
      JSON.stringify({ jsonrpc: "2.0", method: "notifications/initialized" }) + "\n",
    );
    await ordinaryChecks(call);
  } finally {
    shutdown = await process.stop(true);
  }
  assert.equal(protocolFailure, undefined);
  assert.equal(buffer.trim(), "", "stdio ended with a partial/non-newline protocol output");
  return { messages, shutdown };
}
async function http(stage, out, stateful) {
  const port = await availablePort();
  const origin = `http://127.0.0.1:${port}`;
  const process = await childProcess(
    globalThis.process.execPath,
    ["dist/main.js", ...(stateful ? ["--stateful", "--conformance"] : [])],
    {
      cwd: stage,
      out,
      label: stateful ? "mcp-http-stateful" : "mcp-http-stateless",
      env: {
        PORT: String(port),
        HOST_HEADER: `127.0.0.1:${port}`,
        MCP_ORIGIN: origin,
        MCP_RESOURCE: `${origin}/mcp`,
      },
    },
  );
  const wire = [];
  let session;
  let shutdown;
  let streamAbort;
  let reader;
  let streamPromise;
  const headers = () => ({
    origin,
    accept: "application/json, text/event-stream",
    "content-type": "application/json",
    "mcp-protocol-version": REVISION,
    ...(session ? { "mcp-session-id": session } : {}),
  });
  const request = async (path, init) => {
    const response = await fetchRecorded(origin + path, init);
    wire.push({ path, method: init?.method ?? "GET", ...response });
    return response;
  };
  const post = async (message) => {
    const response = await request("/mcp", {
      method: "POST",
      headers: headers(),
      body: JSON.stringify(message),
    });
    assert.equal(response.status, message.id === undefined ? 202 : 200);
    if (message.id !== undefined)
      assert.match(response.headers["content-type"], /application\/json/);
    return response;
  };
  try {
    await waitTcp(port, process);
    const blocked = await request("/mcp", {
      method: "POST",
      headers: {
        ...headers(),
        origin: "https://not-allowed.invalid",
      },
      body: JSON.stringify(initialize()),
    });
    assert.equal(blocked.status, 403);
    const response = await post(initialize());
    initialized(response.body, stateful ? "askr-conformance" : "askr-example");
    session = response.headers["mcp-session-id"];
    if (stateful) assert.match(session, /^[0-9a-f-]{36}$/);
    else assert.equal(session, undefined);
    await post({ jsonrpc: "2.0", method: "notifications/initialized" });
    const call = async (message) => (await post(message)).body;
    if (!stateful) {
      await ordinaryChecks(call);
      const get = await request("/mcp", { headers: { origin, accept: "text/event-stream" } });
      assert.equal(get.status, 405);
    } else {
      const list = await call(rpc(2, "tools/list"));
      assert.equal(envelope(list, 2).result.tools.length, 8);
      const resource = await call(rpc(3, "resources/read", { uri: "test://static-text" }));
      assert.equal(
        envelope(resource, 3).result.contents[0].text,
        "This is the content of the static text resource.",
      );
      streamAbort = new AbortController();
      const stream = await timeout(
        fetch(`${origin}/mcp`, {
          headers: { ...headers(), accept: "text/event-stream" },
          signal: streamAbort.signal,
        }),
        8000,
        "stateful SSE response headers",
      );
      assert.equal(stream.status, 200);
      assert.match(stream.headers.get("content-type"), /text\/event-stream/);
      reader = stream.body.getReader();
      const decoder = new TextDecoder();
      let sse = "";
      let ready;
      const connected = new Promise((resolve) => {
        ready = resolve;
      });
      streamPromise = (async () => {
        while (true) {
          const { value, done } = await reader.read();
          if (done) return sse;
          sse += decoder.decode(value, { stream: true });
          if (sse.includes("connected")) ready();
          const progress = [...sse.matchAll(/^data: ?([^\r\n]+)\r?\n/gm)]
            .map((match) => JSON.parse(match[1]))
            .filter((message) => message.method === "notifications/progress");
          if (progress.length >= 3) return { sse, progress };
        }
      })();
      streamPromise.catch(() => {});
      await timeout(connected, 8000, "stateful SSE connected comment");
      const progressResult = await call(
        rpc(4, "tools/call", {
          name: "test_tool_with_progress",
          arguments: {},
          _meta: { progressToken: "packed-wire" },
        }),
      );
      assert.equal(
        envelope(progressResult, 4).result.content[0].text,
        "Tool execution completed with progress.",
      );
      const events = await timeout(streamPromise, 8000, "stateful SSE progress");
      assert.deepEqual(
        events.progress.map((message) => message.params.progress),
        [0, 50, 100],
      );
      assert.ok(events.progress.every((message) => message.params.progressToken === "packed-wire"));
      wire.push({ transport: "SSE", ...events });
      await reader.cancel();
      reader = undefined;
      const deleted = await request("/mcp", { method: "DELETE", headers: headers() });
      assert.equal(deleted.status, 204);
      const expired = await request("/mcp", {
        headers: { ...headers(), accept: "text/event-stream" },
      });
      assert.equal(expired.status, 404);
    }
  } finally {
    streamAbort?.abort();
    await reader?.cancel().catch(() => {});
    await streamPromise?.catch(() => {});
    shutdown = await process.stop();
  }
  return { origin, wire, shutdown };
}

const options = args();
if (options.help) {
  console.log(
    "node mcp-wire.mjs --stage /external/isolated/mcp-server --out /external/evidence/mcp",
  );
} else {
  const stage = required(options, "stage");
  const out = required(options, "out");
  await guard(out, "mcp-wire.json", async () => ({
    identity: await entryIdentity(stage, "dist/main.js"),
    stdio: await stdio(stage, out),
    statelessHttp: await http(stage, out, false),
    statefulHttpSse: await http(stage, out, true),
  }));
}

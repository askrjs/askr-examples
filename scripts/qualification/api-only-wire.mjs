import assert from "node:assert/strict";
import {
  args,
  required,
  entryIdentity,
  childProcess,
  availablePort,
  waitTcp,
  fetchRecorded,
  guard,
} from "./common.mjs";

const options = args();
if (options.help) {
  console.log(
    "node api-only-wire.mjs --stage /external/isolated/api-only --out /external/evidence/api-only",
  );
} else {
  const stage = required(options, "stage");
  const out = required(options, "out");
  await guard(out, "api-only-wire.json", async () => {
    const identity = await entryIdentity(stage, "dist/server.js");
    const port = await availablePort();
    const origin = `http://127.0.0.1:${port}`;
    const server = await childProcess(process.execPath, ["dist/server.js"], {
      cwd: stage,
      out,
      label: "compiled-api",
      env: { PORT: String(port), HOST: "127.0.0.1" },
    });
    const wire = [];
    let shutdown;
    try {
      await waitTcp(port, server);
      const get = async (path, init) => {
        const response = await fetchRecorded(origin + path, init);
        wire.push({ path, method: init?.method ?? "GET", ...response });
        return response;
      };
      const health = await get("/api/health");
      assert.equal(health.status, 200);
      assert.match(health.headers["x-request-id"], /^[0-9a-f-]{36}$/);
      assert.equal(health.headers["x-content-type-options"], "nosniff");
      for (const path of ["/livez", "/readyz", "/startupz"]) {
        const response = await get(path);
        assert.equal(response.status, 200);
        assert.equal(response.headers["cache-control"], "no-store");
      }
      const user = await get("/api/users/1");
      assert.equal(user.status, 200);
      assert.equal(user.headers.etag, '"1"');
      assert.equal(user.body.name, "Ada Lovelace");
      const patch = (name, etag) => ({
        method: "PATCH",
        headers: { "content-type": "application/json", ...(etag ? { "if-match": etag } : {}) },
        body: JSON.stringify({ name }),
      });
      const missing = await get("/api/users/1", patch("No Version"));
      assert.equal(missing.status, 428);
      assert.match(missing.headers["content-type"], /application\/problem\+json/);
      assert.equal(missing.body.status, 428);
      assert.match(missing.headers["x-request-id"], /^[0-9a-f-]{36}$/);
      const malformed = await get("/api/users/1", patch("Bad Version", "nonnumeric"));
      assert.equal(malformed.status, 400);
      const updated = await get("/api/users/1", patch("Wire Qualified", '"1"'));
      assert.equal(updated.status, 200);
      assert.equal(updated.headers.etag, '"2"');
      assert.equal(updated.body.name, "Wire Qualified");
      const stale = await get("/api/users/1", patch("Stale Writer", '"1"'));
      assert.equal(stale.status, 409);
      assert.equal(stale.body.status, 409);
      const after = await get("/api/users/1");
      assert.equal(after.body.name, "Wire Qualified");
      assert.equal(after.body.version, 2);
      const unknown = await get("/api/users/404");
      assert.equal(unknown.status, 404);
      assert.equal(unknown.body.status, 404);
    } finally {
      shutdown = await server.stop();
    }
    return { identity, origin, wire, shutdown };
  });
}

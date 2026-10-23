import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { createServer } from "node:http";
import { test } from "node:test";
import { verifyCandidateArchives } from "../../scripts/qualification/candidate-archives.mjs";

const names = [
  "askr",
  "auth",
  "charts",
  "cli",
  "fetch",
  "i18n",
  "logos",
  "lucide",
  "monaco",
  "node",
  "orm",
  "otel",
  "schema",
  "server",
  "testing",
  "themes",
  "ui",
  "vite",
];
const bytes = Buffer.from("owned archive bytes\0\xff", "latin1");
const sha256 = createHash("sha256").update(bytes).digest("hex");
const integrity = `sha512-${createHash("sha512").update(bytes).digest("base64")}`;
function inventory(selected = ["askr"]) {
  return {
    packages: Object.fromEntries(
      selected.map((name) => [
        `@askrjs/${name}`,
        { version: "0.5.0", sourceCommit: "e".repeat(40), tarballSha256: sha256, integrity },
      ]),
    ),
  };
}
async function registry(t, handler) {
  const server = createServer(handler);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  return new URL(`http://127.0.0.1:${server.address().port}/`);
}

test("all 18 served archives bind both hashes to canonical URLs and asserted producer commits", async (t) => {
  const requests = [];
  const url = await registry(t, (request, response) => {
    requests.push(request.url);
    response.end(bytes);
  });
  const archives = await verifyCandidateArchives(inventory(names), url);
  assert.equal(archives.length, 18);
  for (const [index, name] of names.entries()) {
    const path = `/@askrjs/${name}/-/${name}-0.5.0.tgz`;
    assert.equal(requests[index], path);
    assert.deepEqual(archives[index], {
      name: `@askrjs/${name}`,
      version: "0.5.0",
      sourceCommit: "e".repeat(40),
      canonicalUrl: `https://registry.npmjs.org${path}`,
      servedUrl: new URL(path, url).href,
      bytes: bytes.length,
      tarballSha256: sha256,
      integrity,
    });
  }
});
test("matching SRI cannot conceal a wrong inventory SHA256", async (t) => {
  const url = await registry(t, (_request, response) => response.end(bytes));
  const graph = inventory();
  graph.packages["@askrjs/askr"].tarballSha256 = "0".repeat(64);
  await assert.rejects(verifyCandidateArchives(graph, url), /archive SHA256 mismatch/);
});
test("matching SHA256 cannot conceal a wrong inventory SRI", async (t) => {
  const url = await registry(t, (_request, response) => response.end(bytes));
  const graph = inventory();
  graph.packages["@askrjs/askr"].integrity = `sha512-${Buffer.alloc(64).toString("base64")}`;
  await assert.rejects(verifyCandidateArchives(graph, url), /archive SRI mismatch/);
});
test("changed archive bytes fail rather than producing a receipt", async (t) => {
  const url = await registry(t, (_request, response) => response.end("different bytes"));
  await assert.rejects(verifyCandidateArchives(inventory(), url), /archive SHA256 mismatch/);
});
test("missing archive fails with its package identity", async (t) => {
  const url = await registry(t, (_request, response) => {
    response.statusCode = 404;
    response.end("missing");
  });
  await assert.rejects(
    verifyCandidateArchives(inventory(), url),
    /candidate archive HTTP status: @askrjs\/askr/,
  );
});
test("archive redirects cannot escape the selected registry", async (t) => {
  let destinationRequests = 0;
  const destination = await registry(t, (_request, response) => {
    destinationRequests++;
    response.end(bytes);
  });
  const url = await registry(t, (_request, response) => {
    response.writeHead(302, { location: destination.href });
    response.end();
  });
  await assert.rejects(verifyCandidateArchives(inventory(), url), /fetch failed/);
  assert.equal(destinationRequests, 0);
});

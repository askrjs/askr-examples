import assert from "node:assert/strict";
import { createHash } from "node:crypto";

// Hash the served bytes before installing any stage. npm separately enforces the
// same SRI during each fresh-cache install and canonical-lock replay.
export async function verifyCandidateArchives(inventory, registry) {
  const archives = [];
  for (const [name, candidate] of Object.entries(inventory.packages)) {
    assert.match(name, /^@askrjs\/[a-z][a-z0-9-]*$/);
    assert.equal(candidate.version, "0.5.0");
    const shortName = name.slice("@askrjs/".length);
    const canonicalUrl = new URL(
      `https://registry.npmjs.org/${name}/-/${shortName}-${candidate.version}.tgz`,
    );
    const servedUrl = new URL(canonicalUrl.pathname, registry);
    const response = await fetch(servedUrl, {
      redirect: "error",
      signal: AbortSignal.timeout(30_000),
    });
    if (response.status !== 200) await response.body?.cancel();
    assert.equal(response.status, 200, `candidate archive HTTP status: ${name}`);
    const bytes = Buffer.from(await response.arrayBuffer());
    const tarballSha256 = createHash("sha256").update(bytes).digest("hex");
    const integrity = `sha512-${createHash("sha512").update(bytes).digest("base64")}`;
    assert.equal(tarballSha256, candidate.tarballSha256, `archive SHA256 mismatch: ${name}`);
    assert.equal(integrity, candidate.integrity, `archive SRI mismatch: ${name}`);
    archives.push({
      name,
      version: candidate.version,
      // The coordinator binds this asserted producer commit to the frozen
      // inventory. Archive hashing cannot derive a Git commit from package bytes.
      sourceCommit: candidate.sourceCommit,
      canonicalUrl: canonicalUrl.href,
      servedUrl: servedUrl.href,
      bytes: bytes.length,
      tarballSha256,
      integrity,
    });
  }
  return archives;
}

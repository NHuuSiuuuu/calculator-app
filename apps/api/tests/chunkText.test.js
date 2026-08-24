import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import test from "node:test";

import { chunkText } from "../src/chunkText.js";

test("chunkText splits long text with overlap and token estimate", () => {
  const text = "A".repeat(120) + "\n\n" + "B".repeat(120);
  const chunks = chunkText(text, { maxChars: 100, overlapChars: 20 });

  assert.ok(chunks.length >= 3);
  assert.equal(chunks[0].content.length <= 100, true);
  assert.equal(chunks[0].tokenEstimate, Math.ceil(chunks[0].content.length / 4));
  assert.equal(chunks[1].content.startsWith(chunks[0].content.slice(-20)), true);
});

test("chunkText ignores empty input after trimming", () => {
  assert.deepEqual(chunkText("   \n\n  "), []);
});

test("chunkText rejects a nonpositive maxChars", () => {
  const result = spawnSync(
    process.execPath,
    ["--input-type=module", "-e", 'import { chunkText } from "./src/chunkText.js"; try { chunkText("A".repeat(10), { maxChars: 0 }); process.exit(1); } catch (error) { if (!(error instanceof RangeError)) process.exit(2); }'],
    { cwd: process.cwd(), encoding: "utf8", timeout: 500 },
  );

  assert.equal(result.error, undefined);
  assert.equal(result.status, 0);
});

test("chunkText terminates when overlapChars equals maxChars", () => {
  const result = spawnSync(
    process.execPath,
    ["--input-type=module", "-e", 'import { chunkText } from "./src/chunkText.js"; const chunks = chunkText("A".repeat(10), { maxChars: 4, overlapChars: 4 }); if (chunks.length < 2) process.exit(1);'],
    { cwd: process.cwd(), encoding: "utf8", timeout: 500 },
  );

  assert.equal(result.error, undefined);
  assert.equal(result.status, 0);
});

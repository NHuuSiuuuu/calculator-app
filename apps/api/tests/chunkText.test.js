import assert from "node:assert/strict";
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

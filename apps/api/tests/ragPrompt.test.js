import assert from "node:assert/strict";
import test from "node:test";

import { buildGroundedPrompt, createNoContextAnswer } from "../src/ragPrompt.js";

test("buildGroundedPrompt includes only retrieved company chunks", () => {
  const prompt = buildGroundedPrompt("How do refunds work?", [
    { chunkId: "chunk-1", filename: "policy.md", content: "Refunds are allowed within 7 days.", similarity: 0.82 },
  ]);

  assert.match(prompt.system, /uploaded company documents/);
  assert.match(prompt.user, /How do refunds work\?/);
  assert.match(prompt.user, /policy\.md/);
  assert.match(prompt.user, /Refunds are allowed within 7 days/);
});

test("createNoContextAnswer is explicit about missing company context", () => {
  assert.match(createNoContextAnswer(), /không tìm thấy thông tin phù hợp/i);
});

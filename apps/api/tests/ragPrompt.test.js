import assert from "node:assert/strict";
import test from "node:test";

import {
  buildGroundedPrompt,
  createEmptyKnowledgeBaseAnswer,
  createNoContextAnswer,
} from "../src/ragPrompt.js";

test("buildGroundedPrompt includes only retrieved company chunks", () => {
  const prompt = buildGroundedPrompt("How do refunds work?", [
    { chunkId: "chunk-1", filename: "policy.md", content: "Refunds are allowed within 7 days.", similarity: 0.82 },
  ]);

  assert.match(prompt.system, /Bạn là chatbot của công ty AHV Holding/);
  assert.match(prompt.system, /Chỉ sử dụng thông tin được cung cấp trong phần CONTEXT/);
  assert.match(prompt.system, /Không tự bịa thông tin hoặc sử dụng kiến thức bên ngoài/);
  assert.match(prompt.system, /Tôi chưa tìm thấy thông tin về vấn đề này trong tài liệu hiện có/);
  assert.match(prompt.system, /Trả lời bằng tiếng Việt/);
  assert.match(prompt.system, /ngắn gọn, dễ hiểu/);
  assert.match(prompt.system, /Tối đa 4 ý chính/);
  assert.match(prompt.system, /Markdown/);
  assert.match(prompt.system, /in đậm/);
  assert.match(prompt.system, /Không chép lại nguyên văn CONTEXT dài/);
  assert.match(prompt.system, /Không nói rằng bạn đã được "huấn luyện" với tài liệu/);
  assert.match(prompt.user, /CONTEXT:/);
  assert.match(prompt.user, /CÂU HỎI CỦA NGƯỜI DÙNG:/);
  assert.match(prompt.user, /How do refunds work\?/);
  assert.match(prompt.user, /policy\.md/);
  assert.match(prompt.user, /Refunds are allowed within 7 days/);
});

test("createNoContextAnswer is explicit about missing company context", () => {
  assert.equal(createNoContextAnswer(), "Tôi chưa tìm thấy thông tin về vấn đề này trong tài liệu hiện có.");
});

test("createEmptyKnowledgeBaseAnswer explains that no company documents are available", () => {
  assert.equal(createEmptyKnowledgeBaseAnswer(), "Tôi chưa tìm thấy thông tin về vấn đề này trong tài liệu hiện có.");
});

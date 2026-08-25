import assert from "node:assert/strict";
import test from "node:test";

import { createApiServer } from "../src/http.js";
import { handleChatRequest } from "../src/routes/chat.js";
import { handleDocumentUpload } from "../src/routes/documents.js";

async function withApiServer(dependencies, callback) {
  const server = createApiServer(dependencies);
  await new Promise((resolve) => server.listen(0, "127.0.0.1", resolve));
  const { port } = server.address();

  try {
    return await callback(`http://127.0.0.1:${port}`);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
}

test("handleDocumentUpload chunks text, embeds chunks, and marks document ready", async () => {
  const calls = [];
  const result = await handleDocumentUpload({
    user: { id: "admin-1" },
    file: { filename: "handbook.md", contentType: "text/markdown", text: "Refunds are allowed within 7 days.".repeat(20) },
    repository: {
      async createDocument(input) {
        calls.push(["createDocument", input]);
        return { id: "doc-1" };
      },
      async insertChunks(_documentId, chunks) {
        calls.push(["insertChunks", chunks.length]);
        return chunks.map((chunk, index) => ({ id: `chunk-${index + 1}`, ...chunk }));
      },
      async markDocumentReady(documentId, chunkCount) {
        calls.push(["markDocumentReady", documentId, chunkCount]);
      },
      async markDocumentFailed() {
        throw new Error("should not fail");
      },
    },
    openAiClient: {
      async createEmbedding() {
        return Array.from({ length: 1536 }, () => 0.01);
      },
    },
  });

  assert.equal(result.documentId, "doc-1");
  assert.equal(result.status, "ready");
  assert.ok(result.chunkCount > 0);
  assert.equal(calls[0][0], "createDocument");
  assert.equal(calls.at(-1)[0], "markDocumentReady");
});

test("handleChatRequest stores messages and returns sources", async () => {
  const messages = [];
  const result = await handleChatRequest({
    user: { id: "user-1" },
    body: { message: "What is the refund window?" },
    repository: {
      async createConversation() {
        return { id: "conv-1" };
      },
      async insertMessage(message) {
        messages.push(message);
        return { id: `msg-${messages.length}`, ...message };
      },
      async hasReadyDocuments() {
        return true;
      },
      async matchChunks() {
        return [{ chunkId: "chunk-1", filename: "policy.md", content: "Refunds are allowed within 7 days.", similarity: 0.88 }];
      },
    },
    openAiClient: {
      async createEmbedding() {
        return Array.from({ length: 1536 }, () => 0.02);
      },
      async createChatAnswer() {
        return "Refunds are allowed within 7 days.";
      },
    },
  });

  assert.equal(result.conversationId, "conv-1");
  assert.equal(result.answer, "Refunds are allowed within 7 days.");
  assert.deepEqual(result.sources, [{ chunkId: "chunk-1", filename: "policy.md", similarity: 0.88 }]);
  assert.equal(messages[0].role, "user");
  assert.equal(messages[1].role, "assistant");
});

test("handleChatRequest retrieves the top K chunks without a high similarity threshold", async () => {
  const retrievalCalls = [];
  const result = await handleChatRequest({
    user: { id: "user-1" },
    body: { message: "Tôi muốn sân bóng" },
    repository: {
      async createConversation() {
        return { id: "conv-1" };
      },
      async insertMessage() {},
      async hasReadyDocuments() {
        return true;
      },
      async matchChunks(embedding, threshold, count) {
        retrievalCalls.push({ embedding, threshold, count });
        return [{
          chunkId: "chunk-1",
          filename: "faq.md",
          content: "Khách muốn đặt sân bóng thì chọn lịch trống và thanh toán cọc.",
          similarity: 0.52,
        }];
      },
    },
    openAiClient: {
      async createEmbedding(input) {
        assert.equal(input, "Tôi muốn sân bóng");
        return [0.21, 0.82, 0.53];
      },
      async createChatAnswer(messages) {
        assert.match(messages[1].content, /Khách muốn đặt sân bóng/);
        return "Anh chọn lịch trống rồi thanh toán cọc để đặt sân.";
      },
    },
  });

  assert.deepEqual(retrievalCalls, [{ embedding: [0.21, 0.82, 0.53], threshold: -1, count: 5 }]);
  assert.equal(result.answer, "Anh chọn lịch trống rồi thanh toán cọc để đặt sân.");
  assert.deepEqual(result.sources, [{ chunkId: "chunk-1", filename: "faq.md", similarity: 0.52 }]);
});

test("handleChatRequest rejects an existing conversation not owned by the user", async () => {
  const messages = [];

  await assert.rejects(
    () => handleChatRequest({
      user: { id: "user-1" },
      body: { conversationId: "other-users-conversation", message: "Can I read this?" },
      repository: {
        async getConversation(userId, conversationId) {
          assert.equal(userId, "user-1");
          assert.equal(conversationId, "other-users-conversation");
          return null;
        },
        async insertMessage(message) {
          messages.push(message);
        },
        async matchChunks() {
          return [];
        },
      },
      openAiClient: {
        async createEmbedding() {
          return Array.from({ length: 1536 }, () => 0.02);
        },
      },
    }),
    (error) => error.statusCode === 404 && error.message === "Conversation not found",
  );

  assert.deepEqual(messages, []);
});

test("handleChatRequest returns the no-context answer when retrieval is empty", async () => {
  const messages = [];
  const result = await handleChatRequest({
    user: { id: "user-1" },
    body: { message: "What is the refund window?" },
    repository: {
      async createConversation() {
        return { id: "conv-1" };
      },
      async insertMessage(message) {
        messages.push(message);
      },
      async hasReadyDocuments() {
        return true;
      },
      async matchChunks() {
        return [];
      },
    },
    openAiClient: {
      async createEmbedding() {
        return Array.from({ length: 1536 }, () => 0.02);
      },
      async createChatAnswer() {
        throw new Error("should not generate without context");
      },
    },
  });

  assert.equal(result.answer, "Em không tìm thấy thông tin phù hợp trong tài liệu công ty đã upload, nên chưa thể trả lời chắc chắn câu hỏi này.");
  assert.deepEqual(result.sources, []);
  assert.equal(messages[1].role, "assistant");
});

test("handleChatRequest distinguishes an empty knowledge base from irrelevant retrieval", async () => {
  const messages = [];
  const result = await handleChatRequest({
    user: { id: "user-1" },
    body: { message: "What is the refund window?" },
    repository: {
      async createConversation() {
        return { id: "conv-1" };
      },
      async insertMessage(message) {
        messages.push(message);
      },
      async hasReadyDocuments() {
        return false;
      },
      async matchChunks() {
        throw new Error("should not retrieve without documents");
      },
    },
    openAiClient: {
      async createEmbedding() {
        throw new Error("should not embed without documents");
      },
      async createChatAnswer() {
        throw new Error("should not generate without documents");
      },
    },
  });

  assert.match(result.answer, /chưa có tài liệu công ty/i);
  assert.deepEqual(result.sources, []);
  assert.equal(messages[1].role, "assistant");
});

test("handleDocumentUpload rejects a non-text filename despite a text MIME type", async () => {
  const calls = [];
  await assert.rejects(
    () => handleDocumentUpload({
      user: { id: "admin-1" },
      file: { filename: "payload.pdf", contentType: "text/plain", text: "Not a supported document" },
      repository: {
        async createDocument() {
          calls.push("createDocument");
          return { id: "doc-1" };
        },
        async insertChunks() {},
        async markDocumentReady() {},
        async markDocumentFailed() {},
      },
      openAiClient: {
        async createEmbedding() {
          return Array.from({ length: 1536 }, () => 0.01);
        },
      },
    }),
    (error) => error.statusCode === 400 && error.message === "Only .txt and .md files are supported",
  );

  assert.deepEqual(calls, []);
});

test("handleDocumentUpload accepts a markdown extension with a generic MIME type", async () => {
  const documents = [];
  const result = await handleDocumentUpload({
    user: { id: "admin-1" },
    file: { filename: "HANDBOOK.MD", contentType: "application/octet-stream", text: "Refunds are allowed within 7 days." },
    repository: {
      async createDocument(input) {
        documents.push(input);
        return { id: "doc-1" };
      },
      async insertChunks() {},
      async markDocumentReady() {},
      async markDocumentFailed() {
        throw new Error("should not fail");
      },
    },
    openAiClient: {
      async createEmbedding() {
        return Array.from({ length: 1536 }, () => 0.01);
      },
    },
  });

  assert.equal(result.status, "ready");
  assert.equal(documents[0].contentType, "text/markdown");
});

test("handleDocumentUpload accepts a plain text document", async () => {
  const documents = [];
  const result = await handleDocumentUpload({
    user: { id: "admin-1" },
    file: { filename: "faq.txt", contentType: "text/plain", text: "Khach dat san bong bang cach chon lich trong va thanh toan coc." },
    repository: {
      async createDocument(input) {
        documents.push(input);
        return { id: "doc-1" };
      },
      async insertChunks() {},
      async markDocumentReady() {},
      async markDocumentFailed() {
        throw new Error("should not fail");
      },
    },
    openAiClient: {
      async createEmbedding() {
        return Array.from({ length: 1536 }, () => 0.01);
      },
    },
  });

  assert.equal(result.status, "ready");
  assert.equal(documents[0].contentType, "text/plain");
});

test("handleChatRequest rejects an oversized message before creating a conversation", async () => {
  const calls = [];

  await assert.rejects(
    () => handleChatRequest({
      user: { id: "user-1" },
      body: { message: "x".repeat(4001) },
      repository: {
        async createConversation() {
          calls.push("createConversation");
        },
        async insertMessage() {
          calls.push("insertMessage");
        },
      },
      openAiClient: {
        async createEmbedding() {
          calls.push("createEmbedding");
        },
      },
    }),
    (error) => error.statusCode === 400 && error.message === "Message must be 4000 characters or fewer",
  );

  assert.deepEqual(calls, []);
});

test("handleDocumentUpload reports an empty document as a client error", async () => {
  const failures = [];

  await assert.rejects(
    () => handleDocumentUpload({
      user: { id: "admin-1" },
      file: { filename: "empty.txt", contentType: "text/plain", text: " \n\t " },
      repository: {
        async createDocument() {
          return { id: "doc-1" };
        },
        async markDocumentFailed(documentId, message) {
          failures.push([documentId, message]);
        },
      },
      openAiClient: {},
    }),
    (error) => error.statusCode === 400 && error.message === "Uploaded document is empty",
  );

  assert.deepEqual(failures, [["doc-1", "Uploaded document is empty"]]);
});

test("HTTP document upload accepts demo requests without auth and parses one multipart file", async () => {
  const calls = [];
  await withApiServer({
    authService: {
      async requireAdmin() {
        throw new Error("should not require admin auth in demo mode");
      },
      async requireUser() {
        throw new Error("should not require user auth in demo mode");
      },
    },
    repository: {
      async createDocument(input) {
        calls.push(["createDocument", input]);
        return { id: "doc-1" };
      },
      async insertChunks() {},
      async markDocumentReady() {},
      async markDocumentFailed() {
        throw new Error("should not fail");
      },
    },
    openAiClient: {
      async createEmbedding() {
        return Array.from({ length: 1536 }, () => 0.01);
      },
    },
  }, async (origin) => {
    const boundary = "UploadBoundary";
    const response = await fetch(`${origin}/api/documents/upload`, {
      method: "POST",
      headers: {
        "content-type": `multipart/form-data; boundary=${boundary}`,
      },
      body: `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="handbook.md"\r\nContent-Type: text/markdown\r\n\r\nRefunds are allowed within 7 days.\r\n--${boundary}--\r\n`,
    });

    assert.equal(response.status, 201);
    assert.deepEqual(await response.json(), { documentId: "doc-1", status: "ready", chunkCount: 1 });
  });

  assert.deepEqual(calls[0], ["createDocument", {
    ownerId: null,
    filename: "handbook.md",
    contentType: "text/markdown",
  }]);
});

test("HTTP document list accepts demo requests without admin auth", async () => {
  let listed = false;
  await withApiServer({
    authService: {
      async requireAdmin() {
        throw new Error("should not require admin auth in demo mode");
      },
    },
    repository: {
      async listDocuments() {
        listed = true;
        return [];
      },
    },
    openAiClient: {},
  }, async (origin) => {
    const response = await fetch(`${origin}/api/documents`);

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { documents: [] });
  });

  assert.equal(listed, true);
});

test("HTTP current-user endpoint returns demo admin without auth", async () => {
  await withApiServer({
    authService: {
      async requireUserWithRole() {
        throw new Error("should not require user auth in demo mode");
      },
    },
    repository: {},
    openAiClient: {},
  }, async (origin) => {
    const response = await fetch(`${origin}/api/me`);

    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), {
      user: { id: null, email: null, role: "admin" },
    });
  });
});

test("HTTP chat accepts demo requests without auth", async () => {
  const calls = [];
  await withApiServer({
    authService: {
      async requireUser() {
        throw new Error("should not require user auth in demo mode");
      },
    },
    repository: {
      async createConversation(userId, title) {
        calls.push(["createConversation", userId, title]);
        return { id: "conv-1" };
      },
      async insertMessage(message) {
        calls.push(["insertMessage", message.role]);
        return { id: `msg-${calls.length}`, ...message };
      },
      async hasReadyDocuments() {
        return false;
      },
      async listConversations(userId) {
        calls.push(["listConversations", userId]);
        return [];
      },
    },
    openAiClient: {
      async createEmbedding() {
        throw new Error("should not embed without documents");
      },
    },
  }, async (origin) => {
    const response = await fetch(`${origin}/api/chat`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ message: "What is the refund window?" }),
    });

    assert.equal(response.status, 200);
    assert.equal((await response.json()).conversationId, "conv-1");
  });

  assert.deepEqual(calls[0], ["createConversation", null, "What is the refund window?"]);
});

test("HTTP server hides unclassified internal error details", async () => {
  await withApiServer({
    authService: {
      async requireUser() {
        return { id: "user-1" };
      },
    },
    repository: {
      async listConversations() {
        throw new Error("database password leaked");
      },
    },
    openAiClient: {},
  }, async (origin) => {
    const response = await fetch(`${origin}/api/conversations`, {
      headers: { authorization: "Bearer user-token" },
    });

    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { error: "Internal server error" });
  });
});

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
  const result = await handleDocumentUpload({
    user: { id: "admin-1" },
    file: { filename: "HANDBOOK.MD", contentType: "application/octet-stream", text: "Refunds are allowed within 7 days." },
    repository: {
      async createDocument() {
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

test("HTTP document upload requires an admin and parses one multipart file", async () => {
  const calls = [];
  await withApiServer({
    authService: {
      async requireAdmin(request) {
        calls.push(["requireAdmin", request.headers.authorization]);
        return { id: "admin-1" };
      },
      async requireUser() {
        throw new Error("should not require a regular user");
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
        authorization: "Bearer admin-token",
        "content-type": `multipart/form-data; boundary=${boundary}`,
      },
      body: `--${boundary}\r\nContent-Disposition: form-data; name="file"; filename="handbook.md"\r\nContent-Type: text/markdown\r\n\r\nRefunds are allowed within 7 days.\r\n--${boundary}--\r\n`,
    });

    assert.equal(response.status, 201);
    assert.deepEqual(await response.json(), { documentId: "doc-1", status: "ready", chunkCount: 1 });
  });

  assert.deepEqual(calls[0], ["requireAdmin", "Bearer admin-token"]);
  assert.deepEqual(calls[1], ["createDocument", {
    ownerId: "admin-1",
    filename: "handbook.md",
    contentType: "text/markdown",
  }]);
});

test("HTTP document endpoints return an auth error when admin verification fails", async () => {
  await withApiServer({
    authService: {
      async requireAdmin() {
        const error = new Error("Admin role required");
        error.statusCode = 403;
        throw error;
      },
    },
    repository: {},
    openAiClient: {},
  }, async (origin) => {
    const response = await fetch(`${origin}/api/documents`);

    assert.equal(response.status, 403);
    assert.deepEqual(await response.json(), { error: "Admin role required" });
  });
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

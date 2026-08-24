import assert from "node:assert/strict";
import test from "node:test";

import { createSupportRepository } from "../src/repositories/supportRepository.js";

test("repository creates conversations scoped to a user", async () => {
  const calls = [];
  const repository = createSupportRepository({
    from(table) {
      return {
        insert(row) {
          calls.push(["insert", table, row]);
          return {
            select() { return this; },
            single() {
              return Promise.resolve({ data: { id: "conv-1", ...row }, error: null });
            },
          };
        },
      };
    },
  });

  const conversation = await repository.createConversation("user-1", "Question title");

  assert.equal(conversation.id, "conv-1");
  assert.deepEqual(calls[0], ["insert", "support_conversations", { user_id: "user-1", title: "Question title" }]);
});

test("repository maps vector matches into source objects", async () => {
  const repository = createSupportRepository({
    rpc(name, args) {
      assert.equal(name, "match_support_chunks");
      assert.equal(args.match_count, 5);
      return Promise.resolve({
        data: [{
          chunk_id: "chunk-1",
          document_id: "doc-1",
          content: "Return within 7 days.",
          filename: "policy.md",
          similarity: 0.9,
        }],
        error: null,
      });
    },
  });

  const chunks = await repository.matchChunks([0.1, 0.2], 0.75, 5);

  assert.deepEqual(chunks, [{
    chunkId: "chunk-1",
    documentId: "doc-1",
    content: "Return within 7 days.",
    filename: "policy.md",
    similarity: 0.9,
  }]);
});

test("repository gets a conversation scoped by its owner", async () => {
  const calls = [];
  const repository = createSupportRepository({
    from(table) {
      assert.equal(table, "support_conversations");
      return {
        select(columns) {
          calls.push(["select", columns]);
          return this;
        },
        eq(column, value) {
          calls.push(["eq", column, value]);
          return this;
        },
        maybeSingle() {
          return Promise.resolve({ data: { id: "conv-1" }, error: null });
        },
      };
    },
  });

  const conversation = await repository.getConversation("user-1", "conv-1");

  assert.deepEqual(conversation, { id: "conv-1" });
  assert.deepEqual(calls, [
    ["select", "id"],
    ["eq", "id", "conv-1"],
    ["eq", "user_id", "user-1"],
  ]);
});

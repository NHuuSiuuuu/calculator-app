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

test("repository treats successful null vector data as no matches", async () => {
  const repository = createSupportRepository({
    rpc() {
      return Promise.resolve({ data: null, error: null });
    },
  });

  assert.deepEqual(await repository.matchChunks([0.1, 0.2]), []);
});

test("repository reports whether at least one ready document exists", async () => {
  const repository = createSupportRepository({
    from(table) {
      assert.equal(table, "support_documents");
      return {
        select(columns) {
          assert.equal(columns, "id");
          return this;
        },
        eq(column, value) {
          assert.deepEqual([column, value], ["status", "ready"]);
          return this;
        },
        limit(count) {
          assert.equal(count, 1);
          return Promise.resolve({ data: [{ id: "doc-1" }], error: null });
        },
      };
    },
  });

  assert.equal(await repository.hasReadyDocuments(), true);
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

test("repository reconstructs persisted message sources from retrieved chunk IDs", async () => {
  const repository = createSupportRepository({
    from(table) {
      if (table === "support_conversations") {
        return {
          select() { return this; },
          eq() { return this; },
          maybeSingle() {
            return Promise.resolve({ data: { id: "conv-1" }, error: null });
          },
        };
      }

      if (table === "support_messages") {
        return {
          select() { return this; },
          eq() { return this; },
          order() {
            return Promise.resolve({
              data: [{
                id: "message-1",
                role: "assistant",
                content: "Refunds are available for seven days.",
                retrieved_chunk_ids: ["chunk-1"],
              }],
              error: null,
            });
          },
        };
      }

      assert.equal(table, "support_document_chunks");
      return {
        select() { return this; },
        in(column, values) {
          assert.equal(column, "id");
          assert.deepEqual(values, ["chunk-1"]);
          return Promise.resolve({
            data: [{ id: "chunk-1", support_documents: { filename: "policy.md" } }],
            error: null,
          });
        },
      };
    },
  });

  const messages = await repository.getMessages("user-1", "conv-1");

  assert.deepEqual(messages[0].sources, [{ chunkId: "chunk-1", filename: "policy.md" }]);
});

test("repository returns no messages when the conversation is missing or not owned", async () => {
  const tables = [];
  const repository = createSupportRepository({
    from(table) {
      tables.push(table);
      return {
        select() { return this; },
        eq() { return this; },
        maybeSingle() {
          return Promise.resolve({ data: null, error: null });
        },
      };
    },
  });

  assert.deepEqual(await repository.getMessages("user-1", "missing-conversation"), []);
  assert.deepEqual(tables, ["support_conversations"]);
});

test("repository touches a conversation after inserting a message", async () => {
  const calls = [];
  const repository = createSupportRepository({
    from(table) {
      if (table === "support_messages") {
        return {
          insert(row) {
            calls.push(["insert", table, row]);
            return {
              select() { return this; },
              single() {
                return Promise.resolve({ data: { id: "message-1", ...row }, error: null });
              },
            };
          },
        };
      }

      assert.equal(table, "support_conversations");
      return {
        update(changes) {
          calls.push(["update", table, changes]);
          return this;
        },
        eq(column, value) {
          calls.push(["eq", column, value]);
          return Promise.resolve({ error: null });
        },
      };
    },
  });

  await repository.insertMessage({
    conversationId: "conv-1",
    role: "user",
    content: "What is the refund window?",
  });

  assert.equal(calls[1][0], "update");
  assert.equal(calls[1][1], "support_conversations");
  assert.equal(typeof calls[1][2].updated_at, "string");
  assert.deepEqual(calls[2], ["eq", "id", "conv-1"]);
});

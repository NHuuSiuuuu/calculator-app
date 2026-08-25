import assert from "node:assert/strict";
import test from "node:test";

import { createSupportApi } from "../src/features/support/supportApi.js";

test("support API defaults to same-origin routes", async () => {
  const calls = [];
  const api = createSupportApi({
    getAccessToken: () => "",
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return {
        ok: true,
        async json() {
          return { documents: [] };
        },
      };
    },
  });

  await api.listDocuments();

  assert.equal(calls[0].url, "/api/documents");
});

test("support API errors include the failed route and status", async () => {
  const api = createSupportApi({
    getAccessToken: () => "",
    fetchImpl: async () => ({
      ok: false,
      status: 404,
      async json() {
        return {};
      },
    }),
  });

  await assert.rejects(
    () => api.listDocuments(),
    /\/api\/documents failed with 404/,
  );
});

test("support API sends bearer token for chat", async () => {
  const calls = [];
  const api = createSupportApi({
    baseUrl: "https://api.example.com",
    getAccessToken: () => "access-token",
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return {
        ok: true,
        async json() {
          return { conversationId: "conv-1", answer: "Answer", sources: [] };
        },
      };
    },
  });

  const result = await api.sendMessage({ message: "Hello" });

  assert.equal(result.answer, "Answer");
  assert.equal(calls[0].url, "https://api.example.com/api/chat");
  assert.equal(calls[0].options.headers.authorization, "Bearer access-token");
});

test("support API omits bearer header when no token is available", async () => {
  const calls = [];
  const api = createSupportApi({
    baseUrl: "https://api.example.com",
    getAccessToken: () => "",
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return {
        ok: true,
        async json() {
          return { conversationId: "conv-1", answer: "Answer", sources: [] };
        },
      };
    },
  });

  await api.sendMessage({ message: "Hello" });

  assert.equal(calls[0].url, "https://api.example.com/api/chat");
  assert.equal("authorization" in calls[0].options.headers, false);
});

test("support API loads the current user's backend-authoritative role", async () => {
  const calls = [];
  const api = createSupportApi({
    baseUrl: "https://api.example.com",
    getAccessToken: () => "access-token",
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return {
        ok: true,
        async json() {
          return { user: { id: "user-1", role: "user" } };
        },
      };
    },
  });

  assert.deepEqual(await api.getCurrentUser(), { user: { id: "user-1", role: "user" } });
  assert.equal(calls[0].url, "https://api.example.com/api/me");
});

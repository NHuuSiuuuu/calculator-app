import assert from "node:assert/strict";
import test from "node:test";

import { createGeminiClient } from "../src/geminiClient.js";

test("createGeminiClient creates 1536-dimensional document embeddings", async () => {
  const requests = [];
  const client = createGeminiClient({
    geminiApiKey: "gemini-test",
    embeddingModel: "gemini-embedding-001",
    embeddingDimensions: 1536,
    chatModel: "gemini-2.5-flash-lite",
  }, async (url, options) => {
    requests.push({ url, options });
    return {
      ok: true,
      async json() {
        return { embedding: { values: [0.1, 0.2, 0.3] } };
      },
    };
  });

  const embedding = await client.createEmbedding("Company policy", "RETRIEVAL_DOCUMENT");

  assert.deepEqual(embedding, [0.1, 0.2, 0.3]);
  assert.match(requests[0].url, /models\/gemini-embedding-001:embedContent$/);
  assert.equal(requests[0].options.headers["x-goog-api-key"], "gemini-test");
  assert.deepEqual(JSON.parse(requests[0].options.body), {
    content: {
      parts: [{ text: "Company policy" }],
    },
    task_type: "RETRIEVAL_DOCUMENT",
    output_dimensionality: 1536,
  });
});

test("createGeminiClient creates chat answers from system and user messages", async () => {
  const requests = [];
  const client = createGeminiClient({
    geminiApiKey: "gemini-test",
    embeddingModel: "gemini-embedding-001",
    embeddingDimensions: 1536,
    chatModel: "gemini-2.5-flash-lite",
  }, async (url, options) => {
    requests.push({ url, options });
    return {
      ok: true,
      async json() {
        return {
          candidates: [{
            content: {
              parts: [{ text: "Refunds are available within 7 days." }],
            },
          }],
        };
      },
    };
  });

  const answer = await client.createChatAnswer([
    { role: "system", content: "Answer only from company docs." },
    { role: "user", content: "What is the refund window?" },
  ]);

  assert.equal(answer, "Refunds are available within 7 days.");
  assert.match(requests[0].url, /models\/gemini-2.5-flash-lite:generateContent$/);
  assert.deepEqual(JSON.parse(requests[0].options.body), {
    systemInstruction: {
      parts: [{ text: "Answer only from company docs." }],
    },
    contents: [{
      role: "user",
      parts: [{ text: "What is the refund window?" }],
    }],
    generationConfig: {
      temperature: 0.2,
    },
  });
});

test("createGeminiClient exposes Gemini API failures as gateway errors", async () => {
  const client = createGeminiClient({
    geminiApiKey: "gemini-test",
    embeddingModel: "gemini-embedding-001",
    embeddingDimensions: 1536,
    chatModel: "gemini-2.5-flash-lite",
  }, async () => ({
    ok: false,
    status: 429,
    async json() {
      return { error: { message: "Rate limit exceeded" } };
    },
  }));

  await assert.rejects(
    () => client.createEmbedding("Company policy"),
    (error) => error.statusCode === 502 && error.message === "Rate limit exceeded",
  );
});

test("createGeminiClient reports missing embedding values as a gateway error", async () => {
  const client = createGeminiClient({
    geminiApiKey: "gemini-test",
    embeddingModel: "gemini-embedding-001",
    embeddingDimensions: 1536,
    chatModel: "gemini-2.5-flash-lite",
  }, async () => ({
    ok: true,
    async json() {
      return { embeddings: [{ values: [0.1, 0.2, 0.3] }] };
    },
  }));

  await assert.rejects(
    () => client.createEmbedding("Company policy"),
    (error) => error.statusCode === 502
      && error.message === "Gemini embedding response did not include embedding.values",
  );
});

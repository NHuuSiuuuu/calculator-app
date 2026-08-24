import assert from "node:assert/strict";
import test from "node:test";

import { readApiConfig } from "../src/config.js";

test("readApiConfig normalizes API configuration", () => {
  const config = readApiConfig({
    OPENAI_API_KEY: "sk-test",
    OPENAI_EMBEDDING_MODEL: "",
    OPENAI_CHAT_MODEL: "",
    SUPABASE_URL: "https://demo.supabase.co/",
    SUPABASE_SERVICE_ROLE_KEY: "service-role",
    PORT: "5050",
  });

  assert.equal(config.openaiApiKey, "sk-test");
  assert.equal(config.embeddingModel, "text-embedding-3-small");
  assert.equal(config.chatModel, "gpt-4.1-mini");
  assert.equal(config.supabaseUrl, "https://demo.supabase.co");
  assert.equal(config.port, 5050);
});

test("readApiConfig can reuse the Vite Supabase URL on same-domain Vercel deploys", () => {
  const config = readApiConfig({
    OPENAI_API_KEY: "sk-test",
    VITE_SUPABASE_URL: "https://demo.supabase.co/",
    SUPABASE_SERVICE_ROLE_KEY: "service-role",
  });

  assert.equal(config.supabaseUrl, "https://demo.supabase.co");
});

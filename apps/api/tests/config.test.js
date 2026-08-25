import assert from "node:assert/strict";
import test from "node:test";

import { readApiConfig, requireApiConfig } from "../src/config.js";

test("readApiConfig normalizes API configuration", () => {
  const config = readApiConfig({
    AI_PROVIDER: "openai",
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
    AI_PROVIDER: "openai",
    OPENAI_API_KEY: "sk-test",
    VITE_SUPABASE_URL: "https://demo.supabase.co/",
    SUPABASE_SERVICE_ROLE_KEY: "service-role",
  });

  assert.equal(config.supabaseUrl, "https://demo.supabase.co");
});

test("readApiConfig defaults to Gemini provider and models", () => {
  const config = readApiConfig({
    GEMINI_API_KEY: "gemini-test",
    SUPABASE_URL: "https://demo.supabase.co/",
    SUPABASE_SERVICE_ROLE_KEY: "service-role",
  });

  assert.equal(config.aiProvider, "gemini");
  assert.equal(config.geminiApiKey, "gemini-test");
  assert.equal(config.embeddingModel, "gemini-embedding-001");
  assert.equal(config.chatModel, "gemini-2.5-flash-lite");
  assert.equal(config.embeddingDimensions, 1536);
});

test("requireApiConfig accepts Gemini API configuration without OpenAI", () => {
  const config = readApiConfig({
    AI_PROVIDER: "gemini",
    GEMINI_API_KEY: "gemini-test",
    SUPABASE_URL: "https://demo.supabase.co/",
    SUPABASE_SERVICE_ROLE_KEY: "service-role",
  });

  assert.doesNotThrow(() => requireApiConfig(config));
});

test("requireApiConfig reports a missing Gemini key", () => {
  const config = readApiConfig({
    AI_PROVIDER: "gemini",
    SUPABASE_URL: "https://demo.supabase.co/",
    SUPABASE_SERVICE_ROLE_KEY: "service-role",
  });

  assert.throws(
    () => requireApiConfig(config),
    /Missing API environment variables: GEMINI_API_KEY/,
  );
});

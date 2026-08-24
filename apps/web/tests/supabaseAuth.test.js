import assert from "node:assert/strict";
import test from "node:test";

import { createAuthApi, normalizeAuthSession } from "../src/features/auth/authState.js";
import { readSupabaseEnv } from "../src/lib/supabase/client.js";

test("normalizeAuthSession returns null for missing session", () => {
  assert.equal(normalizeAuthSession(null), null);
});

test("normalizeAuthSession extracts access token and user", () => {
  const result = normalizeAuthSession({
    access_token: "access-token",
    user: { id: "user-1", email: "a@example.com" },
  });

  assert.deepEqual(result, {
    accessToken: "access-token",
    user: { id: "user-1", email: "a@example.com" },
  });
});

test("auth api delegates email password methods to Supabase auth", async () => {
  const calls = [];
  const api = createAuthApi({
    auth: {
      async signUp(input) {
        calls.push(["signUp", input]);
        return { data: { session: null }, error: null };
      },
      async signInWithPassword(input) {
        calls.push(["signInWithPassword", input]);
        return { data: { session: null }, error: null };
      },
      async signOut() {
        calls.push(["signOut"]);
        return { error: null };
      },
      async getSession() {
        calls.push(["getSession"]);
        return { data: { session: null }, error: null };
      },
    },
  });

  await api.signUp("a@example.com", "password123");
  await api.signIn("a@example.com", "password123");
  await api.getSession();
  await api.signOut();

  assert.deepEqual(calls, [
    ["signUp", { email: "a@example.com", password: "password123" }],
    ["signInWithPassword", { email: "a@example.com", password: "password123" }],
    ["getSession"],
    ["signOut"],
  ]);
});

test("auth api raises Supabase auth errors", async () => {
  const api = createAuthApi({
    auth: {
      async signInWithPassword() {
        return { data: { session: null }, error: { message: "Invalid login credentials" } };
      },
    },
  });

  await assert.rejects(() => api.signIn("a@example.com", "wrong-password"), /Invalid login credentials/);
});

test("readSupabaseEnv normalizes Vite env values", () => {
  assert.deepEqual(
    readSupabaseEnv({
      VITE_SUPABASE_URL: "https://demo.supabase.co/",
      VITE_SUPABASE_ANON_KEY: "anon-key",
    }),
    {
      url: "https://demo.supabase.co",
      anonKey: "anon-key",
    },
  );
});

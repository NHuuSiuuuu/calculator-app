import assert from "node:assert/strict";
import test from "node:test";

import { createAuthService, extractBearerToken } from "../src/auth.js";

test("extractBearerToken reads authorization header", () => {
  assert.equal(extractBearerToken({ authorization: "Bearer token-1" }), "token-1");
  assert.equal(extractBearerToken({ Authorization: "Bearer token-2" }), "token-2");
});

test("requireAdmin rejects non-admin users", async () => {
  const auth = createAuthService({
    auth: {
      async getUser() {
        return { data: { user: { id: "user-1", email: "u@example.com" } }, error: null };
      },
    },
    from() {
      return {
        select() { return this; },
        eq() { return this; },
        maybeSingle() {
          return Promise.resolve({ data: { role: "user" }, error: null });
        },
      };
    },
  });

  await assert.rejects(
    () => auth.requireAdmin({ headers: { authorization: "Bearer token" } }),
    /Admin role required/,
  );
});

test("requireUserWithRole returns a signed-in user's profile role", async () => {
  const auth = createAuthService({
    auth: {
      async getUser() {
        return { data: { user: { id: "user-1", email: "u@example.com" } }, error: null };
      },
    },
    from(table) {
      assert.equal(table, "profiles");
      return {
        select() { return this; },
        eq() { return this; },
        maybeSingle() {
          return Promise.resolve({ data: { role: "user" }, error: null });
        },
      };
    },
  });

  assert.deepEqual(
    await auth.requireUserWithRole({ headers: { authorization: "Bearer token" } }),
    { id: "user-1", email: "u@example.com", token: "token", role: "user" },
  );
});

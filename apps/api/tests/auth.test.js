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
        single() {
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

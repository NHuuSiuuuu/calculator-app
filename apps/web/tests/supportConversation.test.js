import assert from "node:assert/strict";
import test from "node:test";

import { createLatestRequestGuard } from "../src/features/support/latestRequestGuard.js";

test("latest request guard rejects a late conversation response", () => {
  const guard = createLatestRequestGuard();
  const conversationARequest = guard.begin();
  const conversationBRequest = guard.begin();

  assert.equal(guard.isCurrent(conversationARequest), false);
  assert.equal(guard.isCurrent(conversationBRequest), true);
});

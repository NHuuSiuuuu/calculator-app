import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

import { createVercelHandler } from "../src/vercelHandler.js";

const vercelApiUrl = new URL("../../../api/[...path].js", import.meta.url);
const webRootVercelApiUrl = new URL("../../web/api/[...path].js", import.meta.url);
const uploadApiUrl = new URL("../../../api/documents/upload.js", import.meta.url);
const webRootUploadApiUrl = new URL("../../web/api/documents/upload.js", import.meta.url);
const messagesApiUrl = new URL("../../../api/conversations/[id]/messages.js", import.meta.url);
const webRootMessagesApiUrl = new URL("../../web/api/conversations/[id]/messages.js", import.meta.url);

function createMockResponse() {
  return {
    statusCode: null,
    headers: null,
    body: "",
    writeHead(statusCode, headers) {
      this.statusCode = statusCode;
      this.headers = headers;
    },
    end(body) {
      this.body = body;
    },
  };
}

test("root Vercel catch-all API function is available for /api routes", async () => {
  await access(vercelApiUrl);

  const source = await readFile(vercelApiUrl, "utf8");
  assert.match(source, /createProductionApiServer/);
  assert.match(source, /createVercelHandler/);
});

test("web-root Vercel catch-all API function is available for apps/web root deploys", async () => {
  await access(webRootVercelApiUrl);

  const source = await readFile(webRootVercelApiUrl, "utf8");
  assert.match(source, /createProductionApiServer/);
  assert.match(source, /createVercelHandler/);
});

test("nested Vercel API functions are available for upload and conversation messages", async () => {
  for (const routeUrl of [uploadApiUrl, webRootUploadApiUrl, messagesApiUrl, webRootMessagesApiUrl]) {
    await access(routeUrl);
    const source = await readFile(routeUrl, "utf8");
    assert.match(source, /createProductionApiServer/);
    assert.match(source, /createVercelHandler/);
  }
});

test("Vercel handler returns JSON when API setup fails before routing", () => {
  const handler = createVercelHandler(() => {
    const error = new Error("Missing API environment variables: OPENAI_API_KEY");
    error.statusCode = 500;
    throw error;
  });
  const response = createMockResponse();

  handler({ method: "GET", url: "/api/conversations", headers: {} }, response);

  assert.equal(response.statusCode, 500);
  assert.equal(response.headers["content-type"], "application/json; charset=utf-8");
  assert.deepEqual(JSON.parse(response.body), {
    error: "Missing API environment variables: OPENAI_API_KEY",
  });
});

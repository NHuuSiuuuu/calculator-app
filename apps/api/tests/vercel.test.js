import assert from "node:assert/strict";
import { access, readFile } from "node:fs/promises";
import test from "node:test";

const vercelApiUrl = new URL("../../../api/[...path].js", import.meta.url);

test("root Vercel catch-all API function is available for /api routes", async () => {
  await access(vercelApiUrl);

  const source = await readFile(vercelApiUrl, "utf8");
  assert.match(source, /createProductionApiServer/);
  assert.match(source, /server\.emit\("request", request, response\)/);
});

import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("Vite root page mounts the React app", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

  assert.match(html, /<div id="root"><\/div>/);
  assert.match(html, /src="\/src\/main\.jsx"/);
});

test("README documents React auth deployment environment", () => {
  const readme = readFileSync(new URL("../../../README.md", import.meta.url), "utf8");

  assert.match(readme, /apps\/web/);
  assert.match(readme, /VITE_SUPABASE_URL/);
  assert.match(readme, /VITE_SUPABASE_ANON_KEY/);
});

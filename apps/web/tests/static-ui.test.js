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

test("Supabase migration upgrades existing todos to user-owned RLS", () => {
  const sql = readFileSync(
    new URL("../../../supabase/migrations/0001_user_owned_todos.sql", import.meta.url),
    "utf8",
  );

  assert.match(sql, /add column if not exists user_id uuid references auth\.users\(id\)/i);
  assert.match(sql, /delete from public\.todos\s+where user_id is null/i);
  assert.match(sql, /alter column user_id set not null/i);
  assert.match(sql, /alter table public\.todos enable row level security/i);
  assert.match(sql, /revoke all privileges on public\.todos from anon/i);
  assert.match(sql, /grant select, delete on public\.todos to authenticated/i);
  assert.doesNotMatch(sql, /create policy[\s\S]*?\bto anon\b/i);

  for (const operation of ["select", "insert", "update", "delete"]) {
    assert.match(sql, new RegExp(`for ${operation}[\\s\\S]*?to authenticated`, "i"));
    assert.match(sql, new RegExp(`for ${operation}[\\s\\S]*?auth\\.uid\\(\\)`, "i"));
  }
});

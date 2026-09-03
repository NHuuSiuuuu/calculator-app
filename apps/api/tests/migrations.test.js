import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL("../../../supabase/migrations/0002_ai_rag_support.sql", import.meta.url);
const userScopeMigrationUrl = new URL("../../../supabase/migrations/0003_user_scoped_support_documents.sql", import.meta.url);

test("RAG migration upgrades an existing profiles table with an idempotent role column", async () => {
  const sql = await readFile(migrationUrl, "utf8");

  assert.match(
    sql,
    /alter table public\.profiles\s+add column if not exists role text not null default 'user'\s+check \(role in \('admin', 'user'\)\);/i,
  );
});

test("user-scoped support migration enforces owned documents and conversations", async () => {
  const sql = await readFile(userScopeMigrationUrl, "utf8");

  assert.match(sql, /delete from public\.support_documents\s+where owner_id is null;/i);
  assert.match(sql, /alter table public\.support_documents\s+alter column owner_id set not null;/i);
  assert.match(sql, /alter table public\.support_conversations\s+alter column user_id set not null;/i);
  assert.match(sql, /create or replace function public\.match_support_chunks_for_user/i);
  assert.match(sql, /match_owner_id uuid/i);
  assert.match(sql, /support_documents\.owner_id = match_owner_id/i);
});

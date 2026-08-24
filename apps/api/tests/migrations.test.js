import assert from "node:assert/strict";
import { readFile } from "node:fs/promises";
import test from "node:test";

const migrationUrl = new URL("../../../supabase/migrations/0002_ai_rag_support.sql", import.meta.url);

test("RAG migration upgrades an existing profiles table with an idempotent role column", async () => {
  const sql = await readFile(migrationUrl, "utf8");

  assert.match(
    sql,
    /alter table public\.profiles\s+add column if not exists role text not null default 'user'\s+check \(role in \('admin', 'user'\)\);/i,
  );
});

test("RAG migration allows anonymous demo support records", async () => {
  const sql = await readFile(migrationUrl, "utf8");

  assert.match(sql, /alter table public\.support_documents\s+alter column owner_id drop not null;/i);
  assert.match(sql, /alter table public\.support_conversations\s+alter column user_id drop not null;/i);
});

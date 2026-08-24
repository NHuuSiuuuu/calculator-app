# AI RAG Support System Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build an authenticated AI Support module that lets admins upload company text documents, stores vector embeddings, answers user questions from retrieved document chunks, and saves conversation history.

**Architecture:** Add a Node backend in `apps/api` for OpenAI and Supabase service-role operations, while keeping the React/Vite frontend in `apps/web`. Supabase Auth remains the identity source; Supabase Postgres with pgvector stores documents, chunks, conversations, and messages.

**Tech Stack:** React 19, Vite, Node HTTP server, `@supabase/supabase-js`, OpenAI API, Supabase Postgres, pgvector, Node test runner, Playwright.

**Spec:** `docs/superpowers/specs/2026-08-24-ai-rag-support-system-design.md`

## Global Constraints

- Browser never receives `OPENAI_API_KEY` or `SUPABASE_SERVICE_ROLE_KEY`.
- Frontend uses only `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, and user access tokens.
- Backend verifies Supabase JWT on every API request.
- Admin-only endpoints check `profiles.role = 'admin'`.
- Version 1 supports `.txt` and `.md` uploads only.
- Version 1 uses `text-embedding-3-small` and `extensions.vector(1536)`.
- If retrieval returns no chunks above threshold, the answer must say it cannot answer from uploaded company documents.
- Existing calculator, auth, and todo behavior must remain unchanged.

---

## File Structure

- Create `apps/api/package.json`: API workspace scripts and dependencies.
- Create `apps/api/src/config.js`: reads backend environment variables and exposes validated config.
- Create `apps/api/src/http.js`: Node HTTP server factory and route dispatcher.
- Create `apps/api/src/auth.js`: bearer-token extraction, Supabase user lookup, profile role lookup.
- Create `apps/api/src/chunkText.js`: deterministic text chunking with overlap.
- Create `apps/api/src/openaiClient.js`: embedding and chat wrappers around OpenAI HTTP calls.
- Create `apps/api/src/ragPrompt.js`: grounded prompt builder and empty-context response.
- Create `apps/api/src/repositories/supportRepository.js`: Supabase database operations for documents, chunks, conversations, and messages.
- Create `apps/api/src/routes/documents.js`: document upload/list API handlers.
- Create `apps/api/src/routes/chat.js`: chat/history API handlers.
- Create `apps/api/src/server.js`: production server entrypoint.
- Create `apps/api/tests/*.test.js`: unit and route tests with mocked dependencies.
- Modify `package.json`: add `apps/api` workspace and API test script.
- Modify `supabase/migrations/0001_user_owned_todos.sql`: add `profiles.role`.
- Create `supabase/migrations/0002_ai_rag_support.sql`: pgvector schema and RLS.
- Modify `apps/web/src/App.jsx`: add `AI Support` tab and pass session.
- Create `apps/web/src/features/support/AiSupportPanel.jsx`: user chat, conversation history, admin document upload/list.
- Create `apps/web/src/features/support/supportApi.js`: frontend API client for backend calls.
- Create `apps/web/tests/supportApi.test.js`: frontend API client tests.
- Modify `apps/web/tests/browser.spec.js`: add AI Support e2e coverage with mocked backend.
- Modify `apps/web/src/App.css`: support UI layout and responsive states.
- Modify `README.md`, `docs/PROJECT_STATUS.md`, and `docs/wiki/Home.md`: setup and feature documentation.

---

### Task 1: Workspace And Database Foundation

**Files:**
- Modify: `package.json`
- Modify: `supabase/migrations/0001_user_owned_todos.sql`
- Create: `supabase/migrations/0002_ai_rag_support.sql`
- Create: `apps/api/package.json`

**Interfaces:**
- Produces SQL objects used later:
  - `public.profiles.role text`
  - `public.support_documents`
  - `public.support_document_chunks`
  - `public.support_conversations`
  - `public.support_messages`
  - `public.match_support_chunks(query_embedding extensions.vector(1536), match_threshold float, match_count int)`
- Produces root workspace script:
  - `npm run test:api`

- [ ] **Step 1: Update workspace metadata**

Patch root `package.json` so `workspaces` includes both apps and API tests can run independently:

```json
{
  "workspaces": [
    "apps/web",
    "apps/api"
  ],
  "scripts": {
    "dev": "npm --workspace @calculator-app/web run dev",
    "build": "npm --workspace @calculator-app/web run build",
    "test": "npm --workspace @calculator-app/web test && npm run test:api",
    "test:web": "npm --workspace @calculator-app/web test",
    "test:api": "npm --workspace @calculator-app/api test",
    "test:e2e": "npm --workspace @calculator-app/web run test:e2e"
  }
}
```

- [ ] **Step 2: Add API package**

Create `apps/api/package.json`:

```json
{
  "name": "@calculator-app/api",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "node --watch src/server.js",
    "start": "node src/server.js",
    "test": "node --test tests/*.test.js"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.56.0"
  }
}
```

- [ ] **Step 3: Extend profiles with roles**

Patch `supabase/migrations/0001_user_owned_todos.sql` after the `profiles` table creation:

```sql
alter table public.profiles
add column if not exists role text not null default 'user'
check (role in ('admin', 'user'));
```

- [ ] **Step 4: Create RAG migration**

Create `supabase/migrations/0002_ai_rag_support.sql` with:

```sql
create extension if not exists "pgcrypto";
create extension if not exists vector with schema extensions;

create table if not exists public.support_documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  filename text not null check (char_length(btrim(filename)) between 1 and 180),
  content_type text not null check (content_type in ('text/plain', 'text/markdown')),
  status text not null default 'processing' check (status in ('processing', 'ready', 'failed')),
  chunk_count integer not null default 0 check (chunk_count >= 0),
  error_message text,
  created_at timestamptz not null default now()
);

create table if not exists public.support_document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.support_documents(id) on delete cascade,
  chunk_index integer not null check (chunk_index >= 0),
  content text not null check (char_length(btrim(content)) > 0),
  token_estimate integer not null check (token_estimate > 0),
  embedding extensions.vector(1536) not null,
  created_at timestamptz not null default now(),
  unique (document_id, chunk_index)
);

create index if not exists support_document_chunks_embedding_idx
on public.support_document_chunks
using ivfflat (embedding vector_cosine_ops)
with (lists = 100);

create table if not exists public.support_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.support_conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(btrim(content)) > 0),
  retrieved_chunk_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

drop trigger if exists set_support_conversations_updated_at on public.support_conversations;
create trigger set_support_conversations_updated_at
before update on public.support_conversations
for each row
execute function public.set_updated_at();

create or replace function public.match_support_chunks(
  query_embedding extensions.vector(1536),
  match_threshold float,
  match_count int
)
returns table (
  chunk_id uuid,
  document_id uuid,
  content text,
  filename text,
  similarity float
)
language sql
stable
as $$
  select
    support_document_chunks.id as chunk_id,
    support_document_chunks.document_id,
    support_document_chunks.content,
    support_documents.filename,
    1 - (support_document_chunks.embedding <=> query_embedding) as similarity
  from public.support_document_chunks
  join public.support_documents
    on support_documents.id = support_document_chunks.document_id
  where support_documents.status = 'ready'
    and 1 - (support_document_chunks.embedding <=> query_embedding) >= match_threshold
  order by support_document_chunks.embedding <=> query_embedding
  limit least(match_count, 8);
$$;

alter table public.support_documents enable row level security;
alter table public.support_document_chunks enable row level security;
alter table public.support_conversations enable row level security;
alter table public.support_messages enable row level security;

revoke all privileges on public.support_documents from anon, authenticated;
revoke all privileges on public.support_document_chunks from anon, authenticated;
revoke all privileges on public.support_conversations from anon, authenticated;
revoke all privileges on public.support_messages from anon, authenticated;

grant select on public.support_conversations to authenticated;
grant select on public.support_messages to authenticated;

drop policy if exists "users can read own support conversations" on public.support_conversations;
drop policy if exists "users can read own support messages" on public.support_messages;

create policy "users can read own support conversations"
on public.support_conversations
for select
to authenticated
using (user_id = auth.uid());

create policy "users can read own support messages"
on public.support_messages
for select
to authenticated
using (
  exists (
    select 1
    from public.support_conversations
    where support_conversations.id = support_messages.conversation_id
      and support_conversations.user_id = auth.uid()
  )
);
```

- [ ] **Step 5: Install workspace dependencies**

Run:

```bash
npm install
```

Expected: `package-lock.json` updates and includes `apps/api`.

- [ ] **Step 6: Verify baseline**

Run:

```bash
npm test
npm run build
```

Expected: web tests pass, API test command initially reports no matching test files only if Task 2 has not started. If Node treats empty test glob as failure, add a one-line smoke test in Task 2 before making `npm test` required.

- [ ] **Step 7: Commit**

```bash
git add package.json package-lock.json apps/api/package.json supabase/migrations/0001_user_owned_todos.sql supabase/migrations/0002_ai_rag_support.sql
git commit -m "Add RAG workspace and database schema"
```

---

### Task 2: API Core Utilities

**Files:**
- Create: `apps/api/src/config.js`
- Create: `apps/api/src/chunkText.js`
- Create: `apps/api/src/ragPrompt.js`
- Create: `apps/api/src/openaiClient.js`
- Create: `apps/api/tests/chunkText.test.js`
- Create: `apps/api/tests/ragPrompt.test.js`
- Create: `apps/api/tests/config.test.js`

**Interfaces:**
- Produces `readApiConfig(env: object): ApiConfig`
- Produces `chunkText(text: string, options?: { maxChars?: number, overlapChars?: number }): Array<{ content: string, tokenEstimate: number }>`
- Produces `buildGroundedPrompt(message: string, chunks: RetrievedChunk[]): { system: string, user: string }`
- Produces `createOpenAiClient(config, fetchImpl): { createEmbedding(input: string): Promise<number[]>, createChatAnswer(messages): Promise<string> }`

- [ ] **Step 1: Write chunking tests**

Create `apps/api/tests/chunkText.test.js`:

```js
import assert from "node:assert/strict";
import test from "node:test";

import { chunkText } from "../src/chunkText.js";

test("chunkText splits long text with overlap and token estimate", () => {
  const text = "A".repeat(120) + "\n\n" + "B".repeat(120);
  const chunks = chunkText(text, { maxChars: 100, overlapChars: 20 });

  assert.ok(chunks.length >= 3);
  assert.equal(chunks[0].content.length <= 100, true);
  assert.equal(chunks[0].tokenEstimate, Math.ceil(chunks[0].content.length / 4));
  assert.equal(chunks[1].content.startsWith(chunks[0].content.slice(-20)), true);
});

test("chunkText ignores empty input after trimming", () => {
  assert.deepEqual(chunkText("   \n\n  "), []);
});
```

- [ ] **Step 2: Implement chunking**

Create `apps/api/src/chunkText.js`:

```js
export function chunkText(text, options = {}) {
  const maxChars = options.maxChars ?? 1200;
  const overlapChars = options.overlapChars ?? 180;
  const normalized = String(text ?? "").replace(/\r\n/g, "\n").replace(/[ \t]+/g, " ").trim();

  if (!normalized) {
    return [];
  }

  const chunks = [];
  let start = 0;

  while (start < normalized.length) {
    const hardEnd = Math.min(start + maxChars, normalized.length);
    const slice = normalized.slice(start, hardEnd);
    const breakAt = hardEnd < normalized.length
      ? Math.max(slice.lastIndexOf("\n\n"), slice.lastIndexOf(". "), slice.lastIndexOf("\n"))
      : -1;
    const end = breakAt > Math.floor(maxChars * 0.55) ? start + breakAt + 1 : hardEnd;
    const content = normalized.slice(start, end).trim();

    if (content) {
      chunks.push({
        content,
        tokenEstimate: Math.max(1, Math.ceil(content.length / 4)),
      });
    }

    if (end >= normalized.length) {
      break;
    }

    start = Math.max(0, end - overlapChars);
  }

  return chunks;
}
```

- [ ] **Step 3: Write prompt/config tests**

Create `apps/api/tests/ragPrompt.test.js`:

```js
import assert from "node:assert/strict";
import test from "node:test";

import { buildGroundedPrompt, createNoContextAnswer } from "../src/ragPrompt.js";

test("buildGroundedPrompt includes only retrieved company chunks", () => {
  const prompt = buildGroundedPrompt("How do refunds work?", [
    { chunkId: "chunk-1", filename: "policy.md", content: "Refunds are allowed within 7 days.", similarity: 0.82 },
  ]);

  assert.match(prompt.system, /uploaded company documents/);
  assert.match(prompt.user, /How do refunds work\?/);
  assert.match(prompt.user, /policy\.md/);
  assert.match(prompt.user, /Refunds are allowed within 7 days/);
});

test("createNoContextAnswer is explicit about missing company context", () => {
  assert.match(createNoContextAnswer(), /không tìm thấy thông tin phù hợp/i);
});
```

Create `apps/api/tests/config.test.js`:

```js
import assert from "node:assert/strict";
import test from "node:test";

import { readApiConfig } from "../src/config.js";

test("readApiConfig normalizes API configuration", () => {
  const config = readApiConfig({
    OPENAI_API_KEY: "sk-test",
    OPENAI_EMBEDDING_MODEL: "",
    OPENAI_CHAT_MODEL: "",
    SUPABASE_URL: "https://demo.supabase.co/",
    SUPABASE_SERVICE_ROLE_KEY: "service-role",
    PORT: "5050",
  });

  assert.equal(config.openaiApiKey, "sk-test");
  assert.equal(config.embeddingModel, "text-embedding-3-small");
  assert.equal(config.chatModel, "gpt-4.1-mini");
  assert.equal(config.supabaseUrl, "https://demo.supabase.co");
  assert.equal(config.port, 5050);
});
```

- [ ] **Step 4: Implement config and prompt builder**

Create `apps/api/src/config.js`:

```js
export function readApiConfig(env = process.env) {
  return {
    openaiApiKey: String(env.OPENAI_API_KEY ?? ""),
    embeddingModel: String(env.OPENAI_EMBEDDING_MODEL || "text-embedding-3-small"),
    chatModel: String(env.OPENAI_CHAT_MODEL || "gpt-4.1-mini"),
    supabaseUrl: String(env.SUPABASE_URL ?? "").replace(/\/+$/, ""),
    supabaseServiceRoleKey: String(env.SUPABASE_SERVICE_ROLE_KEY ?? ""),
    port: Number.parseInt(String(env.PORT ?? "8787"), 10),
  };
}

export function requireApiConfig(config) {
  const missing = [];
  if (!config.openaiApiKey) missing.push("OPENAI_API_KEY");
  if (!config.supabaseUrl) missing.push("SUPABASE_URL");
  if (!config.supabaseServiceRoleKey) missing.push("SUPABASE_SERVICE_ROLE_KEY");

  if (missing.length > 0) {
    const error = new Error(`Missing API environment variables: ${missing.join(", ")}`);
    error.statusCode = 500;
    throw error;
  }
}
```

Create `apps/api/src/ragPrompt.js`:

```js
export function createNoContextAnswer() {
  return "Em không tìm thấy thông tin phù hợp trong tài liệu công ty đã upload, nên chưa thể trả lời chắc chắn câu hỏi này.";
}

export function buildGroundedPrompt(message, chunks) {
  const context = chunks.map((chunk, index) => (
    `Nguồn ${index + 1}: ${chunk.filename}\n${chunk.content}`
  )).join("\n\n---\n\n");

  return {
    system: [
      "You are an internal customer support assistant.",
      "Answer only from the uploaded company documents provided in the context.",
      "If the context is insufficient, say you cannot find the answer in the company documents.",
      "Keep the answer concise and practical.",
    ].join(" "),
    user: `Company context:\n${context}\n\nUser question:\n${message}`,
  };
}
```

- [ ] **Step 5: Implement OpenAI client wrapper**

Create `apps/api/src/openaiClient.js`:

```js
export function createOpenAiClient(config, fetchImpl = globalThis.fetch) {
  async function request(path, body) {
    const response = await fetchImpl(`https://api.openai.com/v1/${path}`, {
      method: "POST",
      headers: {
        "authorization": `Bearer ${config.openaiApiKey}`,
        "content-type": "application/json",
      },
      body: JSON.stringify(body),
    });

    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      const error = new Error(payload.error?.message ?? `OpenAI request failed with ${response.status}`);
      error.statusCode = 502;
      throw error;
    }

    return payload;
  }

  return {
    async createEmbedding(input) {
      const payload = await request("embeddings", {
        model: config.embeddingModel,
        input,
      });
      return payload.data[0].embedding;
    },

    async createChatAnswer(messages) {
      const payload = await request("chat/completions", {
        model: config.chatModel,
        messages,
        temperature: 0.2,
      });
      return payload.choices[0].message.content;
    },
  };
}
```

- [ ] **Step 6: Run tests**

Run:

```bash
npm run test:api
npm test
```

Expected: new API utility tests pass and existing web tests still pass.

- [ ] **Step 7: Commit**

```bash
git add apps/api/src apps/api/tests package.json package-lock.json
git commit -m "Add RAG API core utilities"
```

---

### Task 3: API Auth And Repository Layer

**Files:**
- Create: `apps/api/src/auth.js`
- Create: `apps/api/src/repositories/supportRepository.js`
- Create: `apps/api/tests/auth.test.js`
- Create: `apps/api/tests/supportRepository.test.js`

**Interfaces:**
- Produces `extractBearerToken(headers: Headers | object): string`
- Produces `createAuthService(supabase): { requireUser(request): Promise<AuthUser>, requireAdmin(request): Promise<AuthUser> }`
- Produces `createSupportRepository(supabase)` with methods:
  - `createDocument({ ownerId, filename, contentType }): Promise<DocumentRow>`
  - `markDocumentReady(documentId, chunkCount): Promise<void>`
  - `markDocumentFailed(documentId, message): Promise<void>`
  - `insertChunks(documentId, chunksWithEmbeddings): Promise<ChunkRow[]>`
  - `listDocuments(): Promise<DocumentRow[]>`
  - `matchChunks(embedding, threshold, count): Promise<RetrievedChunk[]>`
  - `createConversation(userId, title): Promise<ConversationRow>`
  - `listConversations(userId): Promise<ConversationRow[]>`
  - `getMessages(userId, conversationId): Promise<MessageRow[]>`
  - `insertMessage({ conversationId, role, content, retrievedChunkIds }): Promise<MessageRow>`

- [ ] **Step 1: Write auth tests**

Create `apps/api/tests/auth.test.js`:

```js
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
```

- [ ] **Step 2: Implement auth service**

Create `apps/api/src/auth.js`:

```js
export function extractBearerToken(headers) {
  const value = headers?.get?.("authorization")
    ?? headers?.authorization
    ?? headers?.Authorization
    ?? "";
  const match = String(value).match(/^Bearer\s+(.+)$/i);
  return match ? match[1] : "";
}

function httpError(message, statusCode) {
  const error = new Error(message);
  error.statusCode = statusCode;
  return error;
}

export function createAuthService(supabase) {
  async function requireUser(request) {
    const token = extractBearerToken(request.headers);
    if (!token) {
      throw httpError("Missing bearer token", 401);
    }

    const { data, error } = await supabase.auth.getUser(token);
    if (error || !data?.user) {
      throw httpError("Invalid bearer token", 401);
    }

    return {
      id: data.user.id,
      email: data.user.email,
      token,
    };
  }

  async function requireAdmin(request) {
    const user = await requireUser(request);
    const { data, error } = await supabase
      .from("profiles")
      .select("role")
      .eq("id", user.id)
      .single();

    if (error || data?.role !== "admin") {
      throw httpError("Admin role required", 403);
    }

    return { ...user, role: "admin" };
  }

  return { requireUser, requireAdmin };
}
```

- [ ] **Step 3: Write repository tests with a fake Supabase client**

Create `apps/api/tests/supportRepository.test.js`:

```js
import assert from "node:assert/strict";
import test from "node:test";

import { createSupportRepository } from "../src/repositories/supportRepository.js";

test("repository creates conversations scoped to a user", async () => {
  const calls = [];
  const repository = createSupportRepository({
    from(table) {
      return {
        insert(row) {
          calls.push(["insert", table, row]);
          return {
            select() { return this; },
            single() {
              return Promise.resolve({ data: { id: "conv-1", ...row }, error: null });
            },
          };
        },
      };
    },
  });

  const conversation = await repository.createConversation("user-1", "Question title");

  assert.equal(conversation.id, "conv-1");
  assert.deepEqual(calls[0], ["insert", "support_conversations", { user_id: "user-1", title: "Question title" }]);
});

test("repository maps vector matches into source objects", async () => {
  const repository = createSupportRepository({
    rpc(name, args) {
      assert.equal(name, "match_support_chunks");
      assert.equal(args.match_count, 5);
      return Promise.resolve({
        data: [{
          chunk_id: "chunk-1",
          document_id: "doc-1",
          content: "Return within 7 days.",
          filename: "policy.md",
          similarity: 0.9,
        }],
        error: null,
      });
    },
  });

  const chunks = await repository.matchChunks([0.1, 0.2], 0.75, 5);

  assert.deepEqual(chunks, [{
    chunkId: "chunk-1",
    documentId: "doc-1",
    content: "Return within 7 days.",
    filename: "policy.md",
    similarity: 0.9,
  }]);
});
```

- [ ] **Step 4: Implement repository**

Create `apps/api/src/repositories/supportRepository.js`:

```js
function raiseIfError(error) {
  if (error) {
    throw new Error(error.message ?? "Supabase request failed");
  }
}

function selectSingle(query) {
  return query.select("*").single();
}

export function createSupportRepository(supabase) {
  return {
    async createDocument({ ownerId, filename, contentType }) {
      const { data, error } = await selectSingle(supabase.from("support_documents").insert({
        owner_id: ownerId,
        filename,
        content_type: contentType,
        status: "processing",
      }));
      raiseIfError(error);
      return data;
    },

    async markDocumentReady(documentId, chunkCount) {
      const { error } = await supabase.from("support_documents")
        .update({ status: "ready", chunk_count: chunkCount, error_message: null })
        .eq("id", documentId);
      raiseIfError(error);
    },

    async markDocumentFailed(documentId, message) {
      const { error } = await supabase.from("support_documents")
        .update({ status: "failed", error_message: String(message).slice(0, 240) })
        .eq("id", documentId);
      raiseIfError(error);
    },

    async insertChunks(documentId, chunksWithEmbeddings) {
      const rows = chunksWithEmbeddings.map((chunk, index) => ({
        document_id: documentId,
        chunk_index: index,
        content: chunk.content,
        token_estimate: chunk.tokenEstimate,
        embedding: chunk.embedding,
      }));
      const { data, error } = await supabase.from("support_document_chunks").insert(rows).select("*");
      raiseIfError(error);
      return data;
    },

    async listDocuments() {
      const { data, error } = await supabase.from("support_documents")
        .select("*")
        .order("created_at", { ascending: false });
      raiseIfError(error);
      return data;
    },

    async matchChunks(embedding, threshold = 0.74, count = 5) {
      const { data, error } = await supabase.rpc("match_support_chunks", {
        query_embedding: embedding,
        match_threshold: threshold,
        match_count: count,
      });
      raiseIfError(error);
      return data.map((row) => ({
        chunkId: row.chunk_id,
        documentId: row.document_id,
        content: row.content,
        filename: row.filename,
        similarity: row.similarity,
      }));
    },

    async createConversation(userId, title) {
      const { data, error } = await selectSingle(supabase.from("support_conversations").insert({
        user_id: userId,
        title: title.slice(0, 120),
      }));
      raiseIfError(error);
      return data;
    },

    async listConversations(userId) {
      const { data, error } = await supabase.from("support_conversations")
        .select("*")
        .eq("user_id", userId)
        .order("updated_at", { ascending: false });
      raiseIfError(error);
      return data;
    },

    async getMessages(userId, conversationId) {
      const { data: conversation, error: conversationError } = await supabase.from("support_conversations")
        .select("id")
        .eq("id", conversationId)
        .eq("user_id", userId)
        .single();
      raiseIfError(conversationError);
      if (!conversation) {
        return [];
      }

      const { data, error } = await supabase.from("support_messages")
        .select("*")
        .eq("conversation_id", conversationId)
        .order("created_at", { ascending: true });
      raiseIfError(error);
      return data;
    },

    async insertMessage({ conversationId, role, content, retrievedChunkIds = [] }) {
      const { data, error } = await selectSingle(supabase.from("support_messages").insert({
        conversation_id: conversationId,
        role,
        content,
        retrieved_chunk_ids: retrievedChunkIds,
      }));
      raiseIfError(error);
      return data;
    },
  };
}
```

- [ ] **Step 5: Run tests**

Run:

```bash
npm run test:api
npm test
```

Expected: auth/repository tests pass and previous tests remain green.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src apps/api/tests
git commit -m "Add support API auth and repository layer"
```

---

### Task 4: Document Upload And Chat API

**Files:**
- Create: `apps/api/src/http.js`
- Create: `apps/api/src/routes/documents.js`
- Create: `apps/api/src/routes/chat.js`
- Create: `apps/api/src/server.js`
- Create: `apps/api/tests/routes.test.js`

**Interfaces:**
- Produces `createApiServer({ authService, repository, openAiClient, config }): http.Server`
- Produces endpoints:
  - `POST /api/documents/upload`
  - `GET /api/documents`
  - `POST /api/chat`
  - `GET /api/conversations`
  - `GET /api/conversations/:id/messages`

- [ ] **Step 1: Write route tests**

Create `apps/api/tests/routes.test.js`:

```js
import assert from "node:assert/strict";
import test from "node:test";

import { handleChatRequest } from "../src/routes/chat.js";
import { handleDocumentUpload } from "../src/routes/documents.js";

test("handleDocumentUpload chunks text, embeds chunks, and marks document ready", async () => {
  const calls = [];
  const result = await handleDocumentUpload({
    user: { id: "admin-1" },
    file: { filename: "handbook.md", contentType: "text/markdown", text: "Refunds are allowed within 7 days.".repeat(20) },
    repository: {
      async createDocument(input) {
        calls.push(["createDocument", input]);
        return { id: "doc-1" };
      },
      async insertChunks(_documentId, chunks) {
        calls.push(["insertChunks", chunks.length]);
        return chunks.map((chunk, index) => ({ id: `chunk-${index + 1}`, ...chunk }));
      },
      async markDocumentReady(documentId, chunkCount) {
        calls.push(["markDocumentReady", documentId, chunkCount]);
      },
      async markDocumentFailed() {
        throw new Error("should not fail");
      },
    },
    openAiClient: {
      async createEmbedding() {
        return Array.from({ length: 1536 }, () => 0.01);
      },
    },
  });

  assert.equal(result.documentId, "doc-1");
  assert.equal(result.status, "ready");
  assert.ok(result.chunkCount > 0);
  assert.equal(calls[0][0], "createDocument");
  assert.equal(calls.at(-1)[0], "markDocumentReady");
});

test("handleChatRequest stores messages and returns sources", async () => {
  const messages = [];
  const result = await handleChatRequest({
    user: { id: "user-1" },
    body: { message: "What is the refund window?" },
    repository: {
      async createConversation() {
        return { id: "conv-1" };
      },
      async insertMessage(message) {
        messages.push(message);
        return { id: `msg-${messages.length}`, ...message };
      },
      async matchChunks() {
        return [{ chunkId: "chunk-1", filename: "policy.md", content: "Refunds are allowed within 7 days.", similarity: 0.88 }];
      },
    },
    openAiClient: {
      async createEmbedding() {
        return Array.from({ length: 1536 }, () => 0.02);
      },
      async createChatAnswer() {
        return "Refunds are allowed within 7 days.";
      },
    },
  });

  assert.equal(result.conversationId, "conv-1");
  assert.equal(result.answer, "Refunds are allowed within 7 days.");
  assert.deepEqual(result.sources, [{ chunkId: "chunk-1", filename: "policy.md", similarity: 0.88 }]);
  assert.equal(messages[0].role, "user");
  assert.equal(messages[1].role, "assistant");
});
```

- [ ] **Step 2: Implement route domain handlers**

Create `apps/api/src/routes/documents.js`:

```js
import { chunkText } from "../chunkText.js";

const ALLOWED_TYPES = new Set(["text/plain", "text/markdown"]);

export async function handleDocumentUpload({ user, file, repository, openAiClient }) {
  if (!ALLOWED_TYPES.has(file.contentType)) {
    const error = new Error("Only .txt and .md files are supported");
    error.statusCode = 400;
    throw error;
  }

  const document = await repository.createDocument({
    ownerId: user.id,
    filename: file.filename,
    contentType: file.contentType,
  });

  try {
    const chunks = chunkText(file.text);
    if (chunks.length === 0) {
      throw new Error("Uploaded document is empty");
    }

    const chunksWithEmbeddings = [];
    for (const chunk of chunks) {
      chunksWithEmbeddings.push({
        ...chunk,
        embedding: await openAiClient.createEmbedding(chunk.content),
      });
    }

    await repository.insertChunks(document.id, chunksWithEmbeddings);
    await repository.markDocumentReady(document.id, chunksWithEmbeddings.length);

    return { documentId: document.id, status: "ready", chunkCount: chunksWithEmbeddings.length };
  } catch (error) {
    await repository.markDocumentFailed(document.id, error.message);
    throw error;
  }
}
```

Create `apps/api/src/routes/chat.js`:

```js
import { buildGroundedPrompt, createNoContextAnswer } from "../ragPrompt.js";

function titleFromMessage(message) {
  return message.trim().replace(/\s+/g, " ").slice(0, 80);
}

export async function handleChatRequest({ user, body, repository, openAiClient }) {
  const message = String(body.message ?? "").trim();
  if (!message) {
    const error = new Error("Message is required");
    error.statusCode = 400;
    throw error;
  }

  const conversation = body.conversationId
    ? { id: body.conversationId }
    : await repository.createConversation(user.id, titleFromMessage(message));

  await repository.insertMessage({
    conversationId: conversation.id,
    role: "user",
    content: message,
  });

  const queryEmbedding = await openAiClient.createEmbedding(message);
  const chunks = await repository.matchChunks(queryEmbedding, 0.74, 5);
  const answer = chunks.length === 0
    ? createNoContextAnswer()
    : await openAiClient.createChatAnswer([
      { role: "system", content: buildGroundedPrompt(message, chunks).system },
      { role: "user", content: buildGroundedPrompt(message, chunks).user },
    ]);

  await repository.insertMessage({
    conversationId: conversation.id,
    role: "assistant",
    content: answer,
    retrievedChunkIds: chunks.map((chunk) => chunk.chunkId),
  });

  return {
    conversationId: conversation.id,
    answer,
    sources: chunks.map((chunk) => ({
      chunkId: chunk.chunkId,
      filename: chunk.filename,
      similarity: chunk.similarity,
    })),
  };
}
```

- [ ] **Step 3: Implement HTTP server**

Create `apps/api/src/http.js` with JSON helpers, CORS headers, multipart parsing for one `file` field, route dispatch, and error responses. The dispatcher must call `authService.requireUser(request)` for chat/history and `authService.requireAdmin(request)` for document endpoints.

Use these response shapes:

```js
{ "error": "Message is required" }
{ "conversationId": "uuid", "answer": "text", "sources": [] }
{ "documentId": "uuid", "status": "ready", "chunkCount": 3 }
```

Create `apps/api/src/server.js`:

```js
import { createClient } from "@supabase/supabase-js";

import { createAuthService } from "./auth.js";
import { readApiConfig, requireApiConfig } from "./config.js";
import { createApiServer } from "./http.js";
import { createOpenAiClient } from "./openaiClient.js";
import { createSupportRepository } from "./repositories/supportRepository.js";

const config = readApiConfig();
requireApiConfig(config);

const supabase = createClient(config.supabaseUrl, config.supabaseServiceRoleKey, {
  auth: { persistSession: false },
});

const server = createApiServer({
  authService: createAuthService(supabase),
  repository: createSupportRepository(supabase),
  openAiClient: createOpenAiClient(config),
  config,
});

server.listen(config.port, () => {
  console.log(`AI Support API listening on ${config.port}`);
});
```

- [ ] **Step 4: Run route tests**

Run:

```bash
npm run test:api
```

Expected: route handler tests pass without real OpenAI or Supabase network calls.

- [ ] **Step 5: Run full verification**

Run:

```bash
npm test
npm run build
```

Expected: all unit tests pass and web build remains green.

- [ ] **Step 6: Commit**

```bash
git add apps/api/src apps/api/tests
git commit -m "Add RAG document and chat API"
```

---

### Task 5: Frontend AI Support Client And UI

**Files:**
- Modify: `apps/web/src/App.jsx`
- Modify: `apps/web/src/App.css`
- Create: `apps/web/src/features/support/supportApi.js`
- Create: `apps/web/src/features/support/AiSupportPanel.jsx`
- Create: `apps/web/tests/supportApi.test.js`

**Interfaces:**
- Produces `createSupportApi({ baseUrl, getAccessToken, fetchImpl })`
- Produces `<AiSupportPanel session={session} />`

- [ ] **Step 1: Write frontend API client tests**

Create `apps/web/tests/supportApi.test.js`:

```js
import assert from "node:assert/strict";
import test from "node:test";

import { createSupportApi } from "../src/features/support/supportApi.js";

test("support API sends bearer token for chat", async () => {
  const calls = [];
  const api = createSupportApi({
    baseUrl: "https://api.example.com",
    getAccessToken: () => "access-token",
    fetchImpl: async (url, options) => {
      calls.push({ url, options });
      return {
        ok: true,
        async json() {
          return { conversationId: "conv-1", answer: "Answer", sources: [] };
        },
      };
    },
  });

  const result = await api.sendMessage({ message: "Hello" });

  assert.equal(result.answer, "Answer");
  assert.equal(calls[0].url, "https://api.example.com/api/chat");
  assert.equal(calls[0].options.headers.authorization, "Bearer access-token");
});
```

- [ ] **Step 2: Implement frontend API client**

Create `apps/web/src/features/support/supportApi.js`:

```js
function normalizeBaseUrl(baseUrl) {
  return String(baseUrl ?? "").replace(/\/+$/, "");
}

export function createSupportApi({ baseUrl = import.meta.env.VITE_SUPPORT_API_URL, getAccessToken, fetchImpl = globalThis.fetch }) {
  const root = normalizeBaseUrl(baseUrl);

  async function request(path, options = {}) {
    const token = getAccessToken();
    const response = await fetchImpl(`${root}${path}`, {
      ...options,
      headers: {
        ...(options.body instanceof FormData ? {} : { "content-type": "application/json" }),
        authorization: `Bearer ${token}`,
        ...(options.headers ?? {}),
      },
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok) {
      throw new Error(payload.error ?? `Request failed with ${response.status}`);
    }
    return payload;
  }

  return {
    sendMessage({ conversationId, message }) {
      return request("/api/chat", {
        method: "POST",
        body: JSON.stringify({ conversationId, message }),
      });
    },
    listConversations() {
      return request("/api/conversations");
    },
    listMessages(conversationId) {
      return request(`/api/conversations/${conversationId}/messages`);
    },
    listDocuments() {
      return request("/api/documents");
    },
    uploadDocument(file) {
      const formData = new FormData();
      formData.set("file", file);
      return request("/api/documents/upload", {
        method: "POST",
        body: formData,
      });
    },
  };
}
```

- [ ] **Step 3: Add AI Support tab shell**

Modify `apps/web/src/App.jsx`:

```jsx
import { AiSupportPanel } from "./features/support/AiSupportPanel.jsx";
```

Add a third tab button named `AI Support`, then render:

```jsx
<section
  id="panel-support"
  className={`support-panel app-panel${activeTab === "support" ? " is-active" : ""}`}
  role="tabpanel"
  aria-labelledby="tab-support"
  hidden={activeTab !== "support"}
>
  <AiSupportPanel session={session} />
</section>
```

Change `.app-tabs` in CSS to:

```css
.app-tabs {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 8px;
  margin-bottom: 10px;
}
```

- [ ] **Step 4: Implement support panel**

Create `apps/web/src/features/support/AiSupportPanel.jsx` with these UI states:

```jsx
export function AiSupportPanel({ session, supportApi }) {
  // state: conversations, messages, input, documents, selectedConversationId,
  // isSending, isUploading, error, statusMessage
}
```

Required visible copy:

```text
AI Support
Hỏi theo tài liệu công ty
Đăng nhập để dùng AI Support.
Cuộc trò chuyện
Tài liệu công ty
Upload .txt hoặc .md
Nguồn:
```

Behavior:

- If `session` is null, show `Đăng nhập để dùng AI Support.` and no chat input.
- User can type a message and submit.
- On submit, append the user message immediately, call `supportApi.sendMessage`, then append assistant answer and source chips.
- Conversation list loads from `supportApi.listConversations`.
- Selecting a conversation loads `supportApi.listMessages(conversation.id)`.
- Admin document controls can be visible in v1 for all signed-in users, but upload failures from backend `403` must render as an error. Do not infer admin role on the frontend until profile role loading is implemented.

- [ ] **Step 5: Style AI Support as internal tool UI**

Append CSS selectors:

```css
.support-layout {
  display: grid;
  grid-template-columns: minmax(120px, 0.42fr) minmax(0, 1fr);
  gap: 14px;
}

.support-sidebar,
.support-chat,
.support-admin {
  border: 1px solid var(--color-border);
  border-radius: 8px;
  background: #ffffff;
}

.support-messages {
  display: grid;
  gap: 10px;
  min-height: 260px;
  max-height: 420px;
  overflow: auto;
}

.support-message {
  max-width: 88%;
  padding: 10px 12px;
  border-radius: 8px;
  background: var(--color-surface-subtle);
}

.support-message.is-user {
  justify-self: end;
  background: #dbeafe;
}

.support-sources {
  display: flex;
  flex-wrap: wrap;
  gap: 6px;
}

@media (max-width: 720px) {
  .support-layout {
    grid-template-columns: 1fr;
  }
}
```

- [ ] **Step 6: Run frontend tests and build**

Run:

```bash
npm --workspace @calculator-app/web test
npm run build
```

Expected: support API client tests pass and Vite build succeeds.

- [ ] **Step 7: Commit**

```bash
git add apps/web/src apps/web/tests
git commit -m "Add AI Support frontend"
```

---

### Task 6: E2E Coverage, Docs, And Deployment Notes

**Files:**
- Modify: `apps/web/tests/browser.spec.js`
- Modify: `README.md`
- Modify: `docs/PROJECT_STATUS.md`
- Modify: `docs/wiki/Home.md`

**Interfaces:**
- Verifies browser flow through mocked `window.fetch`.
- Documents required environment variables:
  - frontend: `VITE_SUPPORT_API_URL`
  - backend: `OPENAI_API_KEY`, `OPENAI_EMBEDDING_MODEL`, `OPENAI_CHAT_MODEL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

- [ ] **Step 1: Add signed-out AI Support e2e**

Append to `apps/web/tests/browser.spec.js`:

```js
test("signed-out users cannot use AI Support", async ({ page }) => {
  await page.addInitScript(() => {
    window.APP_SUPABASE_CLIENT = {
      auth: {
        async getSession() {
          return { data: { session: null }, error: null };
        },
        onAuthStateChange() {
          return { data: { subscription: { unsubscribe() {} } } };
        },
      },
    };
  });

  await page.goto("/");
  await page.getByRole("tab", { name: "AI Support" }).click();

  await expect(page.getByText("Đăng nhập để dùng AI Support.")).toBeVisible();
});
```

- [ ] **Step 2: Add signed-in AI Support e2e with mocked backend**

Append:

```js
test("signed-in users can chat with AI Support and see sources", async ({ page }) => {
  await page.addInitScript(() => {
    const session = {
      access_token: "support-token",
      user: { id: "user-1", email: "support@example.com" },
    };

    window.APP_SUPABASE_CLIENT = {
      auth: {
        async getSession() {
          return { data: { session }, error: null };
        },
        onAuthStateChange() {
          return { data: { subscription: { unsubscribe() {} } } };
        },
      },
    };

    window.fetch = async (url, options) => {
      if (String(url).endsWith("/api/conversations")) {
        return { ok: true, json: async () => [] };
      }
      if (String(url).endsWith("/api/documents")) {
        return { ok: true, json: async () => [{ id: "doc-1", filename: "policy.md", status: "ready", chunk_count: 2 }] };
      }
      if (String(url).endsWith("/api/chat")) {
        return {
          ok: true,
          json: async () => ({
            conversationId: "conv-1",
            answer: "Chính sách hoàn tiền là 7 ngày.",
            sources: [{ chunkId: "chunk-1", filename: "policy.md", similarity: 0.88 }],
          }),
        };
      }
      return { ok: true, json: async () => [] };
    };
  });

  await page.goto("/");
  await page.getByRole("tab", { name: "AI Support" }).click();
  await page.getByLabel("Câu hỏi").fill("Chính sách hoàn tiền thế nào?");
  await page.getByRole("button", { name: "Gửi" }).click();

  await expect(page.getByText("Chính sách hoàn tiền là 7 ngày.")).toBeVisible();
  await expect(page.getByText("policy.md")).toBeVisible();
});
```

- [ ] **Step 3: Update README**

Add an `AI Support RAG Setup` section:

```md
## AI Support RAG Setup

The AI Support feature uses a backend API so OpenAI and Supabase service-role secrets never reach the browser.

Frontend environment:

```bash
VITE_SUPPORT_API_URL=https://your-api-host.example.com
```

Backend environment:

```bash
OPENAI_API_KEY=sk-...
OPENAI_EMBEDDING_MODEL=text-embedding-3-small
OPENAI_CHAT_MODEL=gpt-4.1-mini
SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
```

Run the RAG migration in Supabase SQL Editor:

```text
supabase/migrations/0002_ai_rag_support.sql
```

Set an admin user by updating their profile role:

```sql
update public.profiles
set role = 'admin'
where email = 'admin@example.com';
```
```

- [ ] **Step 4: Update project status and wiki**

Add a short entry to `docs/PROJECT_STATUS.md`:

```md
## AI Support RAG

- Branch: `feature/ai-rag-support-system`
- Status: planned implementation
- Scope: authenticated chat, admin `.txt/.md` uploads, OpenAI embeddings, Supabase pgvector search, conversation history
```

Add a matching wiki note to `docs/wiki/Home.md`.

- [ ] **Step 5: Run full verification**

Run:

```bash
npm test
npm run test:e2e
npm run build
```

Expected:

- Unit tests pass for web and API.
- Playwright confirms signed-out and signed-in AI Support states.
- Build succeeds.

- [ ] **Step 6: Commit**

```bash
git add apps/web/tests README.md docs/PROJECT_STATUS.md docs/wiki/Home.md
git commit -m "Document and verify AI Support RAG"
```

---

## Final Verification

After all tasks are complete, run:

```bash
npm test
npm run test:e2e
npm run build
git status --short --branch
```

Expected:

- `npm test` passes web and API unit tests.
- `npm run test:e2e` passes desktop/mobile browser tests.
- `npm run build` produces the web app successfully.
- Git status shows `## feature/ai-rag-support-system` with no uncommitted changes.

Then push:

```bash
GIT_SSH_COMMAND='ssh -i /home/codexproxy/.ssh/calculator_app_deploy -o IdentitiesOnly=yes -o StrictHostKeyChecking=accept-new' git push
```

Open PR:

```text
https://github.com/NHuuSiuuuu/calculator-app/pull/new/feature/ai-rag-support-system
```

Check GitHub Actions and Vercel before merging.

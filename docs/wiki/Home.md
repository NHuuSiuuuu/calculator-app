# Calculator App Wiki

## Overview

Calculator App is a React + Vite productivity app with a calculator, an authenticated Supabase Todo List, and AI Support grounded in company documents.

Repository:

```text
https://github.com/NHuuSiuuuu/calculator-app
```

## Architecture

```text
Browser
→ React app in apps/web
├→ Supabase Auth and Postgres with RLS
└→ Node.js API in apps/api → Gemini and Supabase pgvector
```

AI Support RAG uses a custom Node.js API backend. Supabase Auth protects support conversations and documents, with every document library scoped to the signed-in user.

## AI Support RAG

- Branch: `feature/ai-rag-support-system`
- Status: implemented; final review fixes applied
- Scope: authenticated per-user chat, user-owned `.txt/.md` document management, Gemini embeddings, Supabase pgvector Top K retrieval, conversation history

RAG means:

```text
Retrieval -> Augmented prompt -> Generation
```

AI Support uses this flow:

```text
Load Documents
Chunking
Embedding
Store Vector DB
Embed question
Retriever gets Top K documents
LLM creates the answer from Context + Question
```

## Local Development

Install with `npm ci`, then run the two services in separate terminals:

```bash
# Terminal 1: backend variables must be exported first
npm run dev:api

# Terminal 2: apps/web/.env.local contains the Vite variables
npm run dev:web
```

Open:

```text
http://127.0.0.1:4173
```

## Verification

```bash
npm test
npm run test:e2e
npm run build
```

## Supabase

Run in order:

```text
supabase/migrations/0001_user_owned_todos.sql
supabase/migrations/0002_ai_rag_support.sql
supabase/migrations/0003_user_scoped_support_documents.sql
```

The migrations work for a new project and for earlier anonymous demos. Rows without an owner are removed before ownership is enforced.

Configure:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

Never expose service role keys, database passwords, or JWT secrets in frontend code.

## Vercel

Recommended settings:

- Framework Preset: `Vite`
- Root Directory: repository root with Output Directory `apps/web/dist`, or Root Directory `apps/web` with Output Directory `dist`
- Build Command: `npm run build`
- Environment: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `AI_PROVIDER=gemini`, `GEMINI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

The root and web-root catch-all API functions serve AI Support routes on the same domain. Do not set `VITE_SUPPORT_API_URL` on Vercel.

## Tracking

- Bugs/features: GitHub Issues
- Code review: Pull Requests
- CI: `.github/workflows/ci.yml`
- Project status: `docs/PROJECT_STATUS.md`
- AI Support rules: `docs/AI_SUPPORT_RULES.md`
- UI identity: `DESIGN.md`

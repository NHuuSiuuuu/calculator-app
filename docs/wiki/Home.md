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
└→ Node.js API in apps/api → OpenAI and Supabase pgvector
```

AI Support RAG uses a custom Node.js API backend. The current demo exposes AI Support without sign-in, while Supabase Auth and RLS still provide the user boundary for todos.

## AI Support RAG

- Branch: `feature/ai-rag-support-system`
- Status: implemented; final review fixes applied
- Scope: demo chat without sign-in, `.txt/.md` uploads, OpenAI embeddings, Supabase pgvector search, conversation history

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
```

The migration works for a new project and for the earlier anonymous Todo demo. Anonymous rows without `user_id` are removed before RLS ownership is enforced.

Configure:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

Never expose service role keys, database passwords, or JWT secrets in frontend code.

## Vercel

Recommended settings:

- Framework Preset: `Vite`
- Root Directory: repository root
- Build Command: `npm run build`
- Output Directory: `apps/web/dist`
- Environment: `VITE_SUPABASE_URL`, `VITE_SUPABASE_ANON_KEY`, `OPENAI_API_KEY`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`

The root `api/[...path].js` function serves AI Support routes on the same domain, so `VITE_SUPPORT_API_URL` can stay unset on Vercel.

## Tracking

- Bugs/features: GitHub Issues
- Code review: Pull Requests
- CI: `.github/workflows/ci.yml`
- Project status: `docs/PROJECT_STATUS.md`
- UI identity: `DESIGN.md`

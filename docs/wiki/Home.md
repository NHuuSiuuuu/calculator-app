# Calculator App Wiki

## Overview

Calculator App is a React + Vite productivity app with a calculator and an authenticated Supabase Todo List.

Repository:

```text
https://github.com/NHuuSiuuuu/calculator-app
```

## Architecture

```text
Browser
→ React app in apps/web
→ Supabase Auth
→ Supabase Postgres with RLS
```

There is no custom Node.js server yet. Supabase Auth and RLS provide the user boundary for todos.

## AI Support RAG

- Branch: `feature/ai-rag-support-system`
- Status: planned implementation
- Scope: authenticated chat, admin `.txt/.md` uploads, OpenAI embeddings, Supabase pgvector search, conversation history

## Local Development

```bash
npm ci
npm run dev
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

Run:

```text
supabase/migrations/0001_user_owned_todos.sql
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
- Root Directory: `apps/web`
- Build Command: `npm run build`
- Output Directory: `dist`

## Tracking

- Bugs/features: GitHub Issues
- Code review: Pull Requests
- CI: `.github/workflows/ci.yml`
- Project status: `docs/PROJECT_STATUS.md`
- UI identity: `DESIGN.md`

# Project Status

## Current State

- Project: Calculator App
- Repository: `https://github.com/NHuuSiuuuu/calculator-app`
- Active branch: `feature/ai-rag-support-system`
- App platform: React + Vite frontend with Node.js API
- Web app path: `apps/web`
- Database migrations path: `supabase/migrations`
- Recommended deploy targets: Vercel frontend and a Node.js API host

## AI Support RAG

- Branch: `feature/ai-rag-support-system`
- Status: implemented; final review fixes applied
- Scope: authenticated chat, admin `.txt/.md` uploads, OpenAI embeddings, Supabase pgvector search, conversation history

## Implemented

- Calculator tab ported to React
- Calculator unit tests preserved
- Supabase auth helpers for email/password sign up, sign in, session loading, and sign out
- User-owned Todo repository
- Supabase migration with `user_id`, existing-table upgrade handling, and RLS scoped to `auth.uid()`
- Auth-gated Todo UI
- Desktop/mobile Playwright coverage for calculator and auth-gated todos
- Authenticated AI Support chat with grounded OpenAI answers
- Admin `.txt` and `.md` ingestion with pgvector embeddings and status metadata
- User-owned conversation history with reconstructed source metadata and recency ordering

## Required Supabase Setup

Run these SQL files in order in Supabase SQL Editor:

```text
supabase/migrations/0001_user_owned_todos.sql
supabase/migrations/0002_ai_rag_support.sql
```

Set these frontend environment variables:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
VITE_SUPPORT_API_URL
```

The API also requires `OPENAI_API_KEY`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY`. Do not use service role keys or database passwords in frontend code.

If the database already contains todos from the earlier anonymous demo, the migration removes rows without `user_id` before enforcing per-user ownership.

## Verification Commands

```bash
npm ci
npm test
npm run test:e2e
npm run build
```

## Deployment Notes

Use Vercel for `apps/web` with:

- Root Directory: `apps/web`
- Build Command: `npm run build`
- Output Directory: `dist`

Deploy `apps/api` to a Node.js host with `npm --workspace @calculator-app/api start`, then configure its HTTPS URL as `VITE_SUPPORT_API_URL` in Vercel.

## Roadmap

- Next: push branch and open PR
- Later: add password reset if needed
- Later: add rate limiting and richer ingestion formats if needed

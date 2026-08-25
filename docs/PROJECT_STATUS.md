# Project Status

## Current State

- Project: Calculator App
- Repository: `https://github.com/NHuuSiuuuu/calculator-app`
- Active branch: `feature/ai-rag-support-system`
- App platform: React + Vite frontend with Node.js API
- Web app path: `apps/web`
- Database migrations path: `supabase/migrations`
- Recommended deploy target: Vercel web app with `/api/*` support routes

## AI Support RAG

- Branch: `feature/ai-rag-support-system`
- Status: implemented; Top K RAG retrieval applied
- Scope: demo chat without sign-in, demo `.txt/.md` uploads, Gemini embeddings, Supabase pgvector Top K search, conversation history

## Implemented

- Calculator tab ported to React
- Calculator unit tests preserved
- Supabase auth helpers for email/password sign up, sign in, session loading, and sign out
- User-owned Todo repository
- Supabase migration with `user_id`, existing-table upgrade handling, and RLS scoped to `auth.uid()`
- Auth-gated Todo UI
- Desktop/mobile Playwright coverage for calculator and auth-gated todos
- Demo AI Support chat with grounded Gemini answers without requiring sign-in
- Public demo `.txt` and `.md` ingestion with pgvector embeddings and status metadata
- Top K retrieval that passes related chunks into the prompt instead of dropping context with a high fixed similarity threshold
- Demo conversation history with reconstructed source metadata and recency ordering

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
```

The same Vercel project also requires `AI_PROVIDER=gemini`, `GEMINI_API_KEY`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY` for `/api/*`. Do not use service role keys, Gemini keys, or database passwords in frontend code.

If the database already contains todos from the earlier anonymous demo, the migration removes rows without `user_id` before enforcing per-user ownership.

## Verification Commands

```bash
npm ci
npm test
npm run test:e2e
npm run build
```

## Deployment Notes

Use Vercel with either supported layout:

- Repository root: Build Command `npm run build`, Output Directory `apps/web/dist`
- `apps/web` root: Build Command `npm run build`, Output Directory `dist`

The root `api/[...path].js` and web-root `apps/web/api/[...path].js` functions serve AI Support routes on the same domain. Do not set `VITE_SUPPORT_API_URL` for this demo on Vercel.

## Roadmap

- Next: push branch and open PR
- Later: add password reset if needed
- Later: add rate limiting and richer ingestion formats if needed

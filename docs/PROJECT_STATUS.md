# Project Status

## Current State

- Project: Calculator App
- Repository: `https://github.com/NHuuSiuuuu/calculator-app`
- Active branch: `feature/react-auth-migration`
- App platform: React + Vite
- Web app path: `apps/web`
- Database migrations path: `supabase/migrations`
- Recommended deploy target: Vercel

## Implemented

- Calculator tab ported to React
- Calculator unit tests preserved
- Supabase auth helpers for email/password sign up, sign in, session loading, and sign out
- User-owned Todo repository
- Supabase migration with `user_id` and RLS scoped to `auth.uid()`
- Auth-gated Todo UI
- Desktop/mobile Playwright coverage for calculator and auth-gated todos

## Required Supabase Setup

Run this SQL file in Supabase SQL Editor:

```text
supabase/migrations/0001_user_owned_todos.sql
```

Set these frontend environment variables:

```text
VITE_SUPABASE_URL
VITE_SUPABASE_ANON_KEY
```

Do not use service role keys or database passwords in frontend code.

## Verification Commands

```bash
npm ci
npm test
npm run test:e2e
npm run build
```

## Deployment Notes

Use Vercel with:

- Root Directory: `apps/web`
- Build Command: `npm run build`
- Output Directory: `dist`

## Roadmap

- Next: final review for React/Auth migration
- Next: push branch and open PR
- Later: add password reset if needed
- Later: add server/API only when secret server-side logic is needed

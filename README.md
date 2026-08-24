# Calculator App

A React + Vite productivity app with a calculator and an authenticated Supabase Todo List.

## Status

- Repository: `https://github.com/NHuuSiuuuu/calculator-app`
- Branch: `feature/react-auth-migration`
- Web app: `apps/web`
- Database migrations: `supabase/migrations`
- Recommended deployment: Vercel

## Features

- Calculator tab with basic arithmetic
- Division-by-zero error handling
- Keyboard input for calculator operations
- In-memory calculation history with per-entry deletion
- Todo List tab gated by Supabase email/password authentication
- User-owned todos enforced by Supabase Row Level Security
- Todo create, complete, edit, and delete actions
- Responsive desktop and mobile layout

Calculation history is local in-memory state and clears on reload. Todo data is stored in Supabase Postgres.

## Project Structure

```text
calculator-app/
├─ apps/
│  └─ web/
│     ├─ index.html
│     ├─ package.json
│     ├─ vite.config.js
│     ├─ src/
│     │  ├─ App.jsx
│     │  ├─ main.jsx
│     │  ├─ features/
│     │  │  ├─ auth/
│     │  │  ├─ calculator/
│     │  │  └─ todos/
│     │  └─ lib/supabase/
│     └─ tests/
├─ supabase/
│  └─ migrations/
├─ docs/
├─ .github/
└─ package.json
```

## Supabase Setup

1. Create a Supabase project.
2. Enable email/password auth in Supabase Auth settings.
3. Open SQL Editor.
4. Run:

```text
supabase/migrations/0001_user_owned_todos.sql
```

This migration creates or upgrades `public.todos`, adds `user_id`, enables RLS, and scopes access to `auth.uid()`. If the project already has old anonymous demo todos, the migration removes rows without `user_id` before making ownership required.

Only use the anon/publishable key in the frontend. Do not expose service role keys, database passwords, or JWT secrets.

## Environment Variables

Set these in Vercel and in local `.env` files when running locally:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-or-publishable-key
```

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

## Run Locally

```bash
npm ci
npm run dev
```

Open:

```text
http://127.0.0.1:4173
```

## Test

```bash
npm test
npm run test:e2e
npm run build
```

## Vercel Deployment

Use these project settings:

- Framework Preset: `Vite`
- Root Directory: `apps/web`
- Build Command: `npm run build`
- Output Directory: `dist`

Add environment variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Vercel will create preview deployments for pull requests and production deployments from the production branch.

## Tracking

- Bugs/features: GitHub Issues
- Review: Pull Requests
- CI: `.github/workflows/ci.yml`
- Project status: `docs/PROJECT_STATUS.md`
- UI/design source: `DESIGN.md`
- Wiki source: `docs/wiki/Home.md`

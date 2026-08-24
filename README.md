# Calculator App

A React + Vite productivity app with a calculator, an authenticated Supabase Todo List, and an AI Support RAG workspace.

## Status

- Repository: `https://github.com/NHuuSiuuuu/calculator-app`
- Branch: `feature/ai-rag-support-system`
- Web app: `apps/web`
- API app: `apps/api`
- Database migrations: `supabase/migrations`
- Recommended deployment: Vercel for the web app and a Node.js host for the API

## Features

- Calculator tab with basic arithmetic
- Division-by-zero error handling
- Keyboard input for calculator operations
- In-memory calculation history with per-entry deletion
- Todo List tab gated by Supabase email/password authentication
- User-owned todos enforced by Supabase Row Level Security
- Todo create, complete, edit, and delete actions
- Authenticated AI Support chat grounded in uploaded company documents
- Admin document ingestion dashboard for `.txt` and `.md` files
- Persisted conversation history with source metadata
- Responsive desktop and mobile layout

Calculation history is local in-memory state and clears on reload. Todo data is stored in Supabase Postgres.

## Project Structure

```text
calculator-app/
├─ apps/
│  ├─ api/
│  │  ├─ package.json
│  │  ├─ src/
│  │  └─ tests/
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
│     │  │  ├─ support/
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
4. Run both migrations in order:

```text
supabase/migrations/0001_user_owned_todos.sql
supabase/migrations/0002_ai_rag_support.sql
```

`0001` creates or upgrades user-owned todos. `0002` adds AI Support storage, pgvector search, and the `profiles.role` upgrade. Existing databases that previously ran `0001` still receive the role column because the same idempotent `ALTER TABLE` is included in `0002`.

Only use the anon/publishable key in the frontend. Do not expose service role keys, database passwords, or JWT secrets.

## Environment Variables

Set these in Vercel and in `apps/web/.env.local` when running locally:

```bash
VITE_SUPABASE_URL=https://your-project.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-or-publishable-key
VITE_SUPPORT_API_URL=http://127.0.0.1:8787
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

Run the RAG migration in Supabase SQL Editor after `0001`:

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

Install dependencies once:

```bash
npm ci
```

The app has two services. Start the API in one terminal with the backend variables exported:

```bash
export OPENAI_API_KEY=sk-...
export SUPABASE_URL=https://your-project.supabase.co
export SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
npm run dev:api
```

Start Vite in a second terminal:

```bash
npm run dev:web
```

The API listens on `http://127.0.0.1:8787` by default. Open the web app at:

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
- `VITE_SUPPORT_API_URL` set to the public HTTPS URL of the deployed API

Deploy `apps/api` separately to a Node.js host that supports a long-running HTTP server:

1. Build from the repository root and install with `npm ci`.
2. Start with `npm --workspace @calculator-app/api start`.
3. Set `OPENAI_API_KEY`, `OPENAI_EMBEDDING_MODEL`, `OPENAI_CHAT_MODEL`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY` on the API host.
4. Set the API host's `PORT` if the platform does not inject one automatically.
5. Put the resulting HTTPS origin in Vercel as `VITE_SUPPORT_API_URL`, then redeploy the web app.

Vercel deploys only the frontend in this setup; the AI Support routes are served by the separate Node API.

## Tracking

- Bugs/features: GitHub Issues
- Review: Pull Requests
- CI: `.github/workflows/ci.yml`
- Project status: `docs/PROJECT_STATUS.md`
- UI/design source: `DESIGN.md`
- Wiki source: `docs/wiki/Home.md`

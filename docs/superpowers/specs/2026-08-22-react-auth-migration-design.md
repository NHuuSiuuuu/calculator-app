# React + Auth Migration Design

## Goal

Move the calculator app from plain static JavaScript into a React + Vite web app and add Supabase email/password authentication so each signed-in user can only see and mutate their own todos.

This change keeps the product scope intentionally small:

- Calculator behavior remains unchanged.
- Todo CRUD remains unchanged from the user's point of view.
- Todo data becomes user-owned instead of shared across all anonymous visitors.
- The app remains deployable as a frontend app on Vercel.
- No custom Node.js API server is added yet.

## Current State

The app is currently a static HTML/CSS/JavaScript app at the repository root:

- `index.html`
- `styles.css`
- `config.js`
- `src/app.js`
- `src/calculator.js`
- `src/todoClient.js`
- `tests/`
- `supabase/schema.sql`

Todo data is accessed from the browser through Supabase REST using:

- `apikey: <anon key>`
- `Authorization: Bearer <anon key>`

The current `todos` RLS policies allow broad anonymous access for demo purposes. This is not acceptable once multiple real users share the app.

## Recommended Architecture

Use a frontend monorepo shape with one app:

```text
calculator-app/
├─ apps/
│  └─ web/
│     ├─ index.html
│     ├─ package.json
│     ├─ vite.config.js
│     ├─ src/
│     │  ├─ main.jsx
│     │  ├─ App.jsx
│     │  ├─ features/
│     │  │  ├─ auth/
│     │  │  ├─ calculator/
│     │  │  └─ todos/
│     │  └─ lib/
│     │     └─ supabase/
│     └─ tests/
├─ supabase/
│  └─ migrations/
├─ docs/
├─ .github/
├─ package.json
└─ README.md
```

Keep root-level `package.json` as the main command surface for CI and contributors. Root scripts should call into `apps/web`, for example:

- `npm test`
- `npm run test:e2e`
- `npm run build`
- `npm run dev`

## Framework Choice

Use React + Vite, not Next.js, for this migration.

Reasons:

- The app is a browser-first productivity tool.
- Supabase Auth and RLS remove the immediate need for a custom server.
- Vite gives a real frontend project structure without Next.js server/client component complexity.
- Vercel can deploy Vite apps and create preview deployments for pull requests.

Next.js can be introduced later if the app needs server-side rendering, API routes, middleware, or server-only secrets.

## Authentication Design

Use Supabase Auth with email/password.

Auth UI:

- Show email and password fields when signed out.
- Provide `Sign up` and `Sign in` actions.
- Show signed-in email and `Sign out` action when signed in.
- Disable Todo CRUD while signed out.
- Show useful loading and error messages.

Session behavior:

- Use the Supabase JavaScript client for auth session management.
- The client manages access-token refresh.
- Todo requests use the current session's access token.
- Refresh tokens are not manually stored or sent to Todo REST endpoints.

## Todo Ownership Design

Add a `user_id` column:

```sql
user_id uuid not null references auth.users(id) on delete cascade
```

Every todo belongs to exactly one Supabase auth user.

RLS must enforce:

- Signed-in users can select only rows where `user_id = auth.uid()`.
- Signed-in users can insert only rows where `user_id = auth.uid()`.
- Signed-in users can update only rows where `user_id = auth.uid()`.
- Signed-in users can delete only rows where `user_id = auth.uid()`.
- Anonymous users cannot read or mutate todos.

The frontend may send `user_id` during insert, but RLS is the security boundary. The database policy must reject mismatched `user_id` values.

## Supabase Client Design

Create a dedicated Supabase module under:

```text
apps/web/src/lib/supabase/
```

Responsibilities:

- Read config from Vite environment variables.
- Create the Supabase browser client.
- Expose auth helpers.
- Expose todo data helpers.

Configuration should move away from committed `config.js` and toward Vercel/GitHub environment variables:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

Only the anon/publishable key is used in the frontend. Service role keys, database passwords, and JWT secrets must never be committed or exposed to browser code.

## Feature Modules

Calculator:

- Move calculator state logic into `features/calculator/`.
- Keep existing behavior and tests.
- No database or auth dependency.

Todos:

- Move Todo UI and client logic into `features/todos/`.
- Require an authenticated user before loading todos.
- Load only current user's todos.
- Preserve add, complete, edit, and delete behavior.

Auth:

- Add `features/auth/`.
- Encapsulate sign up, sign in, sign out, current session, and auth status.
- Keep UI simple and practical.

## Data Flow

Signed-out Todo flow:

```text
Todo tab → Auth form → no Todo API calls
```

Signed-in Todo flow:

```text
React Todo component
→ Supabase client with current access token
→ Supabase REST/PostgREST
→ Postgres RLS checks auth.uid()
→ only current user's rows return
```

## Testing Strategy

Unit tests:

- Calculator logic still passes existing behavior tests.
- Supabase auth/todo helpers produce correct calls and handle missing session.
- Todo ownership requests include authenticated session context.

Browser tests:

- Signed-out user sees auth form and cannot use todos.
- User can sign in through mocked Supabase auth.
- Signed-in user can create, complete, edit, and delete todos.
- Sign out clears Todo UI and prevents further Todo calls.
- Calculator still works on desktop and mobile.

Static checks:

- App builds with Vite.
- No obvious secret strings are added to docs or code except placeholder env variable names.

## Migration Steps

1. Create React + Vite app structure in `apps/web`.
2. Move calculator functionality into React components while preserving behavior.
3. Move Todo functionality into React components while preserving behavior.
4. Add Supabase JS client dependency.
5. Add Auth UI and session state.
6. Replace anonymous Todo access with authenticated Todo access.
7. Replace `supabase/schema.sql` with migrations under `supabase/migrations`.
8. Add user-owned Todo migration and RLS policies.
9. Update tests, CI, README, DESIGN, and project status docs.
10. Verify unit tests, browser tests, and production build.

## Deployment Impact

Vercel should use:

- Framework preset: Vite
- Root directory: `apps/web`
- Build command: `npm run build`
- Output directory: `dist`

Environment variables on Vercel:

- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

GitHub Actions should continue to run from the root and call workspace scripts.

## Out of Scope

- Next.js migration.
- Custom Node.js server/API.
- Social login providers.
- Password reset email flow.
- Admin dashboards.
- Multi-tenant teams/workspaces.
- Production-grade rate limiting or abuse prevention.

These can be added later once the React + Auth foundation is stable.

## Open Decision

The implementation should proceed with React + Vite and Supabase email/password auth unless the user requests Next.js or a custom backend before implementation starts.

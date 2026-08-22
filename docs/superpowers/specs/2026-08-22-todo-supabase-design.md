# Todo Supabase Design

## Goal

Add a Todo List tab to the calculator app and persist todo items in Supabase Postgres through the Supabase REST Data API.

## Scope

- Keep the existing calculator behavior.
- Add two tabs: Calculator and Todo List.
- Add todo create, read, complete toggle, edit, and delete.
- Persist todo data through Supabase when `config.js` has a project URL and anon key.
- Show a setup-required empty state when Supabase config is missing.
- Do not commit database passwords, service role keys, or user-specific secrets.
- Do not add authentication in this iteration; the todo table is a shared demo list controlled by RLS policies.

## Architecture

The app remains a static browser app deployable on GitHub Pages. The Todo tab uses a small REST client around Supabase Data API endpoints:

`Browser UI -> src/todoClient.js -> Supabase REST API -> Postgres todos table`

Supabase URL and anon key are read from `window.APP_CONFIG.supabase`. The anon key is public by design, but the SQL setup must enable Row Level Security and grant only the intended table operations.

## Data Model

`public.todos`

- `id uuid primary key`
- `title text not null`
- `completed boolean not null default false`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

## Security

Supabase docs require RLS on tables exposed through the Data API. This demo uses anonymous access for a shared todo list. A production per-user list should add Supabase Auth, a `user_id` column, and policies scoped to `auth.uid()`.

## Testing

- Unit tests cover Supabase client URL/header/body behavior with fake fetch.
- Static UI tests cover required tab and todo controls.
- Playwright tests cover the Todo tab with mocked Supabase network responses on desktop and mobile.
- Existing calculator tests must continue to pass.

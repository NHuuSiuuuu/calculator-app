# React Auth Migration Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Migrate the app to React + Vite and add Supabase email/password authentication so each signed-in user only sees and mutates their own todos.

**Architecture:** Keep a frontend-only app deployed on Vercel. Move code into `apps/web`, use React feature modules for calculator/auth/todos, use Supabase JS for auth session management, and enforce Todo ownership through Postgres RLS using `auth.uid()`.

**Tech Stack:** React, Vite, Supabase JS, Node test runner, Playwright, Postgres RLS.

**Spec:** `docs/superpowers/specs/2026-08-22-react-auth-migration-design.md`

## Global Constraints

- Calculator behavior remains unchanged.
- Todo CRUD remains unchanged from the user's point of view.
- Todo data becomes user-owned instead of shared across all anonymous visitors.
- The app remains deployable as a frontend app on Vercel.
- No custom Node.js API server is added.
- Use React + Vite, not Next.js, for this migration.
- Use Supabase Auth with email/password.
- Use `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`; never commit service role keys, database passwords, or JWT secrets.
- Anonymous users cannot read or mutate todos.

---

## File Structure

Create or move files into:

```text
apps/web/
├─ index.html
├─ package.json
├─ vite.config.js
├─ src/
│  ├─ main.jsx
│  ├─ App.jsx
│  ├─ App.css
│  ├─ features/
│  │  ├─ auth/
│  │  │  ├─ AuthPanel.jsx
│  │  │  └─ authState.js
│  │  ├─ calculator/
│  │  │  ├─ Calculator.jsx
│  │  │  └─ calculator.js
│  │  └─ todos/
│  │     ├─ TodoPanel.jsx
│  │     └─ todoState.js
│  ├─ lib/
│  │  └─ supabase/
│  │     ├─ client.js
│  │     └─ todos.js
│  └─ test/
│     └─ supabaseMock.js
└─ tests/
   ├─ browser.spec.js
   ├─ calculator.test.js
   ├─ static-ui.test.js
   └─ supabaseTodos.test.js
```

Keep root-owned project files:

```text
.github/workflows/ci.yml
docs/
supabase/migrations/
package.json
package-lock.json
README.md
DESIGN.md
```

---

### Task 1: Create React + Vite Workspace

**Files:**
- Create: `apps/web/index.html`
- Create: `apps/web/package.json`
- Create: `apps/web/vite.config.js`
- Create: `apps/web/src/main.jsx`
- Create: `apps/web/src/App.jsx`
- Create: `apps/web/src/App.css`
- Modify: `package.json`
- Modify: `.github/workflows/ci.yml`
- Remove after migration succeeds: root `index.html`, root `styles.css`, root `config.js`

**Interfaces:**
- Produces root scripts:
  - `npm run dev`
  - `npm run build`
  - `npm test`
  - `npm run test:e2e`
- Produces a Vite app mounted at `#root`.
- Later tasks import React modules from `apps/web/src/`.

- [ ] **Step 1: Add failing static test for Vite root**

Create `apps/web/tests/static-ui.test.js`:

```js
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

test("Vite root page mounts the React app", () => {
  const html = readFileSync(new URL("../index.html", import.meta.url), "utf8");

  assert.match(html, /<div id="root"><\/div>/);
  assert.match(html, /src="\/src\/main\.jsx"/);
});
```

- [ ] **Step 2: Run static test and verify it fails**

Run:

```bash
npm --prefix apps/web test -- tests/static-ui.test.js
```

Expected: FAIL because `apps/web/package.json` and `apps/web/index.html` do not exist yet.

- [ ] **Step 3: Add Vite app files**

Create `apps/web/package.json`:

```json
{
  "name": "@calculator-app/web",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "vite --host 0.0.0.0",
    "build": "vite build",
    "preview": "vite preview --host 0.0.0.0",
    "test": "node --test tests/*.test.js",
    "test:e2e": "playwright test"
  },
  "dependencies": {
    "@supabase/supabase-js": "^2.0.0",
    "@vitejs/plugin-react": "^5.0.0",
    "vite": "^7.0.0",
    "react": "^19.0.0",
    "react-dom": "^19.0.0"
  },
  "devDependencies": {
    "@playwright/test": "^1.62.1"
  }
}
```

Create `apps/web/index.html`:

```html
<!doctype html>
<html lang="en">
  <head>
    <meta charset="UTF-8" />
    <meta name="viewport" content="width=device-width, initial-scale=1.0" />
    <title>Calculator App</title>
  </head>
  <body>
    <div id="root"></div>
    <script type="module" src="/src/main.jsx"></script>
  </body>
</html>
```

Create `apps/web/vite.config.js`:

```js
import react from "@vitejs/plugin-react";
import { defineConfig } from "vite";

export default defineConfig({
  plugins: [react()],
  test: {},
});
```

Create `apps/web/src/main.jsx`:

```jsx
import { StrictMode } from "react";
import { createRoot } from "react-dom/client";

import { App } from "./App.jsx";
import "./App.css";

createRoot(document.getElementById("root")).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
```

Create `apps/web/src/App.jsx`:

```jsx
export function App() {
  return (
    <main className="app-shell" aria-label="Productivity app">
      <p>React app loading</p>
    </main>
  );
}
```

Create `apps/web/src/App.css`:

```css
html {
  color-scheme: light;
}

body {
  margin: 0;
  font-family: Inter, ui-sans-serif, system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", sans-serif;
}
```

- [ ] **Step 4: Update root scripts**

Modify root `package.json` scripts to call into `apps/web`:

```json
{
  "scripts": {
    "dev": "npm --prefix apps/web run dev",
    "build": "npm --prefix apps/web run build",
    "test": "npm --prefix apps/web test",
    "test:e2e": "npm --prefix apps/web run test:e2e"
  }
}
```

- [ ] **Step 5: Update CI working directory expectations**

Modify `.github/workflows/ci.yml` so it still runs from root:

```yaml
- name: Install root dependencies
  run: npm ci

- name: Install web dependencies
  run: npm --prefix apps/web ci

- name: Run unit and static tests
  run: npm test

- name: Run production build
  run: npm run build

- name: Run browser tests
  run: npm run test:e2e
```

- [ ] **Step 6: Install dependencies**

Run:

```bash
npm install
npm --prefix apps/web install
```

Expected: lockfiles updated and dependency install succeeds.

- [ ] **Step 7: Verify Task 1 passes**

Run:

```bash
npm test
npm run build
```

Expected: static test passes and Vite build succeeds.

- [ ] **Step 8: Commit Task 1**

```bash
git add .github/workflows/ci.yml package.json package-lock.json apps/web
git commit -m "Set up React Vite web app"
```

---

### Task 2: Port Calculator to React

**Files:**
- Create: `apps/web/src/features/calculator/calculator.js`
- Create: `apps/web/src/features/calculator/Calculator.jsx`
- Modify: `apps/web/src/App.jsx`
- Modify: `apps/web/src/App.css`
- Create/modify: `apps/web/tests/calculator.test.js`
- Create/modify: `apps/web/tests/browser.spec.js`

**Interfaces:**
- Produces `createInitialState()`, `inputDigit(state, digit)`, `inputOperator(state, operator)`, `inputDecimal(state)`, `evaluate(state)`, `clear(state)`, `backspace(state)`, and `deleteHistoryEntry(state, index)`.
- Produces `<Calculator />`.
- Later app shell renders `<Calculator />` under the Calculator tab.

- [ ] **Step 1: Move calculator tests first**

Copy existing calculator tests into `apps/web/tests/calculator.test.js`, changing import path to:

```js
import {
  backspace,
  clear,
  createInitialState,
  deleteHistoryEntry,
  evaluate,
  inputDecimal,
  inputDigit,
  inputOperator,
} from "../src/features/calculator/calculator.js";
```

- [ ] **Step 2: Run calculator test and verify it fails**

Run:

```bash
npm test
```

Expected: FAIL because `apps/web/src/features/calculator/calculator.js` does not exist.

- [ ] **Step 3: Move calculator logic**

Copy current `src/calculator.js` into `apps/web/src/features/calculator/calculator.js` without behavior changes.

- [ ] **Step 4: Verify calculator unit tests pass**

Run:

```bash
npm test
```

Expected: calculator tests pass.

- [ ] **Step 5: Add React Calculator component**

Create `apps/web/src/features/calculator/Calculator.jsx` that renders:

- display
- expression
- error
- keypad buttons with `data-key`
- history list with per-entry delete buttons

Use the existing calculator state functions instead of reimplementing arithmetic inside the component.

- [ ] **Step 6: Add browser tests for React calculator**

In `apps/web/tests/browser.spec.js`, include tests for:

```js
test("calculator computes with pointer input", async ({ page }) => {
  await page.goto("/");
  for (const key of ["1", "2", "+", "3", "="]) {
    await page.locator(`[data-key="${key}"]`).click();
  }
  await expect(page.locator("#display")).toHaveText("15");
  await expect(page.locator("#history")).toContainText("12 + 3 = 15");
});
```

Also include existing keyboard, division by zero, history delete, and mobile layout tests.

- [ ] **Step 7: Run browser test and verify it fails before App renders Calculator**

Run:

```bash
npm run test:e2e
```

Expected: FAIL because `App.jsx` still renders placeholder content.

- [ ] **Step 8: Render Calculator from App**

Modify `apps/web/src/App.jsx` to render the app shell with Calculator tab and `<Calculator />`.

- [ ] **Step 9: Port styles**

Move relevant root `styles.css` content into `apps/web/src/App.css`, preserving responsive behavior and avoiding UI regressions.

- [ ] **Step 10: Verify Task 2 passes**

Run:

```bash
npm test
npm run test:e2e
npm run build
```

Expected: calculator unit tests pass, browser tests pass on desktop/mobile, build succeeds.

- [ ] **Step 11: Commit Task 2**

```bash
git add apps/web
git commit -m "Port calculator to React"
```

---

### Task 3: Add Supabase Client and Auth Helpers

**Files:**
- Create: `apps/web/src/lib/supabase/client.js`
- Create: `apps/web/src/features/auth/authState.js`
- Create: `apps/web/tests/supabaseAuth.test.js`

**Interfaces:**
- Produces `createSupabaseClient(env)` returning a Supabase browser client or `null` when config is missing.
- Produces `normalizeAuthSession(session)` returning `{ accessToken, user }` or `null`.
- Produces `createAuthApi(supabase)` with `getSession()`, `signUp(email, password)`, `signIn(email, password)`, and `signOut()`.

- [ ] **Step 1: Write failing auth helper tests**

Create `apps/web/tests/supabaseAuth.test.js`:

```js
import assert from "node:assert/strict";
import test from "node:test";

import { normalizeAuthSession, createAuthApi } from "../src/features/auth/authState.js";

test("normalizeAuthSession returns null for missing session", () => {
  assert.equal(normalizeAuthSession(null), null);
});

test("normalizeAuthSession extracts access token and user", () => {
  const result = normalizeAuthSession({
    access_token: "access-token",
    user: { id: "user-1", email: "a@example.com" },
  });

  assert.deepEqual(result, {
    accessToken: "access-token",
    user: { id: "user-1", email: "a@example.com" },
  });
});

test("auth api delegates email password methods to Supabase auth", async () => {
  const calls = [];
  const api = createAuthApi({
    auth: {
      async signUp(input) {
        calls.push(["signUp", input]);
        return { data: { session: null }, error: null };
      },
      async signInWithPassword(input) {
        calls.push(["signInWithPassword", input]);
        return { data: { session: null }, error: null };
      },
      async signOut() {
        calls.push(["signOut"]);
        return { error: null };
      },
      async getSession() {
        calls.push(["getSession"]);
        return { data: { session: null }, error: null };
      },
    },
  });

  await api.signUp("a@example.com", "password123");
  await api.signIn("a@example.com", "password123");
  await api.getSession();
  await api.signOut();

  assert.deepEqual(calls, [
    ["signUp", { email: "a@example.com", password: "password123" }],
    ["signInWithPassword", { email: "a@example.com", password: "password123" }],
    ["getSession"],
    ["signOut"],
  ]);
});
```

- [ ] **Step 2: Run auth tests and verify they fail**

Run:

```bash
npm test
```

Expected: FAIL because `authState.js` does not exist.

- [ ] **Step 3: Implement auth helpers**

Create `apps/web/src/features/auth/authState.js`:

```js
export function normalizeAuthSession(session) {
  if (!session?.access_token || !session?.user) {
    return null;
  }

  return {
    accessToken: session.access_token,
    user: {
      id: session.user.id,
      email: session.user.email,
    },
  };
}

function throwIfError(error) {
  if (error) {
    throw new Error(error.message ?? "Supabase auth request failed.");
  }
}

export function createAuthApi(supabase) {
  return {
    async getSession() {
      const { data, error } = await supabase.auth.getSession();
      throwIfError(error);
      return normalizeAuthSession(data.session);
    },

    async signUp(email, password) {
      const { data, error } = await supabase.auth.signUp({ email, password });
      throwIfError(error);
      return normalizeAuthSession(data.session);
    },

    async signIn(email, password) {
      const { data, error } = await supabase.auth.signInWithPassword({ email, password });
      throwIfError(error);
      return normalizeAuthSession(data.session);
    },

    async signOut() {
      const { error } = await supabase.auth.signOut();
      throwIfError(error);
    },
  };
}
```

- [ ] **Step 4: Add Supabase browser client factory**

Create `apps/web/src/lib/supabase/client.js`:

```js
import { createClient } from "@supabase/supabase-js";

export function readSupabaseEnv(env = import.meta.env) {
  return {
    url: String(env.VITE_SUPABASE_URL ?? "").replace(/\/+$/, ""),
    anonKey: String(env.VITE_SUPABASE_ANON_KEY ?? ""),
  };
}

export function createSupabaseClient(env = import.meta.env) {
  const { url, anonKey } = readSupabaseEnv(env);

  if (!url || !anonKey) {
    return null;
  }

  return createClient(url, anonKey);
}
```

- [ ] **Step 5: Verify Task 3 passes**

Run:

```bash
npm test
npm run build
```

Expected: auth tests pass and build succeeds.

- [ ] **Step 6: Commit Task 3**

```bash
git add apps/web
git commit -m "Add Supabase auth helpers"
```

---

### Task 4: Add User-Owned Todo Data Layer and Supabase Migration

**Files:**
- Create: `apps/web/src/lib/supabase/todos.js`
- Create: `apps/web/tests/supabaseTodos.test.js`
- Create: `supabase/migrations/0001_user_owned_todos.sql`
- Modify/remove: `supabase/schema.sql`

**Interfaces:**
- Produces `createTodoRepository(supabase, getSessionUser)` with `listTodos()`, `createTodo(title)`, `updateTodo(id, changes)`, and `deleteTodo(id)`.
- `getSessionUser()` returns `{ id, email }` or `null`.
- Todo rows include `user_id`; normalized todos expose `id`, `title`, `completed`, `createdAt`, and `updatedAt`.

- [ ] **Step 1: Write failing Todo repository tests**

Create `apps/web/tests/supabaseTodos.test.js`:

```js
import assert from "node:assert/strict";
import test from "node:test";

import { createTodoRepository } from "../src/lib/supabase/todos.js";

function createQueryStub(result = []) {
  const calls = [];
  const query = {
    select(columns) {
      calls.push(["select", columns]);
      return query;
    },
    order(column, options) {
      calls.push(["order", column, options]);
      return Promise.resolve({ data: result, error: null });
    },
    insert(row) {
      calls.push(["insert", row]);
      return query;
    },
    update(changes) {
      calls.push(["update", changes]);
      return query;
    },
    delete() {
      calls.push(["delete"]);
      return query;
    },
    eq(column, value) {
      calls.push(["eq", column, value]);
      return query;
    },
    single() {
      calls.push(["single"]);
      return Promise.resolve({ data: result[0], error: null });
    },
  };

  return { calls, query };
}

test("todo repository rejects access without signed-in user", async () => {
  const repo = createTodoRepository({ from() {} }, () => null);

  await assert.rejects(() => repo.listTodos(), /Sign in to manage todos/);
});

test("todo repository creates todos for the current user", async () => {
  const { calls, query } = createQueryStub([
    {
      id: "todo-1",
      title: "Private task",
      completed: false,
      created_at: "2026-08-22T10:00:00Z",
      updated_at: "2026-08-22T10:00:00Z",
    },
  ]);
  const repo = createTodoRepository(
    { from(table) { calls.push(["from", table]); return query; } },
    () => ({ id: "user-1", email: "a@example.com" }),
  );

  const todo = await repo.createTodo("Private task");

  assert.deepEqual(todo, {
    id: "todo-1",
    title: "Private task",
    completed: false,
    createdAt: "2026-08-22T10:00:00Z",
    updatedAt: "2026-08-22T10:00:00Z",
  });
  assert.deepEqual(calls.slice(0, 4), [
    ["from", "todos"],
    ["insert", { title: "Private task", user_id: "user-1" }],
    ["select", "id,title,completed,created_at,updated_at"],
    ["single"],
  ]);
});
```

- [ ] **Step 2: Run Todo repository tests and verify they fail**

Run:

```bash
npm test
```

Expected: FAIL because `apps/web/src/lib/supabase/todos.js` does not exist.

- [ ] **Step 3: Implement Todo repository**

Create `apps/web/src/lib/supabase/todos.js` with:

```js
const TODO_COLUMNS = "id,title,completed,created_at,updated_at";

function normalizeTodo(todo) {
  return {
    id: todo.id,
    title: todo.title,
    completed: Boolean(todo.completed),
    createdAt: todo.created_at,
    updatedAt: todo.updated_at,
  };
}

function requireUser(getSessionUser) {
  const user = getSessionUser();

  if (!user?.id) {
    throw new Error("Sign in to manage todos.");
  }

  return user;
}

function throwIfError(error) {
  if (error) {
    throw new Error(error.message ?? "Supabase todo request failed.");
  }
}

export function createTodoRepository(supabase, getSessionUser) {
  return {
    async listTodos() {
      requireUser(getSessionUser);
      const { data, error } = await supabase
        .from("todos")
        .select(TODO_COLUMNS)
        .order("created_at", { ascending: false });
      throwIfError(error);
      return Array.isArray(data) ? data.map(normalizeTodo) : [];
    },

    async createTodo(title) {
      const user = requireUser(getSessionUser);
      const { data, error } = await supabase
        .from("todos")
        .insert({ title, user_id: user.id })
        .select(TODO_COLUMNS)
        .single();
      throwIfError(error);
      return normalizeTodo(data);
    },

    async updateTodo(id, changes) {
      requireUser(getSessionUser);
      const { data, error } = await supabase
        .from("todos")
        .update(changes)
        .eq("id", id)
        .select(TODO_COLUMNS)
        .single();
      throwIfError(error);
      return normalizeTodo(data);
    },

    async deleteTodo(id) {
      requireUser(getSessionUser);
      const { error } = await supabase
        .from("todos")
        .delete()
        .eq("id", id);
      throwIfError(error);
    },
  };
}
```

- [ ] **Step 4: Add user-owned RLS migration**

Create `supabase/migrations/0001_user_owned_todos.sql`:

```sql
create extension if not exists "pgcrypto";

create table if not exists public.todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_todos_updated_at on public.todos;
create trigger set_todos_updated_at
before update on public.todos
for each row
execute function public.set_updated_at();

alter table public.todos enable row level security;

revoke all privileges on public.todos from anon;
revoke all privileges on public.todos from authenticated;

grant select, delete on public.todos to authenticated;
grant insert (user_id, title) on public.todos to authenticated;
grant update (title, completed) on public.todos to authenticated;

drop policy if exists "anon can read todos" on public.todos;
drop policy if exists "anon can create todos" on public.todos;
drop policy if exists "anon can update todos" on public.todos;
drop policy if exists "anon can delete todos" on public.todos;
drop policy if exists "users can read own todos" on public.todos;
drop policy if exists "users can create own todos" on public.todos;
drop policy if exists "users can update own todos" on public.todos;
drop policy if exists "users can delete own todos" on public.todos;

create policy "users can read own todos"
on public.todos
for select
to authenticated
using (user_id = auth.uid());

create policy "users can create own todos"
on public.todos
for insert
to authenticated
with check (
  user_id = auth.uid()
  and char_length(btrim(title)) between 1 and 120
);

create policy "users can update own todos"
on public.todos
for update
to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and char_length(btrim(title)) between 1 and 120
);

create policy "users can delete own todos"
on public.todos
for delete
to authenticated
using (user_id = auth.uid());
```

- [ ] **Step 5: Keep schema compatibility note**

Replace `supabase/schema.sql` with a short pointer:

```sql
-- Schema files now live in supabase/migrations.
-- Run supabase/migrations/0001_user_owned_todos.sql for the current todo schema.
```

- [ ] **Step 6: Verify Task 4 passes**

Run:

```bash
npm test
npm run build
```

Expected: repository tests pass and build succeeds.

- [ ] **Step 7: Commit Task 4**

```bash
git add apps/web supabase
git commit -m "Add user-owned Supabase todo data layer"
```

---

### Task 5: Build React Auth and Todo UI

**Files:**
- Create: `apps/web/src/features/auth/AuthPanel.jsx`
- Create: `apps/web/src/features/todos/TodoPanel.jsx`
- Create: `apps/web/src/features/todos/todoState.js`
- Modify: `apps/web/src/App.jsx`
- Modify: `apps/web/src/App.css`
- Modify: `apps/web/tests/browser.spec.js`
- Create: `apps/web/src/test/supabaseMock.js`

**Interfaces:**
- Produces `<AuthPanel authApi={authApi} session={session} onSessionChange={fn} />`.
- Produces `<TodoPanel todoRepository={repo} session={session} />`.
- App keeps `session` state and passes current user to Todo repository.

- [ ] **Step 1: Add failing browser test for signed-out Todo state**

In `apps/web/tests/browser.spec.js`:

```js
test("signed-out users see auth form instead of todos", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("tab", { name: "Todo List" }).click();

  await expect(page.getByLabel("Email")).toBeVisible();
  await expect(page.getByLabel("Password")).toBeVisible();
  await expect(page.getByRole("button", { name: "Sign in" })).toBeVisible();
  await expect(page.getByText("Sign in to manage your todos.")).toBeVisible();
});
```

- [ ] **Step 2: Run browser test and verify it fails**

Run:

```bash
npm run test:e2e -- --grep "signed-out users"
```

Expected: FAIL because Auth UI does not exist.

- [ ] **Step 3: Implement AuthPanel**

Create `apps/web/src/features/auth/AuthPanel.jsx`:

```jsx
import { useState } from "react";

export function AuthPanel({ authApi, session, onSessionChange }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  async function runAuth(action) {
    setMessage("");
    setIsLoading(true);
    try {
      const nextSession = await action(email.trim(), password);
      onSessionChange(nextSession);
      setPassword("");
    } catch (error) {
      setMessage(error.message);
    } finally {
      setIsLoading(false);
    }
  }

  if (session) {
    return (
      <section className="auth-panel" aria-label="Account">
        <p>Signed in as <strong>{session.user.email}</strong></p>
        <button type="button" onClick={() => runAuth(() => authApi.signOut().then(() => null))}>
          Sign out
        </button>
      </section>
    );
  }

  return (
    <section className="auth-panel" aria-label="Sign in">
      <p>Sign in to manage your todos.</p>
      <label htmlFor="auth-email">Email</label>
      <input id="auth-email" value={email} onChange={(event) => setEmail(event.target.value)} />
      <label htmlFor="auth-password">Password</label>
      <input id="auth-password" type="password" value={password} onChange={(event) => setPassword(event.target.value)} />
      <div className="auth-actions">
        <button type="button" disabled={isLoading} onClick={() => runAuth(authApi.signIn)}>Sign in</button>
        <button type="button" disabled={isLoading} onClick={() => runAuth(authApi.signUp)}>Sign up</button>
      </div>
      {message ? <p className="todo-message is-error" role="alert">{message}</p> : null}
    </section>
  );
}
```

- [ ] **Step 4: Implement TodoPanel**

Create `apps/web/src/features/todos/TodoPanel.jsx` preserving current Todo UX:

- If signed out, render auth-only message and no Todo API calls.
- If signed in, load todos on first render.
- Provide add, toggle, edit, delete.
- Show loading/error/empty states.

- [ ] **Step 5: Wire App state**

Modify `apps/web/src/App.jsx`:

- Create Supabase client once.
- Create auth API.
- Get initial session on app load.
- Render tabs: Calculator and Todo List.
- Render `AuthPanel` inside Todo tab.
- Render `TodoPanel` only when session exists.

- [ ] **Step 6: Add mocked signed-in Todo browser test**

Add a test that uses a browser-side mock object:

```js
await page.addInitScript(() => {
  window.__APP_TEST_SUPABASE__ = {
    session: {
      access_token: "user-access-token",
      user: { id: "user-1", email: "a@example.com" },
    },
    todos: [],
  };
});
```

The test must verify:

- sign in changes UI to signed-in state
- add todo renders new task
- complete todo applies completed style
- edit todo changes text
- delete todo removes task
- sign out hides todo list

- [ ] **Step 7: Verify Task 5 passes**

Run:

```bash
npm test
npm run test:e2e
npm run build
```

Expected: unit tests, browser tests, and build all pass.

- [ ] **Step 8: Commit Task 5**

```bash
git add apps/web
git commit -m "Add React auth and todo UI"
```

---

### Task 6: Update Documentation and Deployment Config

**Files:**
- Modify: `README.md`
- Modify: `DESIGN.md`
- Modify: `docs/PROJECT_STATUS.md`
- Modify: `docs/wiki/Home.md`
- Modify: `.github/pull_request_template.md`

**Interfaces:**
- Documents Vercel config:
  - Root Directory: `apps/web`
  - Build Command: `npm run build`
  - Output Directory: `dist`
- Documents Supabase env:
  - `VITE_SUPABASE_URL`
  - `VITE_SUPABASE_ANON_KEY`
- Documents migration:
  - `supabase/migrations/0001_user_owned_todos.sql`

- [ ] **Step 1: Add docs check test**

Create or update `apps/web/tests/static-ui.test.js` with:

```js
test("README documents React auth deployment environment", () => {
  const readme = readFileSync(new URL("../../../README.md", import.meta.url), "utf8");

  assert.match(readme, /VITE_SUPABASE_URL/);
  assert.match(readme, /VITE_SUPABASE_ANON_KEY/);
  assert.match(readme, /apps\/web/);
});
```

- [ ] **Step 2: Run docs test and verify it fails**

Run:

```bash
npm test
```

Expected: FAIL until README is updated.

- [ ] **Step 3: Update README**

Document:

- how to install dependencies
- how to run dev server
- how to run tests
- how to build
- how to configure Vercel
- how to configure Supabase Auth and migration
- never commit service role key/database password

- [ ] **Step 4: Update DESIGN and project status docs**

Document:

- app is now React + Vite
- Auth protects Todo feature
- RLS is the database security boundary
- Calculator remains unauthenticated

- [ ] **Step 5: Verify Task 6 passes**

Run:

```bash
npm test
npm run test:e2e
npm run build
```

Expected: all pass.

- [ ] **Step 6: Commit Task 6**

```bash
git add README.md DESIGN.md docs .github apps/web/tests/static-ui.test.js
git commit -m "Document React auth deployment"
```

---

### Task 7: Final Verification, Review, and Push

**Files:**
- No planned production file edits unless final verification exposes a defect.

**Interfaces:**
- Produces final branch ready for PR review.

- [ ] **Step 1: Run full verification**

Run:

```bash
npm test
npm run test:e2e
npm run build
git status --short --branch
```

Expected:

- all unit/static tests pass
- all Playwright tests pass on desktop/mobile
- Vite production build succeeds
- git status is clean after commits

- [ ] **Step 2: Request code review**

Use the requesting-code-review skill. Review focus:

- Auth session correctness
- Todo ownership and RLS correctness
- React migration regressions
- Vercel deployment config
- Secret exposure risk

- [ ] **Step 3: Fix review findings with TDD**

For each accepted finding:

1. Write a failing test.
2. Run it and confirm failure.
3. Implement the fix.
4. Run the targeted test.
5. Run full verification.
6. Commit the fix.

- [ ] **Step 4: Push branch**

```bash
GIT_SSH_COMMAND='ssh -i ~/.ssh/calculator_app_deploy -o IdentitiesOnly=yes' git push origin feature/react-auth-migration
```

- [ ] **Step 5: Report PR handoff**

Report:

- branch name
- commit SHA
- PR URL: `https://github.com/NHuuSiuuuu/calculator-app/pull/new/feature/react-auth-migration`
- verification commands and results
- Supabase migration file to run
- Vercel env vars to set

---

## Self-Review

Spec coverage:

- React + Vite migration: Tasks 1 and 2.
- Auth UI/session: Tasks 3 and 5.
- User-owned todos: Task 4.
- RLS policies: Task 4.
- Vercel deployment: Task 6.
- Testing and verification: Tasks 1 through 7.

Placeholder scan:

- No unfinished placeholder markers are intentionally present.
- Steps include exact file paths, commands, and expected results.

Type consistency:

- Auth session shape is consistently `{ accessToken, user }`.
- User shape is consistently `{ id, email }`.
- Todo shape is consistently `{ id, title, completed, createdAt, updatedAt }`.

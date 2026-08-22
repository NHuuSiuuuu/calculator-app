# Todo Supabase Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a Todo List tab that persists todos through Supabase REST Data API when configured.

**Architecture:** Keep the app static. Add a focused Supabase REST client, a Todo UI controller, SQL setup docs, and tests that mock Supabase in browser automation.

**Tech Stack:** HTML, CSS, vanilla JavaScript modules, Node test runner, Playwright, Supabase REST Data API.

**Spec:** `docs/superpowers/specs/2026-08-22-todo-supabase-design.md`

## Global Constraints

- Do not commit service role keys, database passwords, or private credentials.
- Keep Supabase config in `config.js` with empty placeholders by default.
- Preserve existing calculator behavior and tests.
- Follow `DESIGN.md` tokens and visual rationale.
- Use TDD for behavior changes.

---

### Task 1: Supabase Todo Client

**Files:**
- Create: `src/todoClient.js`
- Test: `tests/todoClient.test.js`

**Interfaces:**
- Produces: `createTodoClient(config, fetchImpl)` with `listTodos`, `createTodo`, `updateTodo`, and `deleteTodo`.

- [ ] Write failing tests for missing config, list, create, update, and delete requests.
- [ ] Implement the REST client with Supabase headers and error handling.
- [ ] Run `npm test` and commit.

### Task 2: Todo Tab UI

**Files:**
- Modify: `index.html`
- Modify: `styles.css`
- Modify: `src/app.js`
- Test: `tests/static-ui.test.js`
- Test: `tests/browser.spec.js`

**Interfaces:**
- Consumes: `createTodoClient`.
- Produces: tab switching and Todo CRUD UI behavior.

- [ ] Write failing static and Playwright tests for the Todo tab.
- [ ] Add tab markup, Todo form, list, empty/loading/error states.
- [ ] Implement Todo UI controller with mocked Supabase responses in e2e tests.
- [ ] Run `npm test` and `npm run test:e2e`.

### Task 3: Supabase Setup Docs

**Files:**
- Create: `supabase/schema.sql`
- Create: `config.js`
- Modify: `README.md`
- Modify: `docs/PROJECT_STATUS.md`
- Modify: `docs/wiki/Home.md`
- Modify: `DESIGN.md`

**Interfaces:**
- Produces: setup instructions for Supabase project URL, anon key, and SQL schema.

- [ ] Add SQL schema with RLS policies for the shared demo todo list.
- [ ] Add empty `config.js` placeholders.
- [ ] Document setup, security constraints, and production auth next step.
- [ ] Run full verification and commit.

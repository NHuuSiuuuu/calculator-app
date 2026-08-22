# Calculator App

A small browser productivity app with a calculator and a Supabase-backed todo list.

## Current Status

- Repository: `https://github.com/NHuuSiuuuu/calculator-app`
- Repository path: `/home/codexproxy/Codex-ttshuu`
- Worktree path: `/home/codexproxy/Codex-ttshuu/.worktrees/calculator-app`
- App branch: `feature/calculator-app`
- Todo branch: `feature/todo-supabase`
- Operations branch: `ops/github-pages-tracking`
- GitHub remote: `git@github.com:NHuuSiuuuu/calculator-app.git`
- Target live URL: `https://nhuusiuuuu.github.io/calculator-app/`
- GitHub Pages status: enable manually in repository settings with `main` and `/root`

## Features

- Tabs for Calculator and Todo List
- Addition, subtraction, multiplication, and division
- Division-by-zero error handling
- Decimal input with one decimal point per number
- Clear and delete controls
- Keyboard input for numbers, operators, Enter, Backspace, Escape, and decimal point
- Recent calculation history
- Delete individual history entries
- Supabase Todo List with create, complete, edit, and delete actions
- Responsive desktop and mobile layout

History is stored in the app's in-memory JavaScript state for the current browser session. It is not persisted to `localStorage` or a database, so reloading the page clears it.

Todo items are stored in Supabase Postgres when `config.js` has a Supabase project URL and anon key. Without config, the Todo tab shows a setup message and does not write data.

## Supabase Setup

1. Create a Supabase project.
2. Open Supabase SQL Editor.
3. Run `supabase/schema.sql`.
4. Open `config.js` and set:

```js
window.APP_CONFIG.supabase = {
  url: "https://your-project.supabase.co",
  anonKey: "your-anon-or-publishable-key",
};
```

Use the anon/publishable key only. Do not paste the service role key or database password into frontend files.

This demo uses anonymous RLS policies for a shared todo list. A production per-user todo list should add Supabase Auth, a `user_id` column, and policies scoped to `auth.uid()`.

## Run

Install dependencies from the lockfile, then run the local static server:

```bash
npm ci
```

```bash
npm run serve
```

Open `http://127.0.0.1:4173` in a browser. The app uses JavaScript modules, so the static server path is the supported run mode.

## Test

```bash
npm test
```

Browser verification:

```bash
npm run test:e2e
```

Latest local verification:

- `npm test`
- `npm run test:e2e`
- Desktop screenshot: `.artifacts/screenshots/calculator-desktop.png`
- Mobile screenshot: `.artifacts/screenshots/calculator-mobile.png`

## Project Operations

GitHub Pages setup:

```text
Repository Settings -> Pages -> Deploy from branch -> main -> /root
```

Tracking:

- Bugs and feature requests: GitHub Issues
- Code review: pull requests using `.github/pull_request_template.md`
- CI: `.github/workflows/ci.yml`
- Project status: `docs/PROJECT_STATUS.md`
- Wiki source: `docs/wiki/Home.md`

## Project Files

- `DESIGN.md`: visual identity, tokens, and UI rationale
- `index.html`: app tabs, calculator markup, and todo markup
- `styles.css`: responsive UI styles
- `src/calculator.js`: pure calculation state and arithmetic logic
- `src/todoClient.js`: Supabase REST client for todo persistence
- `src/app.js`: browser event handling and rendering
- `supabase/schema.sql`: todos table, trigger, grants, and RLS policies
- `config.js`: public Supabase URL and anon key placeholders
- `tests/`: unit and static UI tests

## Working Rules

- Codex must use Superpowers guidance for coding, debugging, and review tasks.
- Codex must use git for change tracking and comparison.
- Codex should make focused, minimal changes and avoid unrelated refactors.
- For frontend/UI work, `DESIGN.md` is the visual identity source of truth.
- UI work should be verified in a real browser on desktop and mobile when practical.
- Completed features should be documented in this README and, when a wiki exists, mirrored there.
- Codex must not report pass/complete without real verification evidence.

## Next Step

Enable GitHub Pages from `main` and `/root`, configure Supabase in `config.js`, then open `https://nhuusiuuuu.github.io/calculator-app/`.

# Calculator App

A small browser calculator for addition, subtraction, multiplication, and division.

## Current Status

- Repository: `https://github.com/NHuuSiuuuu/calculator-app`
- Repository path: `/home/codexproxy/Codex-ttshuu`
- Worktree path: `/home/codexproxy/Codex-ttshuu/.worktrees/calculator-app`
- App branch: `feature/calculator-app`
- Operations branch: `ops/github-pages-tracking`
- GitHub remote: `git@github.com:NHuuSiuuuu/calculator-app.git`
- Target live URL: `https://nhuusiuuuu.github.io/calculator-app/`
- GitHub Pages status: enable manually in repository settings with `main` and `/root`

## Features

- Addition, subtraction, multiplication, and division
- Division-by-zero error handling
- Decimal input with one decimal point per number
- Clear and delete controls
- Keyboard input for numbers, operators, Enter, Backspace, Escape, and decimal point
- Recent calculation history
- Delete individual history entries
- Responsive desktop and mobile layout

History is stored in the app's in-memory JavaScript state for the current browser session. It is not persisted to `localStorage` or a database, so reloading the page clears it.

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
- `index.html`: calculator markup
- `styles.css`: responsive UI styles
- `src/calculator.js`: pure calculation state and arithmetic logic
- `src/app.js`: browser event handling and rendering
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

Merge this operations setup to `main`, enable GitHub Pages from `main` and `/root`, then open `https://nhuusiuuuu.github.io/calculator-app/`.

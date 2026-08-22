# Calculator App

A small browser calculator for addition, subtraction, multiplication, and division.

## Current Status

- Repository path: `/home/codexproxy/Codex-ttshuu`
- Worktree path: `/home/codexproxy/Codex-ttshuu/.worktrees/calculator-app`
- Branch: `feature/calculator-app`
- GitHub remote: `https://github.com/NHuuSiuuuu/calculator-app.git`
- GitHub push status: blocked until GitHub authentication is connected

## Features

- Addition, subtraction, multiplication, and division
- Division-by-zero error handling
- Decimal input with one decimal point per number
- Clear and delete controls
- Keyboard input for numbers, operators, Enter, Backspace, Escape, and decimal point
- Recent calculation history
- Responsive desktop and mobile layout

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

Connect GitHub authentication, then push `main` and `feature/calculator-app` to the remote repository.

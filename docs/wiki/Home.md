# Calculator App Wiki

## Overview

Calculator App is a small static productivity app with a calculator and a Supabase-backed todo list.

Repository:

```text
https://github.com/NHuuSiuuuu/calculator-app
```

Target live URL after GitHub Pages is enabled:

```text
https://nhuusiuuuu.github.io/calculator-app/
```

## How To Run Locally

```bash
npm ci
npm run serve
```

Open:

```text
http://127.0.0.1:4173
```

## How To Verify

```bash
npm test
npm run test:e2e
```

## Project Tracking

- Bugs: GitHub Issues with the bug report template
- Features: GitHub Issues with the feature request template
- Code review: Pull requests with the PR checklist
- Status: `docs/PROJECT_STATUS.md`
- UI identity: `DESIGN.md`

## Current State

- App code is committed and pushed to GitHub.
- Real-project tracking setup is documented in the repo.
- GitHub Actions CI is configured in `.github/workflows/ci.yml`.
- GitHub Pages still needs to be enabled from `main` and `/root`.
- Todo List needs a Supabase project URL and anon key in `config.js` before it can persist data.

## Roadmap

- Done: static calculator UI and arithmetic logic
- Done: delete individual in-memory history entries
- Done: Supabase Todo List implementation branch
- Done: unit/static tests and Playwright desktop/mobile tests
- Done: GitHub repository push
- Done: real-project tracking setup
- Next: merge operations setup to `main`
- Next: enable GitHub Pages in repository settings from `main` and `/root`
- Next: add Supabase config in `config.js`
- Next: use GitHub Issues and pull requests for future changes

## GitHub Pages Setup

Enable Pages manually:

```text
Repository Settings -> Pages -> Deploy from branch -> main -> /root
```

## Working Rules

- Use Superpowers guidance for coding, debugging, and review tasks.
- Use git for change tracking.
- Keep README and wiki/status documentation current.
- Test with real browser checks for UI changes.
- Do not report completion without verification evidence.

# Project Status

## Current State

- Project: Calculator App
- Repository: `https://github.com/NHuuSiuuuu/calculator-app`
- Primary branch: `main`
- Development branch: `feature/calculator-app`
- Operations branch: `ops/github-pages-tracking`
- Latest app commit before operations setup: `36965352059001e5c3b1ec157d3a06887d4e94d0`
- Target GitHub Pages URL: `https://nhuusiuuuu.github.io/calculator-app/`

## Live App

GitHub Pages setup is manual:

```text
Repository Settings -> Pages -> Deploy from branch -> main -> /root
```

After Pages is enabled, the app should be available at:

```text
https://nhuusiuuuu.github.io/calculator-app/
```

## Tracking Workflow

- Use GitHub Issues for bugs and feature requests.
- Use branches for code changes.
- Use pull requests for review before merging.
- Use the pull request template checklist for tests, screenshots, docs, and risk notes.
- Keep `README.md`, `DESIGN.md`, and this status document current.

## Verification

Local commands:

```bash
npm ci
npm test
npm run test:e2e
```

GitHub Actions workflow:

```text
.github/workflows/ci.yml
```

The CI workflow runs dependency install, unit/static tests, and browser tests.

## Roadmap

- Done: static calculator UI and arithmetic logic
- Done: delete individual in-memory history entries
- Done: unit/static tests and Playwright desktop/mobile tests
- Done: GitHub repository push
- Done: real-project tracking setup
- Next: merge operations setup to `main`
- Next: enable GitHub Pages in repository settings from `main` and `/root`
- Next: use GitHub Issues/PRs for future changes

## Working Rules

- Use Superpowers guidance for coding, debugging, and review tasks.
- Use git for all change tracking and comparison.
- Keep changes focused and avoid unrelated refactors.
- Follow `DESIGN.md` for frontend/UI changes.
- Verify UI with real browser checks on desktop and mobile when practical.
- Do not report completion without real verification evidence.
- Mirror major README/status changes into wiki content when wiki access exists.

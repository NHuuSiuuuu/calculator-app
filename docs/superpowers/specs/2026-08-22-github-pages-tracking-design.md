# GitHub Pages Tracking Design

## Goal

Run Calculator App like a small real project: public GitHub code, a predictable live URL path, automated verification, and written project tracking.

## Scope

This setup adds operational project files only. It does not change calculator runtime behavior, UI styling, or arithmetic logic.

## Deployment Model

The app is a static HTML/CSS/JavaScript project at the repository root. GitHub Pages can serve it from the `main` branch and `/root` folder.

Target live URL:

```text
https://nhuusiuuuu.github.io/calculator-app/
```

GitHub Pages must be enabled in the GitHub UI:

```text
Repository Settings -> Pages -> Deploy from branch -> main -> /root
```

## Tracking Model

- GitHub branches and commits track source changes.
- GitHub Issues track bugs and feature requests.
- Pull requests use a checklist for tests, screenshots, docs, and review.
- `docs/PROJECT_STATUS.md` tracks current state, roadmap, verification, and next actions.
- `docs/wiki/Home.md` mirrors the project status for a future GitHub Wiki page.

## CI Model

GitHub Actions runs the same checks used locally:

- `npm ci`
- `npx playwright install --with-deps chromium`
- `npm test`
- `npm run test:e2e`

The workflow supports pushes, pull requests, and manual dispatch.

## Constraints

- Keep the app static; do not add a frontend framework for this setup.
- Keep deploy documentation explicit because GitHub Pages activation is a GitHub repository setting.
- Do not claim remote CI or Pages is active until GitHub shows it.
- Keep local and remote verification commands identical where practical.

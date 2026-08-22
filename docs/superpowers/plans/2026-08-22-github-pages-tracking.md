# GitHub Pages Tracking Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add GitHub Pages run instructions, GitHub Actions verification, and project tracking documents for Calculator App.

**Architecture:** The app remains static at the repository root. GitHub Pages serves the existing root files, GitHub Actions verifies the app, and docs/templates define the project workflow.

**Tech Stack:** Static HTML/CSS/JavaScript, Node.js test runner, Playwright, GitHub Actions, GitHub Issues, GitHub Pages.

**Spec:** `docs/superpowers/specs/2026-08-22-github-pages-tracking-design.md`

## Global Constraints

- Do not change calculator runtime behavior.
- GitHub Pages activation remains a manual GitHub UI setting.
- Use `npm ci`, `npm test`, and `npm run test:e2e` as verification commands.
- Keep README and project status aligned.

---

### Task 1: GitHub Actions CI

**Files:**
- Create: `.github/workflows/ci.yml`

**Interfaces:**
- Consumes: existing `package.json` scripts `test` and `test:e2e`
- Produces: a reusable GitHub Actions workflow named `CI`

- [ ] **Step 1: Create CI workflow**

```yaml
name: CI

on:
  push:
    branches:
      - main
      - "feature/**"
      - "ops/**"
  pull_request:
    branches:
      - main
  workflow_dispatch:

jobs:
  verify:
    runs-on: ubuntu-latest
    timeout-minutes: 15

    steps:
      - name: Check out repository
        uses: actions/checkout@v4

      - name: Set up Node.js
        uses: actions/setup-node@v4
        with:
          node-version: "22"
          cache: npm

      - name: Install dependencies
        run: npm ci

      - name: Install Chromium for Playwright
        run: npx playwright install --with-deps chromium

      - name: Run unit and static tests
        run: npm test

      - name: Run browser tests
        run: npm run test:e2e
```

- [ ] **Step 2: Verify workflow YAML exists**

Run: `test -f .github/workflows/ci.yml`

Expected: exit code `0`

### Task 2: GitHub Tracking Templates

**Files:**
- Create: `.github/pull_request_template.md`
- Create: `.github/ISSUE_TEMPLATE/bug_report.md`
- Create: `.github/ISSUE_TEMPLATE/feature_request.md`

**Interfaces:**
- Consumes: project rules from `README.md`
- Produces: consistent issue and PR tracking templates

- [ ] **Step 1: Add pull request template**

Template requires summary, verification, screenshots, docs, and risk notes.

- [ ] **Step 2: Add issue templates**

Bug template captures reproduction steps, expected behavior, actual behavior, environment, and screenshots.

Feature template captures user goal, proposed behavior, acceptance criteria, and test notes.

- [ ] **Step 3: Verify templates exist**

Run:

```bash
test -f .github/pull_request_template.md
test -f .github/ISSUE_TEMPLATE/bug_report.md
test -f .github/ISSUE_TEMPLATE/feature_request.md
```

Expected: all exit code `0`

### Task 3: Project Status And Wiki Source

**Files:**
- Create: `docs/PROJECT_STATUS.md`
- Create: `docs/wiki/Home.md`

**Interfaces:**
- Consumes: current GitHub repo, branch, test commands, and target Pages URL
- Produces: project state documentation for README and future GitHub Wiki

- [ ] **Step 1: Add project status**

Document current live URL target, repository state, branches, verification commands, tracking workflow, and next actions.

- [ ] **Step 2: Add wiki source**

Mirror the project status in `docs/wiki/Home.md` so it can be copied into GitHub Wiki when wiki access exists.

- [ ] **Step 3: Verify docs exist**

Run:

```bash
test -f docs/PROJECT_STATUS.md
test -f docs/wiki/Home.md
```

Expected: all exit code `0`

### Task 4: README Operational Update

**Files:**
- Modify: `README.md`

**Interfaces:**
- Consumes: docs and templates from earlier tasks
- Produces: top-level instructions for local run, GitHub Pages, tracking, and verification

- [ ] **Step 1: Update current status**

Replace outdated GitHub push status with remote branch and GitHub Pages setup status.

- [ ] **Step 2: Add project operations section**

Include tracking, CI, GitHub Pages, and docs links.

- [ ] **Step 3: Run final verification**

Run:

```bash
npm test
npm run test:e2e
git status --short --branch
```

Expected: tests pass and only intended files are modified before commit.

# Codex-ttshuu

Workspace initialized for Codex-assisted development.

## Current Status

- Repository path: `/home/codexproxy/Codex-ttshuu`
- Git repository: initialized
- Default branch: `main`
- Application source: not created yet
- UI/browser test status: not applicable yet because no app exists

## How To Track Codex Work

Use these commands from the repository root:

```bash
pwd
git status
git diff
git log --oneline --decorate --graph --all
```

When Codex edits code, changed files will appear in `git status`, and exact line changes will appear in `git diff`.

## Working Rules

- Codex must use Superpowers guidance for coding, debugging, and review tasks.
- Codex must use git for change tracking and comparison.
- Codex should make focused, minimal changes and avoid unrelated refactors.
- For frontend/UI work, `DESIGN.md` is the visual identity source of truth.
- If no `DESIGN.md` exists and UI is being created or materially changed, create it first.
- UI work should be verified in a real browser on desktop and mobile when practical.
- Completed features should be documented in this README and, when a wiki exists, mirrored there.
- Codex must not report pass/complete without real verification evidence.

## Next Step

Choose what to build or provide an existing source repository to import into this workspace.

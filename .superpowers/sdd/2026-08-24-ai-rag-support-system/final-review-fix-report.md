# AI RAG Support System Final Review Fix Report

## Status

DONE_WITH_CONCERNS

Implementation commit:

- `76b45e1fa54cac4c916373a1312222a5e89478bd` - `Fix AI Support final review findings`

The report is committed separately so the implementation commit SHA can be recorded without becoming self-referential.

## Findings Addressed

- Added the idempotent `profiles.role` upgrade to migration `0002`, covering databases that previously ran the shipped `0001`.
- Normalized accepted `.txt` and `.md` uploads to database-safe `text/plain` and `text/markdown` values before persistence.
- Remounted AI Support by authenticated user ID so local state and late callbacks cannot cross account boundaries.
- Reconstructed persisted message source metadata from stored chunk IDs and touched parent conversations after every successful message insert.
- Added backend-authoritative current-user role discovery, loaded admin documents only for admins, and displayed filename, status, chunk count, upload time, and ingestion error.
- Documented explicit frontend/API local startup and separate production deployment, including `VITE_SUPPORT_API_URL`.
- Rejected chat messages longer than 4,000 characters before conversation creation, message persistence, or embedding.
- Made successful null vector RPC results return an empty list.
- Made missing or non-owned message history return an empty list through `maybeSingle()`.
- Distinguished an empty ready-document knowledge base from irrelevant vector retrieval.
- Updated project status from planned to implemented.

## Files Changed

Database and workspace:

- `supabase/migrations/0002_ai_rag_support.sql`
- `package.json`

API implementation:

- `apps/api/src/auth.js`
- `apps/api/src/http.js`
- `apps/api/src/ragPrompt.js`
- `apps/api/src/repositories/supportRepository.js`
- `apps/api/src/routes/chat.js`
- `apps/api/src/routes/documents.js`

Frontend implementation:

- `apps/web/src/App.jsx`
- `apps/web/src/App.css`
- `apps/web/src/features/support/AiSupportPanel.jsx`
- `apps/web/src/features/support/supportApi.js`

Tests:

- `apps/api/tests/auth.test.js`
- `apps/api/tests/migrations.test.js`
- `apps/api/tests/ragPrompt.test.js`
- `apps/api/tests/routes.test.js`
- `apps/api/tests/supportRepository.test.js`
- `apps/web/tests/browser.spec.js`
- `apps/web/tests/supportApi.test.js`

Documentation:

- `README.md`
- `docs/PROJECT_STATUS.md`
- `docs/wiki/Home.md`

## Tests Added Or Extended

- Static migration contract for the idempotent `profiles.role` upgrade in `0002`.
- Generic Markdown MIME normalization to `text/markdown`.
- 4,001-character chat rejection before side effects.
- Empty knowledge base response distinct from irrelevant retrieval.
- Backend current-user role lookup and `/api/me` route.
- Null vector RPC data normalization.
- Ready-document existence lookup.
- Persisted source reconstruction through chunk/document metadata.
- Missing/non-owned conversation history behavior.
- Parent conversation recency touch after message insertion.
- Frontend current-user role client call.
- Normal-user startup without an admin document request or red 403.
- Admin document metadata and ingestion error rendering.
- Account-switch rejection of a late prior-user history response.

## TDD Evidence

RED API run (`npm run test:api`): 22 passed, 9 failed for the expected missing behaviors. Failures included absent `requireUserWithRole`, absent `profiles.role` SQL in `0002`, unchanged `application/octet-stream`, missing length validation, missing `/api/me`, null `.map`, `.single()` ownership handling, absent source hydration, and absent conversation touch.

RED web unit run (`npm run test:web`): 22 passed, 1 failed because `getCurrentUser` did not exist.

RED focused Playwright run: 3 failed for the expected reasons: normal users still rendered the admin region, admin rows omitted metadata, and a stale prior-account answer appeared after identity change.

GREEN focused runs:

- `npm run test:api`: 34/34 passed.
- `npm run test:web`: 23/23 passed.
- Focused desktop Playwright regressions: 3/3 passed.

## Full Verification

- `npm test`: passed, 57 total tests (23 web and 34 API), 0 failures.
- `npm run test:e2e`: passed, 26/26 Playwright tests across desktop and mobile.
- `npm run build`: passed; Vite transformed 82 modules and produced the production bundle.
- `git diff --check`: passed with no whitespace errors.

## Self-Review Notes

- Backend role lookup remains authoritative. Frontend role state only controls whether the admin dashboard is requested/rendered; document endpoints still enforce `requireAdmin`.
- Chat length validation runs before conversation lookup/creation, message insertion, embedding, and model calls.
- Source hydration preserves stored chunk order and tolerates missing chunk rows.
- Conversation recency changes only after a message insert succeeds.
- User-ID remounting resets all support state and makes React discard callbacks from the unmounted prior-account panel.
- Changes stayed within the reviewed AI Support, migration, test, and operator-documentation surfaces.

## Concerns

- The migration and Supabase relation query are covered by contract-level tests with fakes; no live Supabase/Postgres migration or PostgREST integration environment was available in this worktree.
- E2E tests mock backend responses, so deployment environment variables, OpenAI connectivity, and hosted CORS/network configuration still require deployment smoke testing.

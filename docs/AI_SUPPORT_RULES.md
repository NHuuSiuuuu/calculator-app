# AI Support Rules

## Roles

- signed-in user: can chat, view only their own conversation history, upload their own documents, list their own documents, and delete their own documents.
- `admin`: currently follows the same per-user document rules for AI Support. Admin-only global document management is not part of this mode.
- signed-out visitor: cannot call AI Support APIs and must sign in before asking questions.

## Backend Access Rules

- `GET /api/me`: requires a valid Supabase bearer token and returns the backend-authoritative user role from `profiles.role`.
- `POST /api/chat`: requires a valid Supabase bearer token.
- `GET /api/conversations`: requires a valid Supabase bearer token and returns only the current user's conversations.
- `GET /api/conversations/:id/messages`: requires a valid Supabase bearer token and returns only messages from the current user's conversation.
- `DELETE /api/conversations/:id`: requires a valid Supabase bearer token and deletes only the current user's conversation.
- `GET /api/documents`: requires a valid Supabase bearer token and returns only the current user's documents.
- `POST /api/documents/upload`: requires a valid Supabase bearer token and creates a document owned by the current user.
- `DELETE /api/documents/:id`: requires a valid Supabase bearer token and deletes only the current user's document.
- RAG retrieval only searches chunks from documents owned by the current user.

## Frontend Rules

- Do not call AI Support API routes until a Supabase session exists.
- Show document management only after a Supabase session exists.
- Keep the chat input disabled for signed-out visitors.
- Never rely on frontend state for isolation; the backend must always scope document and conversation access by the authenticated user id.

## Supabase Setup

Run the migrations in order:

```text
supabase/migrations/0001_user_owned_todos.sql
supabase/migrations/0002_ai_rag_support.sql
supabase/migrations/0003_user_scoped_support_documents.sql
```

`0003` removes earlier demo support rows without an owner and enforces per-user ownership for support documents and conversations.

## Security

- Keep `GEMINI_API_KEY` or `OPENAI_API_KEY` on the backend only.
- Keep `SUPABASE_SERVICE_ROLE_KEY` on the backend only.
- The frontend may only use `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- Do not commit real API keys, service role keys, database passwords, or JWT secrets.

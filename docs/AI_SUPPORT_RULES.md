# AI Support Rules

## Roles

- `admin`: can chat, view conversation history, upload company documents, list company documents, and delete company documents.
- `user`: can chat and view only their own conversation history.
- signed-out visitor: cannot call AI Support APIs and must sign in before asking questions.

## Backend Access Rules

- `GET /api/me`: requires a valid Supabase bearer token and returns the backend-authoritative user role from `profiles.role`.
- `POST /api/chat`: requires a valid Supabase bearer token.
- `GET /api/conversations`: requires a valid Supabase bearer token and returns only the current user's conversations.
- `GET /api/conversations/:id/messages`: requires a valid Supabase bearer token and returns only messages from the current user's conversation.
- `DELETE /api/conversations/:id`: requires a valid Supabase bearer token and deletes only the current user's conversation.
- `GET /api/documents`: requires `profiles.role = 'admin'`.
- `POST /api/documents/upload`: requires `profiles.role = 'admin'`.
- `DELETE /api/documents/:id`: requires `profiles.role = 'admin'`.

## Frontend Rules

- Do not call AI Support API routes until a Supabase session exists.
- Hide the document management section unless `/api/me` returns `role: "admin"`.
- Keep the chat input disabled for signed-out visitors.
- Never infer admin access from frontend state alone; the backend decides with `profiles.role`.

## Supabase Admin Setup

New accounts default to `role = 'user'`. Promote an account to admin in Supabase SQL Editor:

```sql
update public.profiles
set role = 'admin'
where id = '<user-id>';
```

Use the Supabase Auth user id for `<user-id>`.

## Security

- Keep `GEMINI_API_KEY` or `OPENAI_API_KEY` on the backend only.
- Keep `SUPABASE_SERVICE_ROLE_KEY` on the backend only.
- The frontend may only use `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY`.
- Do not commit real API keys, service role keys, database passwords, or JWT secrets.

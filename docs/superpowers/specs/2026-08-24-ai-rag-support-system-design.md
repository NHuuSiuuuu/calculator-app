# AI RAG Support System Design

## Goal

Add an AI customer support module that answers user questions from company documents using vector RAG. This should be a focused MVP that proves the real product loop:

`User -> Chat UI -> Backend API -> OpenAI -> Supabase pgvector -> Supabase DB`

The MVP must keep secrets on the backend, reuse the existing Supabase Auth foundation, and store conversation history.

## Version 1 Scope

Version 1 includes:

- Authenticated user chat.
- Admin-only document upload for `.txt` and `.md` files.
- Server-side document parsing and chunking.
- OpenAI embeddings for every document chunk.
- Supabase Postgres + pgvector storage for chunks and vector search.
- Backend chat endpoint that retrieves relevant chunks and asks the AI to answer from those chunks.
- Conversation and message history.
- Basic admin dashboard for uploaded documents and ingestion status.

Version 1 does not include PDF parsing, streaming responses, rate limiting, analytics charts, multi-company tenancy, or advanced role management beyond `admin` and `user`.

## Architecture

The current app has a React/Vite frontend in `apps/web` and Supabase Auth/Todo data. The RAG system adds a backend API so the browser never receives OpenAI keys or Supabase service-role credentials.

Components:

- `apps/web`: React UI for chat, document upload, conversation history, and admin document list.
- `apps/api`: Node HTTP API for authenticated chat, document ingestion, embeddings, vector search, and history writes.
- `supabase/migrations`: SQL schema for documents, chunks, conversations, messages, role metadata, and pgvector search function.
- Supabase Auth: existing sign-in identity source.
- Supabase Postgres: application database and vector database.
- OpenAI API: embeddings and answer generation.

## Data Flow

Document ingestion:

1. Admin signs in.
2. Admin uploads `.txt` or `.md`.
3. Web sends file to `POST /api/documents/upload`.
4. API verifies the user's Supabase JWT and admin role.
5. API extracts text, chunks it, and creates embeddings with OpenAI.
6. API stores document metadata in `support_documents`.
7. API stores chunks and embeddings in `support_document_chunks`.

Chat:

1. User signs in.
2. User submits a question in the AI Support chat.
3. Web sends message to `POST /api/chat`.
4. API verifies the user's Supabase JWT.
5. API stores the user message.
6. API embeds the user question.
7. API calls `match_support_chunks` in Supabase to retrieve the most relevant chunks.
8. API builds a grounded prompt using the matched chunks.
9. API calls the AI model.
10. API stores the assistant response and returns it to the UI.

If no chunks meet the similarity threshold, the assistant should say it cannot find an answer in the uploaded company documents.

## Data Model

`profiles`

- Already exists for user profile data.
- Add/use `role text not null default 'user' check (role in ('admin', 'user'))`.

`support_documents`

- `id uuid primary key`
- `owner_id uuid references auth.users(id)`
- `filename text not null`
- `content_type text not null`
- `status text not null check (status in ('processing', 'ready', 'failed'))`
- `chunk_count integer not null default 0`
- `error_message text`
- `created_at timestamptz not null default now()`

`support_document_chunks`

- `id uuid primary key`
- `document_id uuid references support_documents(id) on delete cascade`
- `chunk_index integer not null`
- `content text not null`
- `token_estimate integer not null`
- `embedding extensions.vector(1536) not null`
- `created_at timestamptz not null default now()`

`support_conversations`

- `id uuid primary key`
- `user_id uuid references auth.users(id)`
- `title text not null`
- `created_at timestamptz not null default now()`
- `updated_at timestamptz not null default now()`

`support_messages`

- `id uuid primary key`
- `conversation_id uuid references support_conversations(id) on delete cascade`
- `role text not null check (role in ('user', 'assistant'))`
- `content text not null`
- `retrieved_chunk_ids uuid[] not null default '{}'`
- `created_at timestamptz not null default now()`

Vector search function:

- `match_support_chunks(query_embedding extensions.vector(1536), match_threshold float, match_count int)`
- Returns chunk id, document id, content, filename, and similarity.
- Orders by cosine distance.

## Model Choices

Embeddings:

- Use `text-embedding-3-small`.
- Store 1536-dimension vectors in pgvector.
- Keep model name in backend config as `OPENAI_EMBEDDING_MODEL`.

Answer generation:

- Keep answer model configurable as `OPENAI_CHAT_MODEL`.
- Backend prompt must instruct the AI to answer only from retrieved context and admit when context is insufficient.

## Backend API

`POST /api/documents/upload`

- Requires admin role.
- Accepts multipart form upload.
- Supports `.txt` and `.md`.
- Returns document id, status, and chunk count.

`GET /api/documents`

- Requires admin role.
- Returns uploaded documents and ingestion status.

`POST /api/chat`

- Requires signed-in user.
- Body: `{ conversationId?: string, message: string }`
- Returns: `{ conversationId, answer, sources }`
- Creates a new conversation if none is supplied.

`GET /api/conversations`

- Requires signed-in user.
- Returns only the current user's conversations.

`GET /api/conversations/:id/messages`

- Requires signed-in user.
- Returns only messages from conversations owned by the current user.

## Frontend UX

Add an `AI Support` app tab.

User view:

- Chat panel.
- Conversation list.
- Message history.
- Source chips under assistant answers showing which uploaded documents were used.
- Empty state when no conversation is selected.

Admin view:

- Upload document control.
- Document list with status, chunk count, and uploaded time.
- Basic error display for failed ingestion.

The UI should feel like an internal support tool, not a landing page: dense, readable, restrained, and optimized for repeated use.

## Security

- The frontend uses only Supabase anon key and user access token.
- OpenAI API key is backend-only.
- Supabase service role key, if used, is backend-only.
- Backend verifies Supabase JWT on every API request.
- Admin endpoints check `profiles.role = 'admin'`.
- RLS protects conversation history by `auth.uid()`.
- Document upload is admin-only in v1.

## Error Handling

- Missing OpenAI config: API returns a clear setup error.
- Empty knowledge base: chat response says no company documents are available.
- No relevant chunks: assistant says it cannot answer from available documents.
- Upload parse failure: document status becomes `failed` with a short error.
- OpenAI failure: chat stores user message but returns a retryable API error without storing a fake assistant answer.

## Testing

Unit tests:

- Chunking splits text into stable chunks with overlap.
- Role checks reject non-admin uploads.
- Vector search prompt builder includes retrieved chunks and excludes unrelated content.
- Conversation history helpers scope reads to the current user.
- Missing config returns clear errors.

Integration/API tests:

- Upload creates document and chunks with embeddings using a mocked OpenAI client.
- Chat creates conversation, stores user and assistant messages, and returns sources.
- Chat refuses to answer from empty retrieval.

E2E tests:

- Signed-out users cannot access AI Support.
- User can see chat UI.
- Admin can see upload UI.
- User can ask a question and see an answer plus sources using mocked backend responses.
- Conversation history remains visible after selecting a past conversation.

## Deployment

Required backend environment variables:

- `OPENAI_API_KEY`
- `OPENAI_EMBEDDING_MODEL`
- `OPENAI_CHAT_MODEL`
- `SUPABASE_URL`
- `SUPABASE_SERVICE_ROLE_KEY`
- `SUPABASE_JWT_SECRET` or equivalent JWT verification configuration

The frontend deployment must receive only public-safe Vite/Supabase variables. Backend variables must not be exposed to Vite.

## References

- OpenAI embeddings guide: https://developers.openai.com/api/docs/guides/embeddings
- OpenAI `text-embedding-3-small` model page: https://developers.openai.com/api/docs/models/text-embedding-3-small
- Supabase vector columns: https://supabase.com/docs/guides/ai/vector-columns
- Supabase pgvector extension: https://supabase.com/docs/guides/database/extensions/pgvector

## Success Criteria

- The design supports upload -> chunk -> embed -> vector search -> grounded answer -> history.
- Browser never sees OpenAI or service-role secrets.
- Admin and user roles are explicit.
- The MVP is small enough to implement in phases.
- Existing calculator, auth, and todo behavior remain unchanged.

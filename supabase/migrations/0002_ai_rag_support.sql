create extension if not exists "pgcrypto";
create extension if not exists vector with schema extensions;

create table if not exists public.support_documents (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  filename text not null check (char_length(btrim(filename)) between 1 and 180),
  content_type text not null check (content_type in ('text/plain', 'text/markdown')),
  status text not null default 'processing' check (status in ('processing', 'ready', 'failed')),
  chunk_count integer not null default 0 check (chunk_count >= 0),
  error_message text,
  created_at timestamptz not null default now()
);

create table if not exists public.support_document_chunks (
  id uuid primary key default gen_random_uuid(),
  document_id uuid not null references public.support_documents(id) on delete cascade,
  chunk_index integer not null check (chunk_index >= 0),
  content text not null check (char_length(btrim(content)) > 0),
  token_estimate integer not null check (token_estimate > 0),
  embedding extensions.vector(1536) not null,
  created_at timestamptz not null default now(),
  unique (document_id, chunk_index)
);

create index if not exists support_document_chunks_embedding_idx
on public.support_document_chunks
using ivfflat (embedding vector_cosine_ops)
with (lists = 100);

create table if not exists public.support_conversations (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  title text not null check (char_length(btrim(title)) between 1 and 120),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.support_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.support_conversations(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(btrim(content)) > 0),
  retrieved_chunk_ids uuid[] not null default '{}',
  created_at timestamptz not null default now()
);

drop trigger if exists set_support_conversations_updated_at on public.support_conversations;
create trigger set_support_conversations_updated_at
before update on public.support_conversations
for each row
execute function public.set_updated_at();

create or replace function public.match_support_chunks(
  query_embedding extensions.vector(1536),
  match_threshold float,
  match_count int
)
returns table (
  chunk_id uuid,
  document_id uuid,
  content text,
  filename text,
  similarity float
)
language sql
stable
as $$
  select
    support_document_chunks.id as chunk_id,
    support_document_chunks.document_id,
    support_document_chunks.content,
    support_documents.filename,
    1 - (support_document_chunks.embedding <=> query_embedding) as similarity
  from public.support_document_chunks
  join public.support_documents
    on support_documents.id = support_document_chunks.document_id
  where support_documents.status = 'ready'
    and 1 - (support_document_chunks.embedding <=> query_embedding) >= match_threshold
  order by support_document_chunks.embedding <=> query_embedding
  limit least(match_count, 8);
$$;

alter table public.support_documents enable row level security;
alter table public.support_document_chunks enable row level security;
alter table public.support_conversations enable row level security;
alter table public.support_messages enable row level security;

revoke all privileges on public.support_documents from anon, authenticated;
revoke all privileges on public.support_document_chunks from anon, authenticated;
revoke all privileges on public.support_conversations from anon, authenticated;
revoke all privileges on public.support_messages from anon, authenticated;

grant select on public.support_conversations to authenticated;
grant select on public.support_messages to authenticated;

drop policy if exists "users can read own support conversations" on public.support_conversations;
drop policy if exists "users can read own support messages" on public.support_messages;

create policy "users can read own support conversations"
on public.support_conversations
for select
to authenticated
using (user_id = auth.uid());

create policy "users can read own support messages"
on public.support_messages
for select
to authenticated
using (
  exists (
    select 1
    from public.support_conversations
    where support_conversations.id = support_messages.conversation_id
      and support_conversations.user_id = auth.uid()
  )
);

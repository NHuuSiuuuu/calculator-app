delete from public.support_documents
where owner_id is null;

delete from public.support_conversations
where user_id is null;

alter table public.support_documents
alter column owner_id set not null;

alter table public.support_conversations
alter column user_id set not null;

create or replace function public.match_support_chunks_for_user(
  query_embedding extensions.vector(1536),
  match_threshold float,
  match_count int,
  match_owner_id uuid
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
    and support_documents.owner_id = match_owner_id
    and 1 - (support_document_chunks.embedding <=> query_embedding) >= match_threshold
  order by support_document_chunks.embedding <=> query_embedding
  limit least(match_count, 8);
$$;

revoke all on function public.match_support_chunks_for_user(extensions.vector(1536), float, int, uuid)
from anon, authenticated;

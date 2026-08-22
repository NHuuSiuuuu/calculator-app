create extension if not exists "pgcrypto";

create table if not exists public.todos (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists set_todos_updated_at on public.todos;
create trigger set_todos_updated_at
before update on public.todos
for each row
execute function public.set_updated_at();

alter table public.todos enable row level security;

revoke all privileges on public.todos from anon;

-- Anonymous access is intentionally shared for this demo. Column grants keep
-- clients from writing generated/system columns even though row access is broad.
grant select, delete on public.todos to anon;
grant insert (title) on public.todos to anon;
grant update (title, completed) on public.todos to anon;

drop policy if exists "anon can read todos" on public.todos;
drop policy if exists "anon can create todos" on public.todos;
drop policy if exists "anon can update todos" on public.todos;
drop policy if exists "anon can delete todos" on public.todos;

create policy "anon can read todos"
on public.todos
for select
to anon
using (true);

create policy "anon can create todos"
on public.todos
for insert
to anon
with check (char_length(btrim(title)) between 1 and 120);

create policy "anon can update todos"
on public.todos
for update
to anon
using (true)
with check (char_length(btrim(title)) between 1 and 120);

create policy "anon can delete todos"
on public.todos
for delete
to anon
using (true);

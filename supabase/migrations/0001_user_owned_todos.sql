create extension if not exists "pgcrypto";

create table if not exists public.todos (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
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
revoke all privileges on public.todos from authenticated;

grant select, delete on public.todos to authenticated;
grant insert (user_id, title) on public.todos to authenticated;
grant update (title, completed) on public.todos to authenticated;

drop policy if exists "anon can read todos" on public.todos;
drop policy if exists "anon can create todos" on public.todos;
drop policy if exists "anon can update todos" on public.todos;
drop policy if exists "anon can delete todos" on public.todos;
drop policy if exists "users can read own todos" on public.todos;
drop policy if exists "users can create own todos" on public.todos;
drop policy if exists "users can update own todos" on public.todos;
drop policy if exists "users can delete own todos" on public.todos;

create policy "users can read own todos"
on public.todos
for select
to authenticated
using (user_id = auth.uid());

create policy "users can create own todos"
on public.todos
for insert
to authenticated
with check (
  user_id = auth.uid()
  and char_length(btrim(title)) between 1 and 120
);

create policy "users can update own todos"
on public.todos
for update
to authenticated
using (user_id = auth.uid())
with check (
  user_id = auth.uid()
  and char_length(btrim(title)) between 1 and 120
);

create policy "users can delete own todos"
on public.todos
for delete
to authenticated
using (user_id = auth.uid());

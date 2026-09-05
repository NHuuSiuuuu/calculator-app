create extension if not exists "pgcrypto";

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text not null check (char_length(btrim(email)) > 0),
  display_name text check (display_name is null or char_length(btrim(display_name)) between 1 and 80),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.profiles
add column if not exists role text not null default 'user'
check (role in ('admin', 'user'));

create table if not exists public.todos (
  id uuid primary key default gen_random_uuid(),
  title text not null check (char_length(btrim(title)) between 1 and 120),
  completed boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.todos
add column if not exists user_id uuid references auth.users(id) on delete cascade;

-- Old anonymous demo rows have no reliable owner, so remove them before enforcing ownership.
delete from public.todos
where user_id is null;

alter table public.todos
alter column user_id set not null;

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

drop trigger if exists set_profiles_updated_at on public.profiles;
create trigger set_profiles_updated_at
before update on public.profiles
for each row
execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  insert into public.profiles (id, email)
  values (new.id, new.email)
  on conflict (id) do update
  set email = excluded.email;

  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
after insert on auth.users
for each row
execute function public.handle_new_user();

insert into public.profiles (id, email)
select id, email
from auth.users
where email is not null
on conflict (id) do update
set email = excluded.email;

alter table public.profiles enable row level security;
alter table public.todos enable row level security;

revoke all privileges on public.profiles from anon;
revoke all privileges on public.profiles from authenticated;
revoke all privileges on public.todos from anon;
revoke all privileges on public.todos from authenticated;

grant select on public.profiles to authenticated;
grant update (display_name) on public.profiles to authenticated;
grant select, delete on public.todos to authenticated;
grant insert (user_id, title) on public.todos to authenticated;
grant update (title, completed) on public.todos to authenticated;

drop policy if exists "users can read own profile" on public.profiles;
drop policy if exists "users can update own profile" on public.profiles;
drop policy if exists "anon can read todos" on public.todos;
drop policy if exists "anon can create todos" on public.todos;
drop policy if exists "anon can update todos" on public.todos;
drop policy if exists "anon can delete todos" on public.todos;
drop policy if exists "users can read own todos" on public.todos;
drop policy if exists "users can create own todos" on public.todos;
drop policy if exists "users can update own todos" on public.todos;
drop policy if exists "users can delete own todos" on public.todos;

create policy "users can read own profile"
on public.profiles
for select
to authenticated
using (id = auth.uid());

create policy "users can update own profile"
on public.profiles
for update
to authenticated
using (id = auth.uid())
with check (
  id = auth.uid()
  and (display_name is null or char_length(btrim(display_name)) between 1 and 80)
);

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

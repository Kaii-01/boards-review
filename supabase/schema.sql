-- Operation REE 2027: Supabase setup.
-- Run this ONCE in Supabase: SQL Editor -> New query -> paste -> Run.
-- Before running, change the email on the "insert into app_config" line to the OWNER's email.

create table if not exists public.docs (
  path text primary key,
  coll text generated always as (split_part(path, '/', 1)) stored,
  id   text generated always as (substr(path, length(split_part(path, '/', 1)) + 2)) stored,
  data jsonb not null default '{}'::jsonb,
  updated_at timestamptz not null default now(),
  constraint docs_size check (octet_length(data::text) <= 262144)
);
create index if not exists docs_coll_idx on public.docs (coll);

create table if not exists public.profiles (
  id uuid primary key references auth.users on delete cascade,
  name text not null default '',
  is_owner boolean not null default false
);

create table if not exists public.app_config (owner_email text not null);
delete from public.app_config;
insert into public.app_config (owner_email) values ('orensearabella01@gmail.com');  -- <== OWNER EMAIL

-- Who is who -------------------------------------------------------------
create or replace function public.is_owner() returns boolean
language sql stable security definer set search_path = public as $$
  select coalesce((select is_owner from profiles where id = auth.uid()), false)
$$;

create or replace function public.is_member() returns boolean
language sql stable security definer set search_path = public as $$
  select public.is_owner() or exists (
    select 1 from docs where path = 'roster/' || auth.uid()::text and data->>'status' = 'member')
$$;

create or replace function public.is_blocked() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from docs where path = 'blocked/' || auth.uid()::text)
$$;

-- If the owner already signed up before this script ran, give them a profile now.
-- (Created after handle_new_user below too; safe to run again.)

-- Create a profile when someone signs up -----------------------------------
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, name, is_owner)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', ''),
          lower(new.email) = (select lower(owner_email) from app_config limit 1));
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- Row level security: this is the real lock on the data ---------------------
alter table public.docs enable row level security;
alter table public.profiles enable row level security;
alter table public.app_config enable row level security;

drop policy if exists docs_read on public.docs;
create policy docs_read on public.docs for select to authenticated using (
  public.is_owner()
  or (coll in ('roster', 'blocked', 'requests') and id = auth.uid()::text)
  or (public.is_member() and coll not in ('requests', 'blocked'))
);

drop policy if exists docs_write on public.docs;
create policy docs_write on public.docs for all to authenticated
using (
  public.is_owner()
  or (coll = 'requests' and id = auth.uid()::text and not public.is_blocked())
  or (public.is_member() and (
        (coll in ('stats', 'checks') and id = auth.uid()::text)
        or coll in ('decks', 'plans', 'subjects', 'chat', 'games', 'gp')))
)
with check (
  public.is_owner()
  or (coll = 'requests' and id = auth.uid()::text and not public.is_blocked())
  or (public.is_member() and (
        (coll in ('stats', 'checks') and id = auth.uid()::text)
        or coll in ('decks', 'plans', 'subjects', 'chat', 'games', 'gp')))
);

drop policy if exists profiles_read on public.profiles;
create policy profiles_read on public.profiles for select to authenticated
  using (id = auth.uid() or public.is_member());
revoke update on public.profiles from authenticated;
grant update (name) on public.profiles to authenticated;
drop policy if exists profiles_update on public.profiles;
create policy profiles_update on public.profiles for update to authenticated
  using (id = auth.uid()) with check (id = auth.uid());

-- Live updates ---------------------------------------------------------------
alter table public.docs replica identity default;
do $$ begin
  alter publication supabase_realtime add table public.docs;
exception when duplicate_object then null; end $$;

-- Backfill: anyone who signed up before this script ran (the owner, usually).
insert into public.profiles (id, name, is_owner)
select u.id, coalesce(u.raw_user_meta_data->>'name', ''),
       lower(u.email) = (select lower(owner_email) from public.app_config limit 1)
from auth.users u
on conflict (id) do update set is_owner = excluded.is_owner;

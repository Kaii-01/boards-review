-- Run this ONCE in Supabase SQL Editor if you already ran schema.sql earlier.
-- It lets people join with just a name (no email). Also turn on:
--   Authentication -> Sign In / Providers -> "Allow anonymous sign-ins".
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into profiles (id, name, is_owner)
  values (new.id, coalesce(new.raw_user_meta_data->>'name', ''),
          coalesce(lower(new.email) = (select lower(owner_email) from app_config limit 1), false));
  return new;
end $$;

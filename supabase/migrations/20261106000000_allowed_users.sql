-- Allowed-people list for Accounts (security fix, 2026-11-06)
--
-- Problem: app_data had "any signed-in account: full access". Public sign-up
-- was closed 2026-11-06, but if it is ever reopened a new account would see
-- and edit all accounting data.
-- Fix: only accounts on public.allowed_users can read/write app_data.
-- To give someone access later: insert into public.allowed_users (user_id)
-- select id from auth.users where email = '<their email>';

create table if not exists public.allowed_users (
  user_id uuid primary key references auth.users(id) on delete cascade,
  added_at timestamptz default now()
);
alter table public.allowed_users enable row level security;
-- No policies: nobody can read/change the list from the app; edit in the SQL editor.

insert into public.allowed_users (user_id)
select id from auth.users
where lower(email) in ('director@ibgctasia.com', 'jaby@ibgctasia.com', 'office.ibgct@gmail.com')
on conflict do nothing;

create or replace function public.is_allowed_user() returns boolean
language sql stable security definer set search_path = public as $$
  select exists (select 1 from public.allowed_users where user_id = auth.uid())
$$;
revoke execute on function public.is_allowed_user() from public, anon;
grant execute on function public.is_allowed_user() to authenticated;

drop policy if exists "auth users full access" on public.app_data;
drop policy if exists authenticated_users_all on public.app_data;
create policy allowed_users_all on public.app_data for all to authenticated
  using (public.is_allowed_user()) with check (public.is_allowed_user());

-- Check: 3 rows
--   select u.email from public.allowed_users a join auth.users u on u.id = a.user_id;

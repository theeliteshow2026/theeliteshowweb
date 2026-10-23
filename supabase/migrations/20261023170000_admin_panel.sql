-- Applied to the elite-show-community Supabase project on 2026-10-23.
-- Content for the admin panel (admin/): sessions, mentors, reviews, the admin
-- list, panel settings and a change history used for undo.
--
-- Who can do what:
--   * Visitors (anon) can read published sessions and reviews, nothing else.
--   * Admins are signed-in users whose email is in public.admins AND who passed
--     the authenticator-app step (aal2). They can manage everything here and read
--     Premium members and payments for the dashboard.
--   * Everyone else gets nothing.
-- The first admin (the owner) is added by hand in the SQL editor:
--   insert into public.admins (email, is_owner) values ('you@example.com', true);

create schema if not exists private;
grant usage on schema private to authenticated;

-- ===== Who is an admin =====
create table public.admins (
  email text primary key check (email = lower(email) and email like '%_@_%._%'),
  is_owner boolean not null default false,
  added_by text,
  created_at timestamptz not null default now()
);

create function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(auth.jwt() ->> 'aal', '') = 'aal2'
    and exists (select 1 from public.admins a where a.email = lower(auth.jwt() ->> 'email'));
$$;
revoke execute on function private.is_admin() from public, anon;
grant execute on function private.is_admin() to authenticated;

-- ===== Content =====
create table public.mentors (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(name) between 2 and 120),
  role text check (length(role) <= 300),
  notes text check (length(notes) <= 2000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create unique index mentors_name_idx on public.mentors (lower(name));

create table public.sessions (
  id uuid primary key default gen_random_uuid(),
  label text not null check (length(label) between 2 and 80),
  number integer check (number between 1 and 9999),
  title text not null check (length(title) between 2 and 200),
  short text check (length(short) <= 80),
  mentor text not null check (length(mentor) between 2 and 200),
  mentor_id uuid references public.mentors (id) on delete set null,
  summary text check (length(summary) <= 400),
  session_date date not null,
  start_time time not null default '19:30',
  mode text check (mode in ('online', 'offline')),
  venue text check (length(venue) <= 200),
  poster text check (length(poster) <= 500),
  poster_sm text check (length(poster_sm) <= 500),
  status text not null default 'draft' check (status in ('draft', 'published')),
  -- Published sessions stay hidden until this moment (null = straight away)
  publish_at timestamptz,
  drive_file_id text,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index sessions_date_idx on public.sessions (session_date desc);
create index sessions_mentor_idx on public.sessions (mentor_id);
create unique index sessions_drive_file_idx on public.sessions (drive_file_id) where drive_file_id is not null;

create table public.reviews (
  id uuid primary key default gen_random_uuid(),
  quote text not null check (length(quote) between 5 and 600),
  name text not null check (length(name) between 1 and 120),
  role text check (length(role) <= 120),
  session text check (length(session) <= 120),
  sort_order integer not null default 0,
  status text not null default 'published' check (status in ('published', 'hidden')),
  sample boolean not null default false,
  deleted_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index reviews_order_idx on public.reviews (sort_order);

-- Panel settings, such as the Google Drive import link. Admins only.
create table public.settings (
  key text primary key check (length(key) <= 60),
  value jsonb not null,
  updated_at timestamptz not null default now()
);

-- ===== Change history (who changed what, and the row before, for undo) =====
create table public.content_history (
  id bigint generated always as identity primary key,
  table_name text not null,
  row_id text not null,
  action text not null check (action in ('insert', 'update', 'delete')),
  before jsonb,
  after jsonb,
  actor text,
  at timestamptz not null default now()
);
create index content_history_at_idx on public.content_history (at desc);
create index content_history_row_idx on public.content_history (table_name, row_id);

create function private.touch_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create function private.record_history()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  key text := case when tg_table_name = 'admins' then 'email' when tg_table_name = 'settings' then 'key' else 'id' end;
  old_row jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  new_row jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
begin
  insert into public.content_history (table_name, row_id, action, before, after, actor)
  values (tg_table_name, coalesce(new_row, old_row) ->> key, lower(tg_op), old_row, new_row, auth.jwt() ->> 'email');
  return null;
end;
$$;
revoke execute on function private.touch_updated_at(), private.record_history() from public, anon, authenticated;

create trigger mentors_touch before update on public.mentors for each row execute function private.touch_updated_at();
create trigger sessions_touch before update on public.sessions for each row execute function private.touch_updated_at();
create trigger reviews_touch before update on public.reviews for each row execute function private.touch_updated_at();
create trigger settings_touch before update on public.settings for each row execute function private.touch_updated_at();

create trigger mentors_history after insert or update or delete on public.mentors for each row execute function private.record_history();
create trigger sessions_history after insert or update or delete on public.sessions for each row execute function private.record_history();
create trigger reviews_history after insert or update or delete on public.reviews for each row execute function private.record_history();
create trigger admins_history after insert or update or delete on public.admins for each row execute function private.record_history();
create trigger settings_history after insert or update or delete on public.settings for each row execute function private.record_history();

-- ===== Row level security =====
alter table public.admins enable row level security;
alter table public.mentors enable row level security;
alter table public.sessions enable row level security;
alter table public.reviews enable row level security;
alter table public.settings enable row level security;
alter table public.content_history enable row level security;

revoke all on public.admins, public.mentors, public.sessions, public.reviews, public.settings, public.content_history from anon, authenticated;

-- Visitors: published, live content only
grant select on public.sessions, public.reviews to anon, authenticated;
create policy "Visitors read live sessions" on public.sessions for select to anon, authenticated
  using (status = 'published' and deleted_at is null and (publish_at is null or publish_at <= now()));
create policy "Visitors read live reviews" on public.reviews for select to anon, authenticated
  using (status = 'published' and deleted_at is null);

-- Admins
grant insert, update, delete on public.sessions, public.reviews to authenticated;
grant select, insert, update, delete on public.mentors, public.settings to authenticated;
grant select, insert, delete on public.admins to authenticated;
grant select on public.content_history to authenticated;

create policy "Admins read all sessions" on public.sessions for select to authenticated using ((select private.is_admin()));
create policy "Admins add sessions" on public.sessions for insert to authenticated with check ((select private.is_admin()));
create policy "Admins edit sessions" on public.sessions for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Admins delete sessions" on public.sessions for delete to authenticated using ((select private.is_admin()));

create policy "Admins read all reviews" on public.reviews for select to authenticated using ((select private.is_admin()));
create policy "Admins add reviews" on public.reviews for insert to authenticated with check ((select private.is_admin()));
create policy "Admins edit reviews" on public.reviews for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Admins delete reviews" on public.reviews for delete to authenticated using ((select private.is_admin()));

create policy "Admins manage mentors" on public.mentors for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Admins manage settings" on public.settings for all to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));
create policy "Admins read history" on public.content_history for select to authenticated using ((select private.is_admin()));

-- Admins can see the list and add admins, but cannot make owners, remove the owner or remove themselves
create policy "Admins read admins" on public.admins for select to authenticated using ((select private.is_admin()));
create policy "Admins add admins" on public.admins for insert to authenticated
  with check ((select private.is_admin()) and is_owner = false);
create policy "Admins remove other admins" on public.admins for delete to authenticated
  using ((select private.is_admin()) and is_owner = false and email <> lower(auth.jwt() ->> 'email'));

-- Dashboard: admins can read Premium members and payments (still no writes)
grant select on public.premium_members, public.premium_payments to authenticated;
create policy "Admins read premium members" on public.premium_members for select to authenticated using ((select private.is_admin()));
create policy "Admins read premium payments" on public.premium_payments for select to authenticated using ((select private.is_admin()));

-- ===== Poster storage: anyone can view, only admins can upload or change =====
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('posters', 'posters', true, 5242880, array['image/webp', 'image/jpeg', 'image/png'])
on conflict (id) do update set public = true, file_size_limit = excluded.file_size_limit, allowed_mime_types = excluded.allowed_mime_types;

create policy "Admins read posters" on storage.objects for select to authenticated
  using (bucket_id = 'posters' and (select private.is_admin()));
create policy "Admins upload posters" on storage.objects for insert to authenticated
  with check (bucket_id = 'posters' and (select private.is_admin()));
create policy "Admins replace posters" on storage.objects for update to authenticated
  using (bucket_id = 'posters' and (select private.is_admin())) with check (bucket_id = 'posters' and (select private.is_admin()));
create policy "Admins delete posters" on storage.objects for delete to authenticated
  using (bucket_id = 'posters' and (select private.is_admin()));

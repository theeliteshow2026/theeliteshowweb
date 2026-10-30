-- Applied to the elite-show-community Supabase project on 2026-10-30.
-- The admin panel's Business page: why each Premium member ended their subscription.
-- Admins mark a reason (and, if needed, correct whether it was voluntary or payment
-- related) on the Cancelled members list. One row per member. Admins only.
create table public.premium_cancellation_notes (
  member_id uuid primary key references public.premium_members (id) on delete cascade,
  reason text check (reason in ('too_expensive', 'not_using', 'no_value', 'found_alternative', 'personal', 'payment_failed', 'other')),
  kind text check (kind in ('voluntary', 'payment')),
  note text check (char_length(note) <= 1000),
  updated_by text default lower(auth.jwt() ->> 'email'),
  updated_at timestamptz not null default now()
);

alter table public.premium_cancellation_notes enable row level security;
revoke all on public.premium_cancellation_notes from anon, authenticated;
grant select, insert, update on public.premium_cancellation_notes to authenticated;
create policy "Admins read cancellation notes" on public.premium_cancellation_notes for select to authenticated using ((select private.is_admin()));
create policy "Admins add cancellation notes" on public.premium_cancellation_notes for insert to authenticated with check ((select private.is_admin()));
create policy "Admins edit cancellation notes" on public.premium_cancellation_notes for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

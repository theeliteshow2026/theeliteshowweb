-- Premium is paused for now: instead of paying, people join a waitlist and agree
-- to pay ₹199 a month once Premium reopens. The website adds people only through
-- join_premium_waitlist(); admins read and manage the list in the admin panel.
create table public.premium_waitlist (
  id uuid primary key default gen_random_uuid(),
  name text not null check (char_length(name) between 1 and 120),
  email text not null check (char_length(email) between 3 and 200),
  phone text not null check (char_length(phone) between 6 and 30),
  state text check (char_length(state) <= 80),
  city text check (char_length(city) <= 80),
  age text check (char_length(age) <= 20),
  role text check (char_length(role) <= 80),
  topics text check (char_length(topics) <= 400),
  involvement text check (char_length(involvement) <= 120),
  agreed_to_pay boolean not null default false,
  agreed_amount integer not null default 199,
  agreed_at timestamptz,
  status text not null default 'waiting' check (status in ('waiting', 'contacted', 'joined', 'removed')),
  note text check (char_length(note) <= 1000),
  signups integer not null default 1,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index premium_waitlist_email_key on public.premium_waitlist (lower(email));

alter table public.premium_waitlist enable row level security;
revoke all on public.premium_waitlist from anon, authenticated;
grant select, update on public.premium_waitlist to authenticated;
create policy "Admins read the Premium waitlist" on public.premium_waitlist for select to authenticated using ((select private.is_admin()));
create policy "Admins edit the Premium waitlist" on public.premium_waitlist for update to authenticated using ((select private.is_admin())) with check ((select private.is_admin()));

-- The only way in from the website. Signing up again with the same email refreshes
-- that person's details instead of adding a second row; an admin's status and note stay.
create function public.join_premium_waitlist(
  p_name text, p_email text, p_phone text,
  p_state text default null, p_city text default null, p_age text default null,
  p_role text default null, p_topics text default null, p_involvement text default null,
  p_agreed_to_pay boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(p_email));
begin
  if not coalesce(p_agreed_to_pay, false) then
    raise exception 'agreement_required' using errcode = '22023';
  end if;
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'invalid_email' using errcode = '22023';
  end if;

  insert into public.premium_waitlist as w (name, email, phone, state, city, age, role, topics, involvement, agreed_to_pay, agreed_at)
  values (btrim(p_name), v_email, btrim(p_phone), nullif(btrim(p_state), ''), nullif(btrim(p_city), ''), nullif(p_age, ''),
          nullif(p_role, ''), nullif(p_topics, ''), nullif(p_involvement, ''), true, now())
  on conflict (lower(email)) do update set
    name = excluded.name, phone = excluded.phone, state = excluded.state, city = excluded.city,
    age = excluded.age, role = excluded.role, topics = excluded.topics, involvement = excluded.involvement,
    agreed_to_pay = true, agreed_at = now(), signups = w.signups + 1, updated_at = now();

  return jsonb_build_object('ok', true);
end;
$$;

revoke execute on function public.join_premium_waitlist(text, text, text, text, text, text, text, text, text, boolean) from public;
grant execute on function public.join_premium_waitlist(text, text, text, text, text, text, text, text, text, boolean) to anon, authenticated;

-- Applied to the elite-show-community Supabase project on 2026-10-23.
-- Admin sign-in becomes: email on the admin list -> 6-digit code sent to that email
-- -> the admin's own panel password. The authenticator-app step is gone.
--
-- The database checks both steps itself, so changing the page can't skip one:
--   * the email step is proven by how the Supabase session was made (an email code
--     or link, never a Supabase password), read from the token's "amr" list;
--   * the password step is recorded against that exact session (its session_id) and
--     lasts 12 hours. private.is_admin(), which every admin rule uses, needs both.
-- Passwords are bcrypt hashes in the unexposed private schema. Five wrong tries lock
-- that admin for 15 minutes. The owner can reset anyone's password from the panel (the
-- hash is cleared and their sign-ins end); the admin then makes a new one at their next
-- sign-in. Sign-outs and resets expire rows rather than deleting them.
--
-- public.hook_admin_only_signups is the "Before User Created" auth hook: it stops
-- Supabase making accounts (and sending codes) for emails that aren't on the list.
-- Turn it on in Dashboard > Authentication > Auth Hooks.

-- ===== Passwords and finished sign-ins =====
create table private.admin_passwords (
  email text primary key references public.admins (email) on delete cascade on update cascade,
  hash text, -- null after a reset, until the admin makes a new password
  set_at timestamptz not null default now(),
  failed_count integer not null default 0,
  locked_until timestamptz
);

create table private.admin_sign_ins (
  session_id uuid primary key,
  email text not null references public.admins (email) on delete cascade on update cascade,
  verified_at timestamptz not null default now()
);
create index admin_sign_ins_email_idx on private.admin_sign_ins (email);

alter table private.admin_passwords enable row level security;
alter table private.admin_sign_ins enable row level security;
revoke all on private.admin_passwords, private.admin_sign_ins from public, anon, authenticated;

-- ===== Helpers =====
-- True when this session was opened with an email code or email link
create function private.email_proven()
returns boolean
language sql
stable
set search_path = ''
as $$
  select exists (
    select 1 from jsonb_array_elements(coalesce(auth.jwt() -> 'amr', '[]'::jsonb)) m
    where m ->> 'method' in ('otp', 'magiclink', 'email/signup')
  );
$$;

-- The signed-in email, when it is proven and on the admin list (else null)
create function private.listed_email()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select a.email from public.admins a
  where a.email = lower(auth.jwt() ->> 'email') and private.email_proven();
$$;

create or replace function private.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from private.admin_sign_ins s
    where s.session_id = nullif(auth.jwt() ->> 'session_id', '')::uuid
      and s.email = private.listed_email()
      and s.verified_at > now() - interval '12 hours'
  );
$$;

revoke execute on function private.email_proven(), private.listed_email() from public, anon, authenticated;
revoke execute on function private.is_admin() from public, anon;
grant execute on function private.is_admin() to authenticated;

-- ===== What the sign-in screen calls =====
-- Where this person is in the sign-in: on the list? password made? locked? done?
create function public.admin_auth_state()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_email text := private.listed_email();
  v_pw private.admin_passwords;
  v_until timestamptz;
begin
  if v_email is null then
    return jsonb_build_object('listed', false);
  end if;
  select * into v_pw from private.admin_passwords where email = v_email;
  select s.verified_at + interval '12 hours' into v_until
    from private.admin_sign_ins s
    where s.session_id = nullif(auth.jwt() ->> 'session_id', '')::uuid
      and s.email = v_email
      and s.verified_at > now() - interval '12 hours';
  return jsonb_build_object(
    'listed', true,
    'has_password', v_pw.hash is not null,
    'locked_until', case when v_pw.locked_until > now() then v_pw.locked_until end,
    'signed_in_until', v_until
  );
end;
$$;

-- First sign-in (or after a reset): make a password, which also finishes this sign-in
create function public.admin_set_password(new_password text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := private.listed_email();
  v_session uuid := nullif(auth.jwt() ->> 'session_id', '')::uuid;
begin
  if v_email is null or v_session is null then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  if exists (select 1 from private.admin_passwords where email = v_email and hash is not null) then
    raise exception 'A password is already set. Ask the owner to reset it.' using errcode = '42501';
  end if;
  if new_password is null or length(new_password) < 10 or octet_length(new_password) > 72 then
    raise exception 'Use 10 to 72 characters.' using errcode = '22023';
  end if;
  insert into private.admin_passwords (email, hash)
    values (v_email, extensions.crypt(new_password, extensions.gen_salt('bf', 10)))
    on conflict (email) do update
      set hash = excluded.hash, set_at = now(), failed_count = 0, locked_until = null;
  insert into private.admin_sign_ins (session_id, email) values (v_session, v_email)
    on conflict (session_id) do update set email = excluded.email, verified_at = now();
  return jsonb_build_object('ok', true, 'signed_in_until', now() + interval '12 hours');
end;
$$;

-- Every later sign-in: check the password. Wrong tries count towards a lock.
create function public.admin_verify_password(password text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := private.listed_email();
  v_session uuid := nullif(auth.jwt() ->> 'session_id', '')::uuid;
  v_pw private.admin_passwords;
  v_fails integer;
begin
  if v_email is null or v_session is null then
    raise exception 'Not allowed' using errcode = '42501';
  end if;
  select * into v_pw from private.admin_passwords where email = v_email for update;
  if not found or v_pw.hash is null then
    return jsonb_build_object('ok', false, 'needs_password', true);
  end if;
  if v_pw.locked_until > now() then
    return jsonb_build_object('ok', false, 'locked_until', v_pw.locked_until);
  end if;
  if extensions.crypt(coalesce(password, ''), v_pw.hash) = v_pw.hash then
    update private.admin_passwords set failed_count = 0, locked_until = null where email = v_email;
    insert into private.admin_sign_ins (session_id, email) values (v_session, v_email)
      on conflict (session_id) do update set email = excluded.email, verified_at = now();
    return jsonb_build_object('ok', true, 'signed_in_until', now() + interval '12 hours');
  end if;
  v_fails := v_pw.failed_count + 1;
  if v_fails >= 5 then
    update private.admin_passwords set failed_count = 0, locked_until = now() + interval '15 minutes' where email = v_email;
    return jsonb_build_object('ok', false, 'locked_until', now() + interval '15 minutes');
  end if;
  update private.admin_passwords set failed_count = v_fails where email = v_email;
  return jsonb_build_object('ok', false, 'tries_left', 5 - v_fails);
end;
$$;

-- Ends this sign-in on the server too
create function public.admin_sign_out()
returns void
language sql
security definer
set search_path = ''
as $$
  update private.admin_sign_ins set verified_at = '-infinity'
  where session_id = nullif(auth.jwt() ->> 'session_id', '')::uuid;
$$;

-- ===== What the Admins page calls =====
-- Has each admin made a password yet, and is anyone locked?
create function public.admin_password_status()
returns table (email text, has_password boolean, locked boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select a.email, p.hash is not null, coalesce(p.locked_until > now(), false)
  from public.admins a
  left join private.admin_passwords p on p.email = a.email
  where private.is_admin();
$$;

-- Owner only: clear an admin's password (and sign them out everywhere)
create function public.admin_reset_password(target_email text)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  if not private.is_admin()
     or not exists (select 1 from public.admins where email = private.listed_email() and is_owner) then
    raise exception 'Only the owner can reset passwords' using errcode = '42501';
  end if;
  update private.admin_passwords set hash = null, failed_count = 0, locked_until = null
    where email = lower(target_email);
  update private.admin_sign_ins set verified_at = '-infinity' where email = lower(target_email);
end;
$$;

revoke execute on function
  public.admin_auth_state(), public.admin_set_password(text), public.admin_verify_password(text),
  public.admin_sign_out(), public.admin_password_status(), public.admin_reset_password(text)
  from public, anon;
grant execute on function
  public.admin_auth_state(), public.admin_set_password(text), public.admin_verify_password(text),
  public.admin_sign_out(), public.admin_password_status(), public.admin_reset_password(text)
  to authenticated;

-- ===== Auth hook: only listed emails can get an account =====
create function public.hook_admin_only_signups(event jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (select 1 from public.admins where email = lower(event -> 'user' ->> 'email')) then
    return '{}'::jsonb;
  end if;
  return jsonb_build_object('error', jsonb_build_object(
    'http_code', 403,
    'message', 'This email is not on the admin list.'
  ));
end;
$$;
revoke execute on function public.hook_admin_only_signups(jsonb) from public, anon, authenticated;
grant execute on function public.hook_admin_only_signups(jsonb) to supabase_auth_admin;

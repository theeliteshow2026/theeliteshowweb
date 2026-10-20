-- Applied to the elite-show-community Supabase project on 2026-10-20.
-- Premium Community members, their Razorpay payments, and a log of Razorpay
-- webhook deliveries. Only the Edge Functions (secret key) read or write these.

create sequence public.premium_member_number_seq;

create table public.premium_members (
  id uuid primary key default gen_random_uuid(),
  -- Readable member ID (ESP-0001, ESP-0002 ...), given when the first payment succeeds
  member_code text unique,
  name text not null,
  email text not null,
  phone text not null,
  razorpay_subscription_id text not null unique,
  razorpay_customer_id text,
  status text not null default 'created'
    check (status in ('created', 'authenticated', 'active', 'pending', 'halted', 'paused', 'cancelled', 'completed', 'expired')),
  current_period_end timestamptz,
  activated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index premium_members_email_idx on public.premium_members (lower(email));

create table public.premium_payments (
  id uuid primary key default gen_random_uuid(),
  member_id uuid references public.premium_members (id) on delete set null,
  razorpay_payment_id text not null unique,
  razorpay_subscription_id text,
  amount_paise integer,
  currency text default 'INR',
  status text not null,
  method text,
  paid_at timestamptz,
  created_at timestamptz not null default now()
);

create index premium_payments_member_idx on public.premium_payments (member_id);

create table public.razorpay_webhook_events (
  event_id text primary key,
  event text not null,
  payload jsonb not null,
  received_at timestamptz not null default now()
);

-- Give a member their ID the first time they become active, and keep updated_at fresh
create function public.premium_members_before_write()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  if new.status = 'active' and new.member_code is null then
    new.member_code := 'ESP-' || lpad(nextval('public.premium_member_number_seq')::text, 4, '0');
    new.activated_at := coalesce(new.activated_at, now());
  end if;
  return new;
end;
$$;

create trigger premium_members_before_write
before insert or update on public.premium_members
for each row execute function public.premium_members_before_write();

-- Locked down: RLS on with no policies, and no table access for the public roles
alter table public.premium_members enable row level security;
alter table public.premium_payments enable row level security;
alter table public.razorpay_webhook_events enable row level security;

revoke all on public.premium_members, public.premium_payments, public.razorpay_webhook_events from anon, authenticated;
revoke all on sequence public.premium_member_number_seq from anon, authenticated;
revoke execute on function public.premium_members_before_write() from public, anon, authenticated;

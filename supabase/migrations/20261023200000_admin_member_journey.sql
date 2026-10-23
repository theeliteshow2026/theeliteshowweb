-- Applied to the elite-show-community Supabase project on 2026-10-23.
-- The admin panel's Members page: each Premium member's subscription journey, built
-- from the Razorpay webhook events. Only safe fields leave the database (event, time,
-- amount, method, status, failure reason, subscription status and period end), never
-- card, bank, UPI or contact details from the raw payload. Admins only.
create function public.admin_member_events()
returns table (
  subscription_id text,
  event text,
  at timestamptz,
  amount_paise integer,
  method text,
  payment_status text,
  error text,
  sub_status text,
  current_end timestamptz,
  remaining_count integer
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    e.payload -> 'payload' -> 'subscription' -> 'entity' ->> 'id',
    e.event,
    coalesce(to_timestamp(nullif(e.payload -> 'payload' -> 'payment' -> 'entity' ->> 'created_at', '')::bigint), e.received_at),
    nullif(e.payload -> 'payload' -> 'payment' -> 'entity' ->> 'amount', '')::integer,
    e.payload -> 'payload' -> 'payment' -> 'entity' ->> 'method',
    e.payload -> 'payload' -> 'payment' -> 'entity' ->> 'status',
    e.payload -> 'payload' -> 'payment' -> 'entity' ->> 'error_description',
    e.payload -> 'payload' -> 'subscription' -> 'entity' ->> 'status',
    to_timestamp(nullif(e.payload -> 'payload' -> 'subscription' -> 'entity' ->> 'current_end', '')::bigint),
    nullif(e.payload -> 'payload' -> 'subscription' -> 'entity' ->> 'remaining_count', '')::integer
  from public.razorpay_webhook_events e
  where private.is_admin()
    and e.payload -> 'payload' -> 'subscription' -> 'entity' ->> 'id' is not null
  order by 3;
$$;
revoke execute on function public.admin_member_events() from public, anon;
grant execute on function public.admin_member_events() to authenticated;

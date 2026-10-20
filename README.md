# theeliteshowweb
The community website for The Elite Show Community.

## Premium Community payments

Premium (₹199/month) runs on Razorpay Subscriptions with a Supabase backend
(project `elite-show-community`). The join form itself still goes to the
Google Sheet through `google_apps_script.gs`.

- `supabase/functions/create-subscription`: starts a subscription and returns what Razorpay Checkout needs.
- `supabase/functions/verify-payment`: checks Razorpay's signature, marks the member active, and returns their member ID (ESP-0001, ...) and the Premium community link.
- `supabase/functions/razorpay-webhook`: keeps each member's status current for renewals, failures and cancellations.
- `supabase/migrations/`: the `premium_members`, `premium_payments` and `razorpay_webhook_events` tables (RLS on, no public access).

Secrets, set in Supabase under Edge Functions > Secrets (never in this repo):
`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_PLAN_ID`, `RAZORPAY_WEBHOOK_SECRET`, `PREMIUM_COMMUNITY_LINK`.

Razorpay webhook URL: `https://mlrzeqekvhbzwnblzzlv.supabase.co/functions/v1/razorpay-webhook`
with the `subscription.*` and `payment.failed` events.

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

## Admin panel (`/admin`)

Sessions, reviews, mentors and admins are managed at `/admin` and stored in the same
Supabase project. The full site reads live sessions and reviews through `site_content.js`
and falls back to `mentor_sessions.js` / `reviews.js` if Supabase doesn't answer.

- Sign-in: email -> 6-digit code sent to that email -> the admin's own panel password
  (made at their first sign-in, reset by the owner on the Admins page). Only emails in the
  `admins` table get in. The database checks both steps (`private.is_admin()` in
  `supabase/migrations/20261023190000_admin_password_sign_in.sql`), refuses every change from
  anyone else, and only published content is public. A sign-in lasts 12 hours; five wrong
  passwords lock that admin for 15 minutes.
- Poster reading is free and runs in the browser (`admin/poster_reader.js`, Tesseract in
  `vendor/tesseract`). Check it against the real posters with `node tools/poster_reader_check.js`.
- Posters uploaded in the panel go to the public `posters` storage bucket (900px and 480px WebP).
- Every change is kept in `content_history`, which the panel's History page uses for undo.
- Google Drive import: `admin/drive_import_apps_script.gs` (setup steps at the top of the file).

Supabase dashboard settings the sign-in needs (Authentication):
- Emails > SMTP Settings: custom SMTP (the owner's Gmail with an app password, smtp.gmail.com:465).
- Email Templates > Magic Link and Confirm signup: the code email in
  `supabase/templates/admin_code_email.html` (subject "Your Elite Show admin sign-in code").
- Sign In / Providers > Email: Email OTP Expiration = 600 seconds.
- Auth Hooks > Before User Created: Postgres function `public.hook_admin_only_signups`, so
  codes are only sent to emails on the admin list.

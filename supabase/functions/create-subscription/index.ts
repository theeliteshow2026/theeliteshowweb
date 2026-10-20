// POST /functions/v1/create-subscription  { name, email, phone }
// Starts a ₹199/month Razorpay subscription for a new Premium member and
// returns what the browser needs to open Razorpay Checkout.
import { corsHeaders, db, json, missingEnv, notConfigured, razorpay } from '../_shared/payments.ts';

// Razorpay needs an end date for every subscription: 120 monthly cycles is ten years
const TOTAL_MONTHS = 120;

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { success: false, message: 'Use POST.' });

  const missing = missingEnv(['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET', 'RAZORPAY_PLAN_ID']);
  if (missing.length) return notConfigured(missing);

  const body = await req.json().catch(() => ({}));
  const name = String(body.name || '').trim().slice(0, 100);
  const email = String(body.email || '').trim().toLowerCase().slice(0, 200);
  const phone = String(body.phone || '').replace(/[^\d+]/g, '').slice(0, 15);
  if (!name || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) || phone.replace(/\D/g, '').length < 10) {
    return json(400, { success: false, message: 'Name, a valid email and a phone number are required.' });
  }

  try {
    const subscription = await razorpay('/subscriptions', {
      method: 'POST',
      body: {
        plan_id: Deno.env.get('RAZORPAY_PLAN_ID'),
        total_count: TOTAL_MONTHS,
        quantity: 1,
        customer_notify: 1,
        notes: { name, email, phone }
      }
    });
    await db('premium_members', {
      method: 'POST',
      prefer: 'return=minimal',
      body: { name, email, phone, razorpay_subscription_id: subscription.id, status: 'created' }
    });
    return json(200, { success: true, subscriptionId: subscription.id, keyId: Deno.env.get('RAZORPAY_KEY_ID') });
  } catch (err) {
    console.error(err);
    return json(502, { success: false, message: 'Could not start the payment. Please try again.' });
  }
});

// POST /functions/v1/razorpay-webhook
// Razorpay calls this for every subscription event: first payment, each
// monthly renewal, failed payments and cancellations. It keeps each member's
// status in the database true to what Razorpay knows.
import { db, hmacHex, json, missingEnv, notConfigured, periodEnd, safeEqual, savePayment, updateMemberBySubscription } from '../_shared/payments.ts';

const HANDLED = new Set([
  'subscription.authenticated', 'subscription.activated', 'subscription.charged', 'subscription.pending',
  'subscription.halted', 'subscription.paused', 'subscription.resumed', 'subscription.cancelled',
  'subscription.completed', 'payment.failed'
]);

Deno.serve(async req => {
  if (req.method !== 'POST') return json(405, { success: false, message: 'Use POST.' });

  const missing = missingEnv(['RAZORPAY_WEBHOOK_SECRET']);
  if (missing.length) return notConfigured(missing);

  // The signature covers the exact bytes Razorpay sent
  const raw = await req.text();
  const expected = await hmacHex(Deno.env.get('RAZORPAY_WEBHOOK_SECRET')!, raw);
  if (!safeEqual(expected, req.headers.get('x-razorpay-signature') || '')) {
    return json(401, { success: false, message: 'Bad signature.' });
  }

  let event: any;
  try {
    event = JSON.parse(raw);
  } catch (_e) {
    return json(400, { success: false, message: 'Bad JSON.' });
  }
  if (!HANDLED.has(event.event)) return json(200, { success: true, ignored: event.event });

  // Razorpay retries deliveries; skip an event already handled
  const eventId = req.headers.get('x-razorpay-event-id') || `${event.event}:${event.created_at}:${raw.length}`;
  const seen = await db(`razorpay_webhook_events?event_id=eq.${encodeURIComponent(eventId)}&select=event_id`);
  if (seen.length) return json(200, { success: true, duplicate: true });

  const subscription = event.payload?.subscription?.entity || null;
  const payment = event.payload?.payment?.entity || null;
  const subscriptionId = subscription?.id || payment?.subscription_id || '';

  try {
    let member = null;
    if (subscription) {
      member = await updateMemberBySubscription(subscription.id, {
        status: subscription.status,
        razorpay_customer_id: subscription.customer_id || null,
        current_period_end: periodEnd(subscription)
      });
      // A subscription made outside the website (e.g. from the Razorpay dashboard)
      if (!member && subscription.notes?.email) {
        const rows = await db('premium_members', {
          method: 'POST',
          prefer: 'return=representation',
          body: {
            name: subscription.notes.name || subscription.notes.email,
            email: String(subscription.notes.email).toLowerCase(),
            phone: subscription.notes.phone || '',
            razorpay_subscription_id: subscription.id,
            razorpay_customer_id: subscription.customer_id || null,
            status: subscription.status,
            current_period_end: periodEnd(subscription)
          }
        });
        member = rows[0];
      }
    }
    if (payment) {
      if (!member && subscriptionId) {
        const rows = await db(`premium_members?razorpay_subscription_id=eq.${encodeURIComponent(subscriptionId)}&select=id`);
        member = rows[0] || null;
      }
      await savePayment(member ? member.id : null, payment, subscriptionId);
    }
    await db('razorpay_webhook_events', {
      method: 'POST',
      prefer: 'resolution=ignore-duplicates,return=minimal',
      body: { event_id: eventId, event: event.event, payload: event }
    });
  } catch (err) {
    // A non-2xx reply makes Razorpay retry later, which is what we want here
    console.error(err);
    return json(500, { success: false, message: 'Could not save the event.' });
  }

  return json(200, { success: true });
});

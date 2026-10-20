// POST /functions/v1/verify-payment
//   { razorpay_payment_id, razorpay_subscription_id, razorpay_signature }
// Called by the browser after Razorpay Checkout succeeds. Only a payment with
// a valid Razorpay signature makes someone an active member, with their ID.
import {
  corsHeaders, hmacHex, json, missingEnv, notConfigured, periodEnd, razorpay, safeEqual, savePayment,
  updateMemberBySubscription
} from '../_shared/payments.ts';

Deno.serve(async req => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  if (req.method !== 'POST') return json(405, { success: false, message: 'Use POST.' });

  const missing = missingEnv(['RAZORPAY_KEY_ID', 'RAZORPAY_KEY_SECRET']);
  if (missing.length) return notConfigured(missing);

  const body = await req.json().catch(() => ({}));
  const paymentId = String(body.razorpay_payment_id || '');
  const subscriptionId = String(body.razorpay_subscription_id || '');
  const signature = String(body.razorpay_signature || '');

  const expected = await hmacHex(Deno.env.get('RAZORPAY_KEY_SECRET')!, `${paymentId}|${subscriptionId}`);
  if (!paymentId || !subscriptionId || !safeEqual(expected, signature)) {
    return json(400, { success: false, message: 'Payment could not be verified.' });
  }

  try {
    const [subscription, payment] = await Promise.all([
      razorpay(`/subscriptions/${encodeURIComponent(subscriptionId)}`),
      razorpay(`/payments/${encodeURIComponent(paymentId)}`)
    ]);
    const member = await updateMemberBySubscription(subscriptionId, {
      status: 'active',
      razorpay_customer_id: subscription.customer_id || null,
      current_period_end: periodEnd(subscription)
    });
    if (!member) throw new Error(`No member row for ${subscriptionId}`);
    await savePayment(member.id, payment, subscriptionId);

    return json(200, {
      success: true,
      memberCode: member.member_code,
      name: member.name,
      communityLink: Deno.env.get('PREMIUM_COMMUNITY_LINK') || ''
    });
  } catch (err) {
    // The payment itself is genuine; the webhook will finish recording it
    console.error(err);
    return json(200, { success: true, memberCode: null, communityLink: Deno.env.get('PREMIUM_COMMUNITY_LINK') || '' });
  }
});

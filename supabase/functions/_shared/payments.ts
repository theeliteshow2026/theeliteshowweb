// Shared helpers for the Premium Community payment functions.

export const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'content-type, apikey, authorization, x-client-info',
  'Access-Control-Allow-Methods': 'POST, OPTIONS'
};

export function json(status: number, data: unknown): Response {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json', 'Cache-Control': 'no-store' }
  });
}

export function missingEnv(names: string[]): string[] {
  return names.filter(name => !Deno.env.get(name));
}

export function notConfigured(names: string[]): Response {
  console.error('Payments are not configured. Missing secrets:', names.join(', '));
  return json(503, { success: false, code: 'not_configured', message: 'Payments are not set up yet.' });
}

const encoder = new TextEncoder();

export async function hmacHex(secret: string, text: string): Promise<string> {
  const key = await crypto.subtle.importKey('raw', encoder.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, encoder.encode(text));
  return [...new Uint8Array(signature)].map(b => b.toString(16).padStart(2, '0')).join('');
}

// Compares without stopping at the first different character
export function safeEqual(a: string, b: string): boolean {
  if (!a || !b || a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return diff === 0;
}

// ----- Razorpay REST API -----
export async function razorpay(path: string, init: { method?: string; body?: unknown } = {}) {
  const auth = btoa(`${Deno.env.get('RAZORPAY_KEY_ID')}:${Deno.env.get('RAZORPAY_KEY_SECRET')}`);
  const res = await fetch(`https://api.razorpay.com/v1${path}`, {
    method: init.method || 'GET',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
    body: init.body ? JSON.stringify(init.body) : undefined
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(`Razorpay ${init.method || 'GET'} ${path} failed: ${data?.error?.description || res.status}`);
  return data;
}

// ----- Database, through the project's REST API with the secret key -----
// The tables have RLS on and no public access, so only these functions can reach them.
function secretKey(): string {
  const keys = Deno.env.get('SUPABASE_SECRET_KEYS');
  if (keys) {
    try {
      const parsed = JSON.parse(keys);
      if (parsed.default) return parsed.default;
    } catch (_e) { /* fall back to the legacy key */ }
  }
  return Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || '';
}

export async function db(path: string, init: { method?: string; body?: unknown; prefer?: string } = {}) {
  const key = secretKey();
  const headers: Record<string, string> = { apikey: key, 'Content-Type': 'application/json' };
  // New sb_secret_ keys go in apikey only; the legacy service_role JWT also needs Authorization
  if (!key.startsWith('sb_secret_')) headers.Authorization = `Bearer ${key}`;
  if (init.prefer) headers.Prefer = init.prefer;
  const res = await fetch(`${Deno.env.get('SUPABASE_URL')}/rest/v1/${path}`, {
    method: init.method || 'GET',
    headers,
    body: init.body ? JSON.stringify(init.body) : undefined
  });
  const text = await res.text();
  if (!res.ok) throw new Error(`Database ${init.method || 'GET'} ${path} failed: ${res.status} ${text}`);
  return text ? JSON.parse(text) : null;
}

export type Member = { id: string; member_code: string | null; name: string; status: string };

export async function updateMemberBySubscription(subscriptionId: string, fields: Record<string, unknown>): Promise<Member | null> {
  const rows = await db(`premium_members?razorpay_subscription_id=eq.${encodeURIComponent(subscriptionId)}`, {
    method: 'PATCH',
    body: fields,
    prefer: 'return=representation'
  });
  return rows && rows[0] ? rows[0] : null;
}

// Records a payment once, however many times Razorpay tells us about it
export async function savePayment(memberId: string | null, payment: Record<string, any>, subscriptionId: string) {
  await db('premium_payments?on_conflict=razorpay_payment_id', {
    method: 'POST',
    prefer: 'resolution=merge-duplicates,return=minimal',
    body: {
      member_id: memberId,
      razorpay_payment_id: payment.id,
      razorpay_subscription_id: subscriptionId || payment.subscription_id || null,
      amount_paise: payment.amount ?? null,
      currency: payment.currency || 'INR',
      status: payment.status || 'captured',
      method: payment.method || null,
      paid_at: payment.created_at ? new Date(payment.created_at * 1000).toISOString() : new Date().toISOString()
    }
  });
}

export function periodEnd(subscription: Record<string, any>): string | null {
  return subscription.current_end ? new Date(subscription.current_end * 1000).toISOString() : null;
}

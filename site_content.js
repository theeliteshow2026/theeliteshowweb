// ===== LIVE CONTENT =====
// Sessions and reviews are managed in the admin panel (/admin) and stored in Supabase.
// This asks Supabase for what is live right now. If it doesn't answer within a few
// seconds, the pages use the copies in mentor_sessions.js and reviews.js instead. An empty
// answer is kept as empty, so hiding everything in the panel really clears the site.
// Needs supabase_config.js loaded first.
const SITE_CONTENT = (function () {
  if (typeof fetch !== 'function' || typeof SUPABASE_URL === 'undefined') return Promise.resolve({});

  function get(path) {
    const controller = typeof AbortController === 'function' ? new AbortController() : null;
    const timer = setTimeout(() => controller && controller.abort(), 2500);
    return fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      headers: { apikey: SUPABASE_PUBLISHABLE_KEY },
      signal: controller ? controller.signal : undefined
    })
      .then(res => (res.ok ? res.json() : null))
      .catch(() => null)
      .finally(() => clearTimeout(timer));
  }

  const sessions = get('sessions?select=label,number,title,short,mentor,summary,session_date,start_time,mode,venue,poster,poster_sm&order=session_date.desc')
    .then(rows => (Array.isArray(rows) ? rows.map(row => ({
      label: row.label,
      number: row.number,
      title: row.title,
      short: row.short,
      mentor: row.mentor,
      summary: row.summary || '',
      date: row.session_date,
      time: (row.start_time || '19:30').slice(0, 5),
      mode: row.mode,
      venue: row.venue,
      poster: row.poster || '',
      posterSmall: row.poster_sm || ''
    })) : null));

  const reviews = get('reviews?select=quote,name,role,session,sample&order=sort_order.asc,created_at.asc')
    .then(rows => (Array.isArray(rows) ? rows : null));

  return Promise.all([sessions, reviews]).then(([s, r]) => ({ sessions: s, reviews: r }));
})();

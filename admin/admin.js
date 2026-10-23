// ===== ADMIN PANEL =====
// Sign-in (email link or code, then an authenticator app code), and the screens for
// sessions, reviews, mentors, admins, history and settings. Everything is stored in
// Supabase; the database rules decide who may change what, so this page only has to
// be friendly, not trusted.
(function () {
  'use strict';

  const db = supabase.createClient(SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true, flowType: 'pkce' }
  });

  const KINDS = ['Mentor Session', 'Workshop', 'Community Session', 'Elite Brew', 'Masterclass', 'Meetup', 'Panel Discussion', 'Bootcamp', 'Webinar'];
  const NUMBERED = new Set(['Mentor Session', 'Workshop', 'Masterclass', 'Bootcamp', 'Webinar']);
  const DEFAULT_TIME = '19:30';
  const SHEET_COMING_SOON = 'https://docs.google.com/spreadsheets/d/15KEHG65Qm9pt1qfzanXmCoQwTTnS7wlRbH68eSAID0g';

  const state = { me: null, sessions: [], driveIds: new Set(), mentors: [], reviews: [], admins: [], settings: {}, drive: null };
  let timers = [];

  // ---------- Small helpers ----------
  const $ = (sel, root = document) => root.querySelector(sel);
  const $$ = (sel, root = document) => [...root.querySelectorAll(sel)];

  // Builds elements without ever treating data as HTML
  function h(tag, attrs, ...kids) {
    const node = document.createElement(tag);
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') node.className = v;
      else if (k === 'text') node.textContent = v;
      else if (k.startsWith('on')) node.addEventListener(k.slice(2), v);
      else if (k === 'dataset') Object.assign(node.dataset, v);
      else if (k in node && typeof v !== 'string') node[k] = v;
      else node.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat(Infinity)) {
      if (kid == null || kid === false) continue;
      node.append(kid instanceof Node ? kid : document.createTextNode(String(kid)));
    }
    return node;
  }

  const pad = n => String(n).padStart(2, '0');
  const todayIST = () => new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
  const weekdayOf = iso => new Date(iso + 'T00:00:00Z').getUTCDay();
  const DAY_NAMES = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];

  function formatDate(iso, opts = { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }) {
    if (!iso) return '';
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-IN', opts);
  }
  function formatTime(t) {
    if (!t) return '';
    const [hh, mm] = t.split(':').map(Number);
    return `${((hh + 11) % 12) + 1}:${pad(mm)} ${hh < 12 ? 'AM' : 'PM'}`;
  }
  function formatWhen(isoStamp) {
    return new Date(isoStamp).toLocaleString('en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata' });
  }
  // A session's start as a moment in time (dates and times are India time)
  const startOf = s => Date.parse(`${s.session_date}T${(s.start_time || DEFAULT_TIME).slice(0, 5)}:00+05:30`);
  // datetime-local text (India time) <-> ISO
  const localToIso = v => (v ? new Date(v + ':00+05:30').toISOString() : null);
  const isoToLocal = v => (v ? new Date(Date.parse(v) + 5.5 * 3600e3).toISOString().slice(0, 16) : '');

  function relative(isoStamp) {
    const s = Math.round((Date.now() - Date.parse(isoStamp)) / 1000);
    if (s < 60) return 'just now';
    if (s < 3600) return `${Math.round(s / 60)} min ago`;
    if (s < 86400) return `${Math.round(s / 3600)} h ago`;
    return `${Math.round(s / 86400)} d ago`;
  }

  const posterSrc = p => (!p ? '' : /^https?:/.test(p) ? p : '../' + p);
  function thumbSrc(s) {
    if (s.poster_sm) return s.poster_sm;
    if (s.poster && s.poster.startsWith('posters/')) return '../posters/sm/' + s.poster.replace(/^posters\//, '').replace(/\.[a-z]+$/i, '') + '.webp';
    return posterSrc(s.poster);
  }
  function thumb(s, cls) {
    if (!s.poster) return h('div', { class: 'thumb-gen ' + (cls || ''), text: s.number ? '#' + pad(s.number) : (s.label || 'Session') });
    const img = h('img', { class: cls, alt: '', loading: 'lazy', src: thumbSrc(s) });
    img.addEventListener('error', () => { if (img.src !== posterSrc(s.poster)) img.src = posterSrc(s.poster); }, { once: true });
    return img;
  }

  function toast(message, { action, onAction, bad, ms = action ? 8000 : 4500 } = {}) {
    const box = h('div', { class: 'toast' + (bad ? ' bad' : ''), role: bad ? 'alert' : 'status' }, h('span', { text: message }));
    if (action) box.append(h('button', { class: 'btn btn-small', type: 'button', text: action, onclick: () => { box.remove(); onAction(); } }));
    $('#toasts').append(box);
    setTimeout(() => box.remove(), ms);
  }
  const fail = (what, error) => {
    console.error(what, error);
    toast(`${what}: ${(error && (error.message || error.error_description)) || 'something went wrong'}`, { bad: true, ms: 9000 });
  };

  async function busy(button, work) {
    const label = button.textContent;
    button.disabled = true;
    button.textContent = 'Working…';
    try { return await work(); } finally { button.disabled = false; button.textContent = label; }
  }

  const sessionLabel = (kind, number) => (number ? `${kind} #${pad(number)}` : kind);
  function splitLabel(label) {
    const m = (label || '').match(/^(.*?)\s*#\s*(\d+)$/);
    const kind = m ? m[1] : label || 'Mentor Session';
    return { kind, number: m ? Number(m[2]) : null };
  }
  function slug(text) {
    return (text || 'session').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'session';
  }

  // ---------- Sign in ----------
  const gate = $('#gate');
  let pendingEmail = '';
  let enrollingFactor = null;

  function step(name, email) {
    $('#app').hidden = true;
    gate.hidden = false;
    $$('.gate-step', gate).forEach(el => { el.hidden = el.dataset.step !== name; });
    $$('[data-email]', gate).forEach(el => { el.textContent = email || pendingEmail; });
    gateError('');
    const input = $(`[data-step="${name}"] input`, gate);
    if (input) setTimeout(() => input.focus(), 30);
  }
  function gateError(message) {
    const box = $('#gateError');
    box.textContent = message;
    box.hidden = !message;
  }

  $('#signInForm').addEventListener('submit', async e => {
    e.preventDefault();
    const email = e.target.email.value.trim().toLowerCase();
    await busy(e.submitter || $('button', e.target), async () => {
      const { error } = await db.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: location.origin + location.pathname, shouldCreateUser: true }
      });
      if (error) return gateError(error.status === 429 ? 'Too many sign-in emails just now. Wait a few minutes and try again.' : error.message);
      pendingEmail = email;
      step('code');
    });
  });

  $('#codeForm').addEventListener('submit', async e => {
    e.preventDefault();
    await busy($('button[type=submit]', e.target), async () => {
      const { error } = await db.auth.verifyOtp({ email: pendingEmail, token: e.target.code.value.trim(), type: 'email' });
      if (error) return gateError('That code didn\'t work. Check it, or ask for a new email.');
      route();
    });
  });

  $('#mfaSetupForm').addEventListener('submit', async e => {
    e.preventDefault();
    await busy($('button[type=submit]', e.target), async () => {
      const { error } = await db.auth.mfa.challengeAndVerify({ factorId: enrollingFactor, code: e.target.code.value.trim() });
      if (error) return gateError('That code didn\'t match. Use the newest code in the app.');
      route();
    });
  });

  $('#mfaForm').addEventListener('submit', async e => {
    e.preventDefault();
    await busy($('button[type=submit]', e.target), async () => {
      const { data } = await db.auth.mfa.listFactors();
      const factor = (data.totp || []).find(f => f.status === 'verified');
      const { error } = await db.auth.mfa.challengeAndVerify({ factorId: factor.id, code: e.target.code.value.trim() });
      if (error) return gateError('That code didn\'t match. Use the newest code in the app.');
      route();
    });
  });

  document.addEventListener('click', async e => {
    const act = e.target.closest('[data-action]');
    if (!act) return;
    if (act.dataset.action === 'restart') step('email');
    if (act.dataset.action === 'sign-out') {
      await db.auth.signOut();
      state.me = null;
      step('email');
    }
  });

  async function route() {
    step('loading');
    const { data: { session } } = await db.auth.getSession();
    if (!session) return step('email');
    const email = (session.user.email || '').toLowerCase();
    const { data: aal, error } = await db.auth.mfa.getAuthenticatorAssuranceLevel();
    if (error) return gateError(error.message);
    if (aal.currentLevel !== 'aal2') {
      const { data: factors } = await db.auth.mfa.listFactors();
      if ((factors.totp || []).some(f => f.status === 'verified')) return step('mfa');
      // Clear half-finished set-ups, then start a fresh one
      for (const f of factors.all || []) if (f.status !== 'verified') await db.auth.mfa.unenroll({ factorId: f.id });
      const { data: enrolled, error: enrollError } = await db.auth.mfa.enroll({ factorType: 'totp', friendlyName: 'Elite Show admin ' + Date.now() });
      if (enrollError) { step('mfa-setup'); return gateError(enrollError.message); }
      enrollingFactor = enrolled.id;
      // Supabase gives the QR code as an SVG data link; a blob link shows it in every browser
      const svg = enrolled.totp.qr_code.replace(/^data:image\/svg\+xml[^,]*,/, '');
      $('[data-qr]').src = URL.createObjectURL(new Blob([svg.startsWith('<') ? svg : decodeURIComponent(svg)], { type: 'image/svg+xml' }));
      $('[data-secret]').textContent = enrolled.totp.secret;
      return step('mfa-setup');
    }
    const { data: admins } = await db.from('admins').select('*').order('created_at');
    const me = (admins || []).find(a => a.email === email);
    if (!me) return step('denied', email);
    state.me = me;
    state.admins = admins;
    gate.hidden = true;
    $('#app').hidden = false;
    $('[data-me]').textContent = email;
    await loadAll();
    render();
    checkDrive();
  }

  db.auth.onAuthStateChange(event => {
    if (event === 'SIGNED_OUT' && state.me) { state.me = null; step('email'); }
  });

  // ---------- Data ----------
  async function loadAll() {
    const [sessions, driveIds, mentors, reviews, admins, settings] = await Promise.all([
      db.from('sessions').select('*').is('deleted_at', null).order('session_date', { ascending: false }),
      db.from('sessions').select('drive_file_id').not('drive_file_id', 'is', null),
      db.from('mentors').select('*').order('name'),
      db.from('reviews').select('*').is('deleted_at', null).order('sort_order').order('created_at'),
      db.from('admins').select('*').order('created_at'),
      db.from('settings').select('*')
    ]);
    const firstError = [sessions, driveIds, mentors, reviews, admins, settings].find(r => r.error);
    if (firstError) fail('Couldn\'t load everything', firstError.error);
    state.sessions = sessions.data || [];
    state.driveIds = new Set((driveIds.data || []).map(r => r.drive_file_id));
    state.mentors = mentors.data || [];
    state.reviews = reviews.data || [];
    state.admins = admins.data || state.admins;
    state.settings = Object.fromEntries((settings.data || []).map(r => [r.key, r.value]));
  }

  function sessionStatus(s) {
    if (s.status === 'draft') return { key: 'draft', text: 'Draft' };
    if (s.publish_at && Date.parse(s.publish_at) > Date.now()) return { key: 'scheduled', text: 'Goes live ' + formatWhen(s.publish_at) };
    if (s.session_date >= todayIST()) return { key: 'upcoming', text: 'Live · coming up' };
    return { key: 'live', text: 'Live' };
  }
  const mentorSessions = m => state.sessions.filter(s => s.mentor_id === m.id || (s.mentor || '').toLowerCase() === m.name.toLowerCase());
  const findMentor = name => state.mentors.find(m => m.name.toLowerCase() === (name || '').trim().toLowerCase());

  // ---------- Router ----------
  window.addEventListener('hashchange', () => state.me && render());
  function render() {
    timers.forEach(clearInterval);
    timers = [];
    const [view, arg] = (location.hash.slice(1) || 'dashboard').split('/');
    $$('.nav a').forEach(a => a.classList.toggle('is-active', a.dataset.view === (view === 'session' ? 'sessions' : view)));
    const main = $('#main');
    main.replaceChildren();
    const views = { dashboard, sessions: sessionsView, session: () => editor(arg), reviews: reviewsView, mentors: mentorsView, history: historyView, admins: adminsView, settings: settingsView };
    (views[view] || dashboard)(main);
    showDriveCount();
    main.focus({ preventScroll: true });
    window.scrollTo(0, 0);
  }

  function head(title, sub, ...actions) {
    return h('div', { class: 'view-head' },
      h('div', null, h('h1', { text: title }), sub ? h('p', { class: 'muted', text: sub }) : null),
      actions.length ? h('div', { class: 'btn-row' }, actions) : null);
  }

  // ---------- Dashboard ----------
  async function dashboard(main) {
    const today = todayIST();
    const live = state.sessions.filter(s => sessionStatus(s).key === 'upcoming' || sessionStatus(s).key === 'live');
    const scheduled = state.sessions.filter(s => sessionStatus(s).key === 'scheduled');
    const drafts = state.sessions.filter(s => s.status === 'draft');
    const next = state.sessions.filter(s => s.status === 'published' && startOf(s) + 2 * 3600e3 > Date.now()).sort((a, b) => startOf(a) - startOf(b))[0];
    const shownReviews = state.reviews.filter(r => r.status === 'published');
    const samples = shownReviews.filter(r => r.sample);

    const tiles = h('div', { class: 'tiles' },
      tile(live.length, 'Sessions on the site'),
      tile(scheduled.length, 'Scheduled'),
      tile(drafts.length, 'Drafts'),
      tile(shownReviews.length, samples.length ? `Reviews on the site (${samples.length} samples)` : 'Reviews on the site'),
      h('div', { class: 'tile', dataset: { premium: 'active' } }, h('b', { text: '…' }), h('span', { text: 'Active Premium members' })),
      h('div', { class: 'tile', dataset: { premium: 'paid' } }, h('b', { text: '…' }), h('span', { text: 'Premium payments received' })),
      h('div', { class: 'tile', dataset: { premium: 'due' } }, h('b', { text: '…' }), h('span', { text: 'Renewals in the next 7 days' })));

    const nextCard = h('section', { class: 'card' }, h('div', { class: 'card-title' }, h('h3', { text: 'Next session' })));
    if (next) {
      const count = h('p', { class: 'countdown' });
      const tick = () => {
        let s = Math.max(0, Math.floor((startOf(next) - Date.now()) / 1000));
        count.textContent = s === 0 ? 'Happening now' : `${Math.floor(s / 86400)}d ${pad(Math.floor(s % 86400 / 3600))}h ${pad(Math.floor(s % 3600 / 60))}m ${pad(s % 60)}s`;
      };
      tick();
      timers.push(setInterval(tick, 1000));
      nextCard.append(h('div', { class: 'next' }, thumb(next),
        h('div', { class: 'stack', style: 'gap:0.3rem' },
          h('span', { class: 'row-kicker', text: `${next.label} · ${formatDate(next.session_date)} · ${formatTime(next.start_time)}` }),
          h('strong', { text: next.title }), h('span', { class: 'muted', text: next.mentor }), count,
          h('div', { class: 'btn-row' }, h('a', { class: 'btn btn-small', href: '#session/' + next.id, text: 'Edit' })))));
    } else {
      nextCard.append(h('p', { class: 'muted', text: 'No session is lined up yet.' }), h('a', { class: 'btn btn-primary', href: '#session/new', text: 'Add a session' }));
    }

    // Things worth doing, worked out from the data
    const nudges = h('ul', { class: 'nudges' });
    const nextSat = (() => { let d = new Date(today + 'T00:00:00Z'); while (d.getUTCDay() !== 6) d = new Date(d.getTime() + 864e5); return d.toISOString().slice(0, 10); })();
    if (!state.sessions.some(s => s.session_date === nextSat)) nudges.append(h('li', null, h('span', null, `Nothing is on the site for Saturday ${formatDate(nextSat, { day: 'numeric', month: 'short' })} yet. `, h('a', { href: '#session/new', text: 'Add it' }))));
    if (drafts.length) nudges.append(h('li', null, h('span', null, `${drafts.length} draft${drafts.length > 1 ? 's are' : ' is'} waiting: `, drafts.slice(0, 3).map((d, i) => [i ? ', ' : '', h('a', { href: '#session/' + d.id, text: d.short || d.title })]))));
    scheduled.forEach(s => nudges.append(h('li', { class: 'ok' }, h('span', { text: `${s.short || s.title} goes live on ${formatWhen(s.publish_at)}.` }))));
    const noPoster = state.sessions.filter(s => !s.poster);
    if (noPoster.length) nudges.append(h('li', null, h('span', null, `${noPoster.length} session${noPoster.length > 1 ? 's have' : ' has'} no poster yet: `, h('a', { href: '#session/' + noPoster[0].id, text: noPoster[0].short || noPoster[0].title }))));
    if (samples.length) nudges.append(h('li', null, h('span', null, `${samples.length} sample review${samples.length > 1 ? 's are' : ' is'} still on the site. `, h('a', { href: '#reviews', text: 'Replace them with real ones' }))));
    const driveNudge = h('li', { hidden: true, dataset: { driveNudge: '' } });
    nudges.append(driveNudge);

    const members = h('section', { class: 'card' }, h('div', { class: 'card-title' }, h('h3', { text: 'Premium members' }), h('span', { class: 'muted small', text: 'Newest first' })), h('p', { class: 'muted', text: 'Loading…' }));

    main.append(head('Dashboard', `Signed in as ${state.me.email}`, h('a', { class: 'btn btn-primary', href: '#session/new', text: 'New session' })),
      tiles, nextCard,
      h('section', { class: 'card' }, h('div', { class: 'card-title' }, h('h3', { text: 'Worth a look' })), nudges.children.length > 1 ? nudges : [h('p', { class: 'muted', text: 'All set. Nothing needs you right now.', dataset: { allSet: '' } }), h('div', { hidden: true }, nudges)]),
      members,
      h('section', { class: 'card' }, h('div', { class: 'card-title' }, h('h3', { text: 'Sign-ups' })),
        h('p', { class: 'muted' }, 'Coming soon sign-ups are in Google Sheets: ', h('a', { href: SHEET_COMING_SOON, target: '_blank', rel: 'noopener', text: 'open the sheet' }), '.')));

    const [m, p] = await Promise.all([
      db.from('premium_members').select('member_code,name,email,phone,status,current_period_end,created_at').order('created_at', { ascending: false }).limit(500),
      db.from('premium_payments').select('amount_paise,status').limit(5000)
    ]);
    if (m.error || p.error) { members.lastChild.textContent = 'Couldn\'t load Premium members.'; return; }
    const active = m.data.filter(x => x.status === 'active');
    const soon = active.filter(x => {
      const left = x.current_period_end ? Date.parse(x.current_period_end) - Date.now() : -1;
      return left >= 0 && left < 7 * 864e5;
    });
    const paid = p.data.filter(x => ['captured', 'paid'].includes(x.status)).reduce((sum, x) => sum + (x.amount_paise || 0), 0);
    const setTile = (key, value) => { const t = $(`[data-premium="${key}"] b`, tiles); if (t) t.textContent = value; };
    setTile('active', active.length);
    setTile('paid', '₹' + (paid / 100).toLocaleString('en-IN'));
    setTile('due', soon.length);
    members.lastChild.replaceWith(m.data.length ? h('div', { class: 'table-wrap' }, h('table', null,
      h('thead', null, h('tr', null, ['ID', 'Name', 'Status', 'Renews', 'Contact'].map(t => h('th', { text: t })))),
      h('tbody', null, m.data.slice(0, 12).map(x => h('tr', null,
        h('td', { text: x.member_code || '—' }), h('td', { text: x.name }),
        h('td', null, h('span', { class: 'status ' + (x.status === 'active' ? 'status-live' : 'status-hidden'), text: x.status })),
        h('td', { text: x.current_period_end ? formatWhen(x.current_period_end) : '—' }),
        h('td', { class: 'small' }, x.email, h('br'), x.phone)))))) : h('p', { class: 'muted', text: 'No Premium members yet.' }));
  }
  const tile = (value, label) => h('div', { class: 'tile' }, h('b', { text: value }), h('span', { text: label }));

  // ---------- Sessions list ----------
  let sessionFilter = 'all';
  function sessionsView(main) {
    const groups = { all: 'All', live: 'On the site', scheduled: 'Scheduled', draft: 'Drafts' };
    const list = h('div', { class: 'rows' });
    const filters = h('div', { class: 'filters' }, Object.entries(groups).map(([k, label]) =>
      h('button', { class: 'chip' + (k === sessionFilter ? ' is-on' : ''), type: 'button', text: label, onclick: () => { sessionFilter = k; render(); } })));
    const shown = state.sessions.filter(s => {
      const k = sessionStatus(s).key;
      return sessionFilter === 'all' || (sessionFilter === 'live' ? k === 'live' || k === 'upcoming' : k === sessionFilter);
    });
    shown.forEach(s => {
      const st = sessionStatus(s);
      list.append(h('div', { class: 'row' }, thumb(s),
        h('div', { class: 'row-main' },
          h('span', { class: 'row-kicker', text: `${s.label} · ${formatDate(s.session_date)} · ${formatTime(s.start_time)}` }),
          h('strong', { text: s.short || s.title }),
          h('span', { class: 'muted small', text: s.mentor })),
        h('div', { class: 'row-actions' },
          h('span', { class: 'status status-' + st.key, text: st.text }),
          h('a', { class: 'btn btn-small', href: '#session/' + s.id, text: 'Edit' }),
          h('button', { class: 'btn btn-small btn-danger', type: 'button', text: 'Delete', onclick: () => removeSession(s) }))));
    });
    if (!shown.length) list.append(h('p', { class: 'muted', text: 'Nothing here.' }));
    const driveButton = h('button', { class: 'btn', type: 'button', onclick: openDrive }, 'From Google Drive', h('span', { class: 'nav-badge', hidden: true, dataset: { driveCount: '' } }));
    main.append(head('Sessions', 'Drop a poster and the panel reads it for you. Newest first.', driveButton, h('a', { class: 'btn btn-primary', href: '#session/new', text: 'New session' })), filters, list);
  }

  async function removeSession(s) {
    if (!confirm(`Delete "${s.short || s.title}"? You can undo this.`)) return;
    const { error } = await db.from('sessions').update({ deleted_at: new Date().toISOString() }).eq('id', s.id);
    if (error) return fail('Couldn\'t delete', error);
    await loadAll();
    render();
    toast('Session deleted.', {
      action: 'Undo', onAction: async () => {
        const { error: e } = await db.from('sessions').update({ deleted_at: null }).eq('id', s.id);
        if (e) return fail('Couldn\'t undo', e);
        await loadAll(); render(); toast('Brought back.');
      }
    });
  }

  // ---------- Session editor ----------
  let pendingPoster = null; // { blob, driveId, name } handed over by the Drive import

  function editor(id) {
    const main = $('#main');
    const existing = id && id !== 'new' ? state.sessions.find(s => s.id === id) : null;
    if (id && id !== 'new' && !existing) { main.append(head('Session not found'), h('a', { class: 'btn', href: '#sessions', text: 'Back to sessions' })); return; }
    const split = splitLabel(existing ? existing.label : 'Mentor Session');
    const known = KINDS.includes(split.kind);
    const handover = pendingPoster;
    pendingPoster = null;
    const poster = { blob: null, image: null, driveId: existing ? existing.drive_file_id : null, url: existing && existing.poster ? posterSrc(existing.poster) : '' };
    const touched = new Set();
    let flags = {};

    // ----- Fields -----
    const inputs = {
      kind: h('select', { name: 'kind' }, KINDS.map(k => h('option', { value: k, text: k })), h('option', { value: 'other', text: 'Something else…' })),
      kindOther: h('input', { name: 'kindOther', placeholder: 'e.g. Founder Fireside', maxlength: 60 }),
      number: h('input', { name: 'number', type: 'number', min: 1, max: 9999, inputmode: 'numeric' }),
      title: h('input', { name: 'title', maxlength: 200, required: true }),
      short: h('input', { name: 'short', maxlength: 80 }),
      mentor: h('input', { name: 'mentor', maxlength: 200, list: 'mentorList', required: true, autocomplete: 'off' }),
      role: h('input', { name: 'role', maxlength: 300 }),
      summary: h('textarea', { name: 'summary', maxlength: 400, rows: 2 }),
      date: h('input', { name: 'date', type: 'date', required: true }),
      time: h('input', { name: 'time', type: 'time', value: DEFAULT_TIME, required: true }),
      mode: h('select', { name: 'mode' }, h('option', { value: '', text: 'Not set' }), h('option', { value: 'online', text: 'Online' }), h('option', { value: 'offline', text: 'In person' })),
      venue: h('input', { name: 'venue', maxlength: 200, placeholder: 'Place or meeting link (optional)' }),
      publishAt: h('input', { name: 'publishAt', type: 'datetime-local' })
    };
    const mentorList = h('datalist', { id: 'mentorList' }, state.mentors.map(m => h('option', { value: m.name })));
    const shortChips = h('div', { class: 'chips' });
    const returning = h('span', { class: 'returning', hidden: true });

    function field(name, label, input, hint) {
      return h('label', { class: 'field', dataset: { field: name } }, h('span', { text: label }), input,
        h('span', { class: 'flag', hidden: true }), hint ? h('span', { class: 'hint', text: hint }) : null);
    }
    function flag(name, confidence, note) {
      const wrap = $(`[data-field="${name}"]`, form);
      if (!wrap) return;
      wrap.classList.remove('is-check', 'is-default', 'is-missing');
      const f = $('.flag', wrap);
      if (!confidence || confidence === 'sure') { f.hidden = true; delete flags[name]; return; }
      flags[name] = confidence;
      wrap.classList.add('is-' + confidence);
      f.hidden = false;
      f.textContent = note || { check: 'Read from the poster. Please check it.', default: 'Not on the poster, so the usual value is filled in.', missing: 'Couldn\'t find this on the poster.' }[confidence];
    }

    const publishChoice = existing ? (existing.status === 'draft' ? 'draft' : existing.publish_at && Date.parse(existing.publish_at) > Date.now() ? 'schedule' : 'now') : 'draft';
    const publish = h('fieldset', { class: 'publish' },
      h('span', { class: 'field' }, h('span', { text: 'When it shows on the site' })),
      [['draft', 'Keep as a draft (only admins see it)'], ['now', existing && existing.status === 'published' ? 'On the site' : 'Publish now'], ['schedule', 'Publish later, on']].map(([v, text]) =>
        h('label', { class: 'opt' }, h('input', { type: 'radio', name: 'publish', value: v, checked: v === publishChoice }), h('span', { text }))),
      field('publishAt', 'Goes live at (India time)', inputs.publishAt));

    const form = h('form', { class: 'stack', novalidate: true },
      h('div', { class: 'type-row' },
        field('kind', 'Type', inputs.kind),
        field('kindOther', 'Type name', inputs.kindOther),
        field('number', 'Number', inputs.number, ' ')),
      field('title', 'Full title', inputs.title, 'Shows when the poster is opened'),
      h('div', { class: 'stack', style: 'gap:0.4rem' }, field('short', 'Short title for the card', inputs.short), shortChips),
      h('div', { class: 'grid2' },
        h('div', { class: 'stack', style: 'gap:0.3rem' }, field('mentor', 'Mentor', inputs.mentor), returning),
        field('role', 'Mentor\'s role and company', inputs.role, 'Saved with the mentor for next time')),
      field('summary', 'Line under the mentor\'s name', inputs.summary),
      h('div', { class: 'grid3' },
        field('date', 'Date', inputs.date),
        field('time', 'Starts (India time)', inputs.time),
        field('mode', 'Online or in person', inputs.mode)),
      field('venue', 'Venue or link', inputs.venue),
      publish,
      mentorList);

    // ----- Fill in -----
    const set = (name, value) => { inputs[name].value = value == null ? '' : value; };
    if (existing) {
      set('kind', known ? split.kind : 'other');
      set('kindOther', known ? '' : split.kind);
      set('number', existing.number || split.number || '');
      ['title', 'short', 'mentor', 'summary', 'venue', 'mode'].forEach(k => set(k, existing[k]));
      set('role', (state.mentors.find(m => m.id === existing.mentor_id) || findMentor(existing.mentor) || {}).role || '');
      set('date', existing.session_date);
      set('time', (existing.start_time || DEFAULT_TIME).slice(0, 5));
      set('publishAt', isoToLocal(existing.publish_at));
      Object.keys(inputs).forEach(k => touched.add(k));
    } else {
      // A new session defaults to the next free Saturday and the next number
      let d = new Date(todayIST() + 'T00:00:00Z');
      while (d.getUTCDay() !== 6 || state.sessions.some(s => s.session_date === d.toISOString().slice(0, 10))) d = new Date(d.getTime() + 864e5);
      set('date', d.toISOString().slice(0, 10));
      set('number', nextNumber('Mentor Session') || '');
    }

    function nextNumber(kind, exceptId) {
      const nums = state.sessions.filter(s => s.id !== exceptId && splitLabel(s.label).kind === kind).map(s => s.number || splitLabel(s.label).number).filter(Boolean);
      return nums.length ? Math.max(...nums) + 1 : (NUMBERED.has(kind) ? 1 : null);
    }

    // ----- Poster -----
    const fileInput = h('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', 'aria-label': 'Choose a poster image' });
    const posterImg = h('img', { alt: 'Poster', hidden: !poster.url, src: poster.url || null });
    const drop = h('label', { class: 'drop' }, fileInput, posterImg,
      h('span', { class: 'drop-tip', text: 'Drop the poster here' }),
      h('span', { class: 'muted small', text: 'or click to choose, or paste it. JPG, PNG or WebP.' }));
    const bar = h('i');
    const readLine = h('span', { class: 'small muted' });
    const reading = h('div', { class: 'reading', hidden: true }, readLine, h('div', { class: 'bar' }, bar));
    const rawText = h('pre');
    const ocr = h('details', { class: 'ocr', hidden: true }, h('summary', { text: 'What the reader saw' }), rawText);
    const readButton = h('button', { class: 'btn btn-small', type: 'button', text: 'Fill the form from this poster', hidden: true, onclick: () => runReader(true) });
    const legend = h('div', { class: 'legend' },
      h('span', null, h('i', { style: 'background:var(--check)' }), 'Check this'),
      h('span', null, h('i', { style: 'background:var(--info)' }), 'Usual value'),
      h('span', null, h('i', { style: 'background:var(--bad)' }), 'Not found'));

    fileInput.addEventListener('change', () => fileInput.files[0] && takePoster(fileInput.files[0]));
    drop.addEventListener('dragover', e => { e.preventDefault(); drop.classList.add('is-over'); });
    drop.addEventListener('dragleave', () => drop.classList.remove('is-over'));
    drop.addEventListener('drop', e => {
      e.preventDefault();
      drop.classList.remove('is-over');
      const file = [...(e.dataTransfer.files || [])].find(f => f.type.startsWith('image/'));
      if (file) takePoster(file);
    });
    const onPaste = e => {
      if (!document.body.contains(drop)) return document.removeEventListener('paste', onPaste);
      const file = [...(e.clipboardData.files || [])].find(f => f.type.startsWith('image/'));
      if (file) { e.preventDefault(); takePoster(file); }
    };
    document.addEventListener('paste', onPaste);

    async function takePoster(blob, { autoRead = true } = {}) {
      if (!/^image\/(jpeg|png|webp)$/.test(blob.type)) return toast('Please use a JPG, PNG or WebP image.', { bad: true });
      if (blob.size > 15 * 1024 * 1024) return toast('That image is over 15 MB. Please use a smaller copy.', { bad: true });
      const url = URL.createObjectURL(blob);
      const img = new Image();
      img.src = url;
      try { await img.decode(); } catch (e) { return toast('Couldn\'t open that image.', { bad: true }); }
      poster.blob = blob;
      poster.image = img;
      posterImg.src = url;
      posterImg.hidden = false;
      readButton.hidden = false;
      update();
      // A brand new session fills itself in; an existing one waits for the button
      if (autoRead && !existing) runReader(false);
    }

    async function runReader(overwrite) {
      if (!poster.image) return;
      readButton.disabled = true;
      reading.hidden = false;
      bar.style.width = '2%';
      readLine.textContent = 'Getting the reader ready (first time takes a few seconds)…';
      let pass = 0, lastProgress = 0;
      try {
        const result = await PosterReader.read(poster.image, { mentors: state.mentors, sessions: state.sessions, today: todayIST() }, m => {
          if (m.status === 'recognizing text') {
            if (m.progress < lastProgress) pass = 1;
            lastProgress = m.progress;
            bar.style.width = Math.round(10 + (pass * 45) + m.progress * 45) + '%';
            readLine.textContent = pass ? 'Checking the date and time…' : 'Reading the poster…';
          } else if (/load|initializ/.test(m.status)) {
            bar.style.width = Math.round(2 + (m.progress || 0) * 8) + '%';
          }
        });
        bar.style.width = '100%';
        applyReading(result, overwrite);
        rawText.textContent = result.text;
        ocr.hidden = false;
        const unsure = Object.values(flags).length;
        readLine.textContent = unsure ? `Done. ${unsure} field${unsure > 1 ? 's' : ''} to check (highlighted).` : 'Done. Everything was found; give it a quick look.';
      } catch (e) {
        console.error(e);
        readLine.textContent = 'Couldn\'t read this poster. Fill the form in by hand.';
      } finally {
        readButton.disabled = false;
      }
    }

    function applyReading(r, overwrite) {
      const put = (name, value, confidence, note) => {
        if (!overwrite && touched.has(name) && inputs[name].value) return;
        if (value == null || value === '') { if (confidence === 'missing') flag(name, 'missing'); return; }
        inputs[name].value = value;
        flag(name, confidence, note);
      };
      const kind = KINDS.includes(r.kind.value) ? r.kind.value : 'other';
      put('kind', kind, r.kind.confidence === 'sure' ? 'sure' : 'check');
      if (kind === 'other') put('kindOther', r.kind.value, 'check');
      put('number', r.number.value || '', r.number.confidence, r.number.confidence === 'default' ? 'Not on the poster, so the next number is filled in.' : null);
      put('title', r.title.value, r.title.value ? r.title.confidence : 'missing');
      put('short', r.short.value, r.short.value ? 'check' : 'missing', 'Pick one below or write your own.');
      put('mentor', r.mentor.value, r.mentor.value ? r.mentor.confidence : 'missing', r.mentor.returning ? 'A mentor we know, found on the poster.' : null);
      put('role', r.role.value, r.role.value ? r.role.confidence : 'missing');
      put('summary', r.summary.value, r.summary.value ? r.summary.confidence : 'missing');
      put('date', r.date.value, r.date.value ? r.date.confidence : 'missing', r.date.confidence === 'check' ? 'Read from the poster (year guessed). Please check it.' : null);
      put('time', r.time.value, r.time.confidence);
      if (r.mode.value) put('mode', r.mode.value, 'sure');
      if (r.venue.value) put('venue', r.venue.value, 'check');
      shortOptions(r.short.options);
      mentorMemory();
      update();
    }

    function shortOptions(list) {
      shortChips.replaceChildren(...(list || PosterReader.shortTitles(inputs.title.value)).map(t =>
        h('button', { class: 'chip', type: 'button', text: t, onclick: () => { inputs.short.value = t; flag('short'); touched.add('short'); update(); } })));
    }

    // Mentor memory: a returning mentor brings their saved role with them
    function mentorMemory() {
      const m = findMentor(inputs.mentor.value);
      if (!m) { returning.hidden = true; return; }
      const count = mentorSessions(m).filter(s => !existing || s.id !== existing.id).length;
      returning.hidden = false;
      returning.textContent = `✓ Returning mentor${count ? ` · ${count} earlier session${count > 1 ? 's' : ''}` : ''}`;
      if (m.role && (!inputs.role.value || flags.role)) {
        inputs.role.value = m.role;
        flag('role');
        if (!touched.has('summary') || flags.summary) { inputs.summary.value = m.role.replace(/\.?$/, '.'); flag('summary'); }
      }
    }

    // ----- Checks -----
    const checks = h('ul', { class: 'checks' });
    function values() {
      const kind = inputs.kind.value === 'other' ? inputs.kindOther.value.trim() || 'Session' : inputs.kind.value;
      const number = inputs.number.value ? Number(inputs.number.value) : null;
      return {
        kind, number, label: sessionLabel(kind, number),
        title: inputs.title.value.trim(), short: inputs.short.value.trim(), mentor: inputs.mentor.value.trim(),
        role: inputs.role.value.trim(), summary: inputs.summary.value.trim(),
        date: inputs.date.value, time: inputs.time.value || DEFAULT_TIME, mode: inputs.mode.value, venue: inputs.venue.value.trim(),
        publish: ($('input[name="publish"]:checked', form) || {}).value || 'draft', publishAt: inputs.publishAt.value
      };
    }
    function runChecks(v) {
      const out = [];
      const others = state.sessions.filter(s => !existing || s.id !== existing.id);
      if (!v.title) out.push(['bad', 'Add the full title.']);
      if (!v.mentor) out.push(['bad', 'Add the mentor\'s name.']);
      if (!v.date) out.push(['bad', 'Add the date.']);
      if (v.date && weekdayOf(v.date) !== 6) out.push(['warn', `That's a ${DAY_NAMES[weekdayOf(v.date)]}. Sessions are usually on Saturday; fine if this one is special.`]);
      const same = others.filter(s => s.session_date === v.date);
      if (same.length) out.push(['warn', `Already on this date: ${same.map(s => s.short || s.title).join(', ')}.`]);
      if (v.number) {
        const dup = others.find(s => splitLabel(s.label).kind === v.kind && (s.number || splitLabel(s.label).number) === v.number);
        if (dup) out.push(['bad', `${sessionLabel(v.kind, v.number)} already exists (${dup.short || dup.title}).`]);
        const expected = nextNumber(v.kind, existing && existing.id);
        if (!dup && expected > 1 && v.number > expected && !existing) out.push(['warn', `The last ${v.kind} was #${pad(expected - 1)}, so this would usually be #${pad(expected)}.`]);
      } else if (NUMBERED.has(v.kind) && !existing) out.push(['warn', `${v.kind}s usually have a number. The next one is #${pad(nextNumber(v.kind) || 1)}.`]);
      if (v.short.length > 30) out.push(['warn', 'The short title is long; cards show two lines at most.']);
      if (!v.short && v.title.length > 30) out.push(['warn', 'Add a short title; the full one is long for a card.']);
      if (!poster.blob && !poster.url) out.push(['warn', 'No poster yet. The site shows a simple made-up poster until you add one.']);
      if (!existing && v.date && v.date < todayIST()) out.push(['warn', 'This date has passed, so it will show as a past session.']);
      if (v.publish === 'schedule') {
        if (!v.publishAt) out.push(['bad', 'Pick when it should go live.']);
        else if (v.date && Date.parse(localToIso(v.publishAt)) > Date.parse(`${v.date}T${v.time}:00+05:30`)) out.push(['warn', 'It would go live after the session has started.']);
      }
      if (!out.some(([k]) => k === 'bad') && !out.length) out.push(['ok', 'Everything looks good.']);
      return out;
    }

    // ----- Preview -----
    const frame = h('iframe', { class: 'preview-frame', title: 'Preview of the session on the site' });
    function previewDoc(v) {
      const d = document.implementation.createHTMLDocument('Preview');
      const base = new URL('../', location.href).href;
      d.head.append(
        h('base', { href: base }),
        h('link', { rel: 'stylesheet', href: 'https://fonts.googleapis.com/css2?family=Cormorant+Garamond:wght@300;400;600;700&family=Montserrat:wght@300;400;500;600;700&display=swap' }),
        h('link', { rel: 'stylesheet', href: base + 'the_elite_show.css' }),
        h('style', { text: 'html,body,*{cursor:auto!important}body{padding:18px;min-height:0}.pv-label{font:600 10px Montserrat;letter-spacing:.18em;text-transform:uppercase;color:#888;margin:0 0 10px}.pv-card{width:230px;margin-bottom:26px}.pv-open{display:flex;flex-direction:column;gap:6px;max-width:300px}' }));
      const posterNode = () => {
        const frameEl = h('div', { class: 'session-poster' });
        const src = poster.blob ? posterImg.src : poster.url;
        if (src) frameEl.append(h('img', { class: 'session-poster-img', src, alt: '' }));
        else frameEl.append(h('div', { class: 'gen-poster' + ((v.number || 0) % 2 ? '' : ' gen-poster--dark') },
          h('span', { class: 'gen-poster-eyebrow', text: v.label }), h('span', { class: 'gen-poster-number', text: v.number ? '#' + pad(v.number) : '' }),
          h('span', { class: 'gen-poster-title', text: v.title || 'Title' }), h('span', { class: 'gen-poster-mentor', text: v.mentor }),
          h('span', { class: 'gen-poster-foot', text: formatDate(v.date) })));
        return frameEl;
      };
      const dateLine = `${v.date >= todayIST() ? 'Coming up · ' : ''}${v.label} · ${formatDate(v.date)}`;
      d.body.append(
        h('p', { class: 'pv-label', text: 'On the home page and sessions page' }),
        h('div', { class: 'session-card pv-card' }, posterNode(),
          h('div', { class: 'session-meta' }, h('time', { class: 'session-date', text: dateLine }), h('h3', { class: 'session-title', text: v.short || v.title || 'Short title' }),
            h('p', { class: 'session-mentor', text: v.mentor || 'Mentor' }), h('p', { class: 'session-summary', text: v.summary }))),
        h('p', { class: 'pv-label', text: 'When the poster is opened' }),
        h('div', { class: 'pv-open' }, h('time', { class: 'session-date', text: dateLine }), h('h3', { class: 'session-title', text: v.title || 'Full title' }),
          h('p', { class: 'session-mentor', text: v.mentor }), h('p', { class: 'session-summary', text: v.summary }),
          h('p', { class: 'session-summary', text: `${formatTime(v.time)} IST${v.mode ? ' · ' + (v.mode === 'online' ? 'Online' : 'In person') : ''}${v.venue ? ' · ' + v.venue : ''}` })));
      return '<!DOCTYPE html>' + d.documentElement.outerHTML;
    }

    const saveButton = h('button', { class: 'btn btn-primary', type: 'button', text: existing ? 'Save changes' : 'Save', onclick: () => save() });
    let previewTimer = null;
    function update() {
      const v = values();
      inputs.kindOther.closest('.field').hidden = inputs.kind.value !== 'other';
      inputs.publishAt.closest('.field').hidden = v.publish !== 'schedule';
      $('[data-field="number"] .hint', form).textContent = 'Card shows: ' + v.label;
      const list = runChecks(v);
      checks.replaceChildren(...list.map(([k, text]) => h('li', { class: k === 'bad' ? 'bad' : k === 'ok' ? 'ok' : '', text })));
      saveButton.disabled = list.some(([k]) => k === 'bad');
      saveButton.textContent = v.publish === 'draft' ? 'Save draft' : v.publish === 'schedule' ? 'Save and schedule' : existing && existing.status === 'published' ? 'Save changes' : 'Publish';
      clearTimeout(previewTimer);
      previewTimer = setTimeout(() => { frame.srcdoc = previewDoc(v); }, 150);
    }

    form.addEventListener('input', e => {
      const name = e.target.name;
      if (!name) return;
      touched.add(name);
      flag(name);
      if (name === 'mentor') mentorMemory();
      if (name === 'role' && (!touched.has('summary') || flags.summary || !inputs.summary.value)) inputs.summary.value = inputs.role.value ? inputs.role.value.replace(/\.?$/, '.') : '';
      if (name === 'title' && !shortChips.children.length) shortOptions();
      if (name === 'kind' && !existing && !touched.has('number')) inputs.number.value = nextNumber(inputs.kind.value) || '';
      update();
    });
    form.addEventListener('change', update);
    form.addEventListener('submit', e => e.preventDefault());

    // ----- Save -----
    async function webp(img, width) {
      const scale = Math.min(1, width / img.naturalWidth);
      const canvas = h('canvas', { width: Math.round(img.naturalWidth * scale), height: Math.round(img.naturalHeight * scale) });
      const g = canvas.getContext('2d');
      g.imageSmoothingQuality = 'high';
      g.drawImage(img, 0, 0, canvas.width, canvas.height);
      const blob = await new Promise(r => canvas.toBlob(r, 'image/webp', 0.86));
      return blob && blob.type === 'image/webp' ? blob : new Promise(r => canvas.toBlob(r, 'image/jpeg', 0.88));
    }

    async function upload(v) {
      const base = `${v.date || 'undated'}-${slug(v.short || v.title)}-${Math.random().toString(36).slice(2, 8)}`;
      const [lg, sm] = await Promise.all([webp(poster.image, 900), webp(poster.image, 480)]);
      const ext = b => (b.type === 'image/webp' ? 'webp' : 'jpg');
      const bucket = db.storage.from('posters');
      const up1 = await bucket.upload(`${base}.${ext(lg)}`, lg, { contentType: lg.type, cacheControl: '31536000' });
      if (up1.error) throw up1.error;
      const up2 = await bucket.upload(`sm/${base}.${ext(sm)}`, sm, { contentType: sm.type, cacheControl: '31536000' });
      if (up2.error) throw up2.error;
      return { poster: bucket.getPublicUrl(up1.data.path).data.publicUrl, poster_sm: bucket.getPublicUrl(up2.data.path).data.publicUrl };
    }

    async function saveMentor(name, role) {
      const m = findMentor(name);
      if (m) {
        if (role && role !== m.role) await db.from('mentors').update({ role }).eq('id', m.id);
        return m.id;
      }
      const { data, error } = await db.from('mentors').insert({ name, role: role || null }).select('id').single();
      if (error) throw error;
      return data.id;
    }

    async function save() {
      const v = values();
      if (runChecks(v).some(([k]) => k === 'bad')) return;
      await busy(saveButton, async () => {
        try {
          const row = {
            label: v.label, number: v.number, title: v.title, short: v.short || null, mentor: v.mentor,
            summary: v.summary || null, session_date: v.date, start_time: v.time, mode: v.mode || null, venue: v.venue || null,
            status: v.publish === 'draft' ? 'draft' : 'published',
            publish_at: v.publish === 'schedule' ? localToIso(v.publishAt) : null,
            drive_file_id: poster.driveId || null
          };
          if (poster.blob) Object.assign(row, await upload(v));
          row.mentor_id = await saveMentor(v.mentor, v.role);
          const { error } = existing
            ? await db.from('sessions').update(row).eq('id', existing.id)
            : await db.from('sessions').insert(row);
          if (error) throw error;
          await loadAll();
          location.hash = '#sessions';
          toast(row.status === 'draft' ? 'Saved as a draft.' : row.publish_at ? `Scheduled for ${formatWhen(row.publish_at)}.` : 'Saved. It\'s on the site now.');
        } catch (e) {
          fail('Couldn\'t save', e);
        }
      });
    }

    main.append(
      head(existing ? 'Edit session' : 'New session', existing ? existing.title : 'Drop the poster in and check what the panel fills in.', h('a', { class: 'btn btn-quiet', href: '#sessions', text: 'Back' }), saveButton),
      h('div', { class: 'editor' },
        h('div', null, drop, h('div', { class: 'btn-row', style: 'margin-top:0.8rem' }, readButton), reading, legend, ocr),
        h('div', { class: 'card' }, form),
        h('div', { class: 'editor-preview stack' }, h('div', { class: 'card' }, h('h3', { text: 'Checks', style: 'margin-bottom:0.7rem' }), checks), frame)));

    update();
    mentorMemory();
    if (existing && existing.title) shortOptions();
    if (handover) {
      poster.driveId = handover.driveId;
      takePoster(handover.blob);
    }
  }

  // ---------- Google Drive import ----------
  async function driveCall(params) {
    const cfg = state.settings.drive_import;
    if (!cfg || !cfg.url) throw new Error('not set up');
    const url = new URL(cfg.url);
    Object.entries({ ...params, token: cfg.token || '' }).forEach(([k, v]) => url.searchParams.set(k, v));
    const res = await fetch(url, { redirect: 'follow' });
    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data;
  }

  async function checkDrive() {
    const cfg = state.settings.drive_import;
    if (!cfg || !cfg.url) { state.drive = null; return; }
    try {
      const { files } = await driveCall({ action: 'list' });
      const skipped = new Set(state.settings.drive_skipped || []);
      state.drive = { files, fresh: files.filter(f => !state.driveIds.has(f.id) && !skipped.has(f.id)) };
    } catch (e) {
      state.drive = { error: e.message, files: [], fresh: [] };
    }
    showDriveCount();
  }

  // Puts the number of new Drive posters on the menu, the Sessions button and the dashboard
  function showDriveCount() {
    const n = state.drive && state.drive.fresh ? state.drive.fresh.length : 0;
    $$('[data-drive-badge], [data-drive-count]').forEach(b => { b.hidden = !n; b.textContent = n; });
    const nudge = $('[data-drive-nudge]');
    if (nudge) {
      nudge.hidden = !n;
      nudge.replaceChildren(h('span', null, `${n} new poster${n > 1 ? 's' : ''} in Google Drive. `, h('a', { href: '#sessions', text: 'Import' })));
      const empty = $('[data-all-set]');
      if (empty && n) { nudge.parentElement.parentElement.hidden = false; empty.remove(); }
    }
  }

  async function openDrive() {
    const dialog = h('dialog', { 'aria-label': 'Posters in Google Drive' });
    const grid = h('div', { class: 'drive-grid' });
    const close = () => { dialog.close(); dialog.remove(); };
    dialog.append(h('div', { class: 'view-head', style: 'margin:0' }, h('div', null, h('h2', { text: 'Posters in Google Drive' }), h('p', { class: 'muted small', text: 'New posters in the Mentor Sessions folder. Import one and the panel reads it.' })),
      h('button', { class: 'btn btn-quiet', type: 'button', text: 'Close', onclick: close })), grid);
    document.body.append(dialog);
    dialog.showModal();
    if (!state.settings.drive_import) {
      grid.replaceWith(h('p', { class: 'muted', style: 'margin-top:1rem' }, 'Drive import isn\'t set up yet. ', h('a', { href: '#settings', text: 'Set it up in Settings', onclick: close }), '.'));
      return;
    }
    grid.append(h('p', { class: 'muted', text: 'Looking in Drive…' }));
    await checkDrive();
    grid.replaceChildren();
    if (state.drive.error) return grid.append(h('p', { class: 'muted', text: 'Couldn\'t reach Drive: ' + state.drive.error }));
    if (!state.drive.fresh.length) return grid.append(h('p', { class: 'muted', text: 'No new posters. Everything in the folder is already in the panel.' }));
    state.drive.fresh.forEach(f => {
      const importButton = h('button', { class: 'btn btn-small btn-primary', type: 'button', text: 'Import' });
      importButton.addEventListener('click', () => busy(importButton, async () => {
        try {
          const file = await driveCall({ action: 'file', id: f.id });
          const bytes = Uint8Array.from(atob(file.data), c => c.charCodeAt(0));
          pendingPoster = { blob: new Blob([bytes], { type: file.mime }), driveId: f.id, name: file.name };
          close();
          location.hash = '#session/new';
        } catch (e) { fail('Couldn\'t import', e); }
      }));
      const skip = h('button', { class: 'btn btn-small btn-quiet', type: 'button', text: 'Skip', onclick: async () => {
        const skipped = [...new Set([...(state.settings.drive_skipped || []), f.id])];
        const { error } = await db.from('settings').upsert({ key: 'drive_skipped', value: skipped });
        if (error) return fail('Couldn\'t skip', error);
        state.settings.drive_skipped = skipped;
        item.remove();
        checkDrive();
      } });
      const item = h('div', { class: 'drive-item' }, f.thumb ? h('img', { src: f.thumb, alt: '' }) : h('div', { class: 'thumb-gen', text: 'Poster' }),
        h('span', { text: f.name }), h('span', { class: 'muted', text: formatWhen(f.created) }), h('div', { class: 'btn-row' }, importButton, skip));
      grid.append(item);
    });
  }

  // ---------- Reviews ----------
  function reviewsView(main) {
    let editing = null;
    const quote = h('textarea', { name: 'quote', maxlength: 600, rows: 4, required: true });
    const name = h('input', { name: 'name', maxlength: 120, required: true });
    const role = h('input', { name: 'role', maxlength: 120, placeholder: 'e.g. College Student, Founder' });
    const session = h('input', { name: 'session', maxlength: 120, list: 'reviewSessions', placeholder: 'Optional' });
    const shown = h('input', { type: 'checkbox', name: 'shown', checked: true });
    const sample = h('input', { type: 'checkbox', name: 'sample' });
    const counter = h('p', { class: 'counter' });
    const preview = h('figure', { class: 'quote-preview' });
    const saveButton = h('button', { class: 'btn btn-primary', type: 'submit', text: 'Add review' });
    const cancel = h('button', { class: 'btn btn-quiet', type: 'button', text: 'Cancel', hidden: true, onclick: () => fill(null) });
    const sessionsList = h('datalist', { id: 'reviewSessions' }, [...new Set(state.sessions.map(s => s.short || s.title).concat(['Elite Brew', 'Daily discussions']))].map(t => h('option', { value: t })));
    const form = h('form', { class: 'card stack' },
      h('h3', { text: 'Add a review' }),
      h('label', { class: 'field' }, h('span', { text: 'What they said' }), quote, counter),
      h('div', { class: 'grid3' },
        h('label', { class: 'field' }, h('span', { text: 'Name' }), name),
        h('label', { class: 'field' }, h('span', { text: 'Who they are' }), role),
        h('label', { class: 'field' }, h('span', { text: 'Session' }), session)),
      h('div', { class: 'btn-row' },
        h('label', { class: 'chip' }, shown, ' Show on the site'),
        h('label', { class: 'chip' }, sample, ' Sample (shows a "Sample" tag)')),
      h('div', { class: 'btn-row' }, saveButton, cancel), sessionsList);

    function paint() {
      const n = quote.value.length;
      counter.textContent = `${n} / 600${n > 220 ? ' · long for a card, the deck grows to fit' : ''}`;
      counter.classList.toggle('over', n > 220);
      preview.replaceChildren(h('span', { class: 'mark', text: '“' }), h('blockquote', { text: quote.value || 'Their words show here.' }),
        h('figcaption', { class: 'by' }, name.value || 'Name', h('small', { text: [role.value, session.value].filter(Boolean).join(' · ') })),
        ...(sample.checked ? [h('span', { class: 'tag', text: 'Sample' })] : []));
    }
    function fill(r) {
      editing = r;
      quote.value = r ? r.quote : '';
      name.value = r ? r.name : '';
      role.value = r ? r.role || '' : '';
      session.value = r ? r.session || '' : '';
      shown.checked = r ? r.status === 'published' : true;
      sample.checked = r ? r.sample : false;
      $('h3', form).textContent = r ? 'Edit review' : 'Add a review';
      saveButton.textContent = r ? 'Save changes' : 'Add review';
      cancel.hidden = !r;
      paint();
      if (r) form.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
    form.addEventListener('input', paint);
    form.addEventListener('submit', async e => {
      e.preventDefault();
      if (quote.value.trim().length < 5 || !name.value.trim()) return toast('Add their words and their name.', { bad: true });
      await busy(saveButton, async () => {
        const row = { quote: quote.value.trim(), name: name.value.trim(), role: role.value.trim() || null, session: session.value.trim() || null, status: shown.checked ? 'published' : 'hidden', sample: sample.checked };
        // New reviews go to the front of the deck
        if (!editing) row.sort_order = Math.min(0, ...state.reviews.map(r => r.sort_order)) - 1;
        const { error } = editing ? await db.from('reviews').update(row).eq('id', editing.id) : await db.from('reviews').insert(row);
        if (error) return fail('Couldn\'t save the review', error);
        await loadAll();
        render();
        toast(editing ? 'Review saved.' : 'Review added to the front of the deck.');
      });
    });

    const list = h('div', { class: 'rows' });
    state.reviews.forEach((r, i) => {
      // Numbers the whole deck 1, 2, 3… in the new order, writing only the reviews that moved
      const move = async dir => {
        const order = [...state.reviews];
        if (!order[i + dir]) return;
        [order[i], order[i + dir]] = [order[i + dir], order[i]];
        const results = await Promise.all(order.map((x, n) => (x.sort_order === n + 1 ? null : db.from('reviews').update({ sort_order: n + 1 }).eq('id', x.id))));
        const bad = results.find(res => res && res.error);
        if (bad) fail('Couldn\'t reorder', bad.error);
        await loadAll(); render();
      };
      list.append(h('div', { class: 'row review-row' },
        h('div', { class: 'row-main' },
          h('span', { class: 'row-kicker', text: `${pad(i + 1)} · ${r.name}${r.role ? ' · ' + r.role : ''}` }),
          h('span', { text: r.quote }),
          h('span', null, h('span', { class: 'status ' + (r.status === 'published' ? 'status-live' : 'status-hidden'), text: r.status === 'published' ? 'On the site' : 'Hidden' }), ' ',
            r.sample ? h('span', { class: 'status status-draft', text: 'Sample' }) : null)),
        h('div', { class: 'row-actions' },
          h('button', { class: 'btn btn-small', type: 'button', text: '↑', 'aria-label': 'Move up', disabled: i === 0, onclick: () => move(-1) }),
          h('button', { class: 'btn btn-small', type: 'button', text: '↓', 'aria-label': 'Move down', disabled: i === state.reviews.length - 1, onclick: () => move(1) }),
          h('button', { class: 'btn btn-small', type: 'button', text: 'Edit', onclick: () => fill(r) }),
          h('button', { class: 'btn btn-small btn-danger', type: 'button', text: 'Delete', onclick: async () => {
            if (!confirm('Delete this review? You can undo this.')) return;
            const { error } = await db.from('reviews').update({ deleted_at: new Date().toISOString() }).eq('id', r.id);
            if (error) return fail('Couldn\'t delete', error);
            await loadAll(); render();
            toast('Review deleted.', { action: 'Undo', onAction: async () => { await db.from('reviews').update({ deleted_at: null }).eq('id', r.id); await loadAll(); render(); } });
          } }))));
    });
    const samples = state.reviews.filter(r => r.sample && r.status === 'published').length;
    main.append(head('Reviews', 'The quote deck on the home page shows these in this order.'),
      samples ? h('p', { class: 'card', style: 'border-color:var(--check);margin-bottom:1rem' }, `${samples} sample review${samples > 1 ? 's are' : ' is'} still on the site. Replace them with members' real words before launch.`) : null,
      h('div', { class: 'grid2', style: 'align-items:start;margin-bottom:1.4rem' }, form, h('div', { class: 'stack' }, h('span', { class: 'field' }, h('span', { text: 'Preview' })), preview)),
      list);
    paint();
  }

  // ---------- Mentors ----------
  function mentorsView(main) {
    const rows = state.mentors.map(m => {
      const done = mentorSessions(m).sort((a, b) => b.session_date.localeCompare(a.session_date));
      const name = h('input', { value: m.name, maxlength: 120, 'aria-label': 'Name' });
      const role = h('input', { value: m.role || '', maxlength: 300, 'aria-label': 'Role and company' });
      const save = h('button', { class: 'btn btn-small', type: 'button', text: 'Save' });
      save.addEventListener('click', () => busy(save, async () => {
        const { error } = await db.from('mentors').update({ name: name.value.trim(), role: role.value.trim() || null }).eq('id', m.id);
        if (error) return fail('Couldn\'t save', error);
        await loadAll(); toast('Mentor saved.');
      }));
      return h('tr', null,
        h('td', null, h('div', { class: 'field' }, name)),
        h('td', null, h('div', { class: 'field' }, role)),
        h('td', null, done.length ? [h('b', { text: done.length }), h('br'), h('span', { class: 'muted small', text: 'last ' + formatDate(done[0].session_date, { day: 'numeric', month: 'short' }) })] : h('span', { class: 'muted', text: '0' })),
        h('td', null, h('div', { class: 'btn-row' }, save,
          done.length ? null : h('button', { class: 'btn btn-small btn-danger', type: 'button', text: 'Delete', onclick: async () => {
            if (!confirm(`Delete ${m.name}?`)) return;
            const { error } = await db.from('mentors').delete().eq('id', m.id);
            if (error) return fail('Couldn\'t delete', error);
            await loadAll(); render();
          } }))));
    });
    main.append(head('Mentors', 'Everyone who has led a session. A returning mentor\'s role fills in by itself when you add a new session.'),
      h('div', { class: 'card table-wrap' }, h('table', null,
        h('thead', null, h('tr', null, ['Name', 'Role and company', 'Sessions', ''].map(t => h('th', { text: t })))),
        h('tbody', null, rows))));
  }

  // ---------- History and undo ----------
  async function historyView(main) {
    const body = h('div', { class: 'rows' }, h('p', { class: 'muted', text: 'Loading…' }));
    main.append(head('History', 'Every change made in the panel, newest first. Undo puts things back the way they were.'), body);
    const { data, error } = await db.from('content_history').select('*').order('id', { ascending: false }).limit(120);
    if (error) return body.replaceChildren(h('p', { class: 'muted', text: 'Couldn\'t load the history.' }));
    const nouns = { sessions: 'session', reviews: 'review', mentors: 'mentor', admins: 'admin', settings: 'setting' };
    const describe = row => {
      const r = row.after || row.before || {};
      return r.short || r.title || (r.quote ? `“${r.quote.slice(0, 60)}${r.quote.length > 60 ? '…' : ''}”` : '') || r.name || r.email || r.key || row.row_id;
    };
    const verb = row => {
      if (row.action === 'insert') return 'added';
      if (row.action === 'delete') return 'removed';
      const b = row.before || {}, a = row.after || {};
      if (!b.deleted_at && a.deleted_at) return 'deleted';
      if (b.deleted_at && !a.deleted_at) return 'brought back';
      const changed = Object.keys(a).filter(k => !['updated_at'].includes(k) && JSON.stringify(a[k]) !== JSON.stringify(b[k]));
      return 'changed ' + (changed.map(k => ({ session_date: 'date', start_time: 'time', publish_at: 'go-live time', sort_order: 'order', mentor_id: 'mentor link', poster_sm: 'poster' }[k] || k)).filter((v, i, all) => all.indexOf(v) === i).join(', ') || 'nothing');
    };
    const undo = async row => {
      const t = row.table_name;
      if (!confirm('Undo this change?')) return;
      let res;
      if (row.action === 'insert') res = t === 'mentors' ? await db.from(t).delete().eq('id', row.row_id) : await db.from(t).update({ deleted_at: new Date().toISOString() }).eq('id', row.row_id);
      else if (row.action === 'update') {
        const patch = { ...row.before };
        ['id', 'created_at', 'updated_at'].forEach(k => delete patch[k]);
        res = await db.from(t).update(patch).eq('id', row.row_id);
      } else res = await db.from(t).insert(row.before);
      if (res.error) return fail('Couldn\'t undo', res.error);
      await loadAll();
      toast('Undone.');
      render();
    };
    body.replaceChildren(...(data.length ? data.map(row => h('div', { class: 'row review-row' },
      h('div', { class: 'row-main' },
        h('span', { class: 'row-kicker', text: `${relative(row.at)} · ${row.actor || 'setup'}` }),
        h('span', null, h('b', { text: `${verb(row)} ${nouns[row.table_name] || row.table_name}` }), ' ', describe(row)),
        h('span', { class: 'muted small', text: formatWhen(row.at) })),
      h('div', { class: 'row-actions' }, ['sessions', 'reviews', 'mentors'].includes(row.table_name) && row.actor
        ? h('button', { class: 'btn btn-small', type: 'button', text: 'Undo', onclick: () => undo(row) }) : null))) : [h('p', { class: 'muted', text: 'No changes yet.' })]));
  }

  // ---------- Admins ----------
  function adminsView(main) {
    const email = h('input', { type: 'email', required: true, placeholder: 'cofounder@example.com', autocomplete: 'off' });
    const add = h('button', { class: 'btn btn-primary', type: 'submit', text: 'Add admin' });
    const form = h('form', { class: 'card stack' },
      h('h3', { text: 'Add an admin' }),
      h('p', { class: 'muted small', text: 'They sign in at this page with that email, then set up an authenticator app the first time.' }),
      h('div', { class: 'btn-row' }, h('label', { class: 'field', style: 'flex:1;min-width:220px' }, h('span', { text: 'Email' }), email), add));
    form.addEventListener('submit', async e => {
      e.preventDefault();
      const value = email.value.trim().toLowerCase();
      if (!/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(value)) return toast('That doesn\'t look like an email address.', { bad: true });
      await busy(add, async () => {
        const { error } = await db.from('admins').insert({ email: value, added_by: state.me.email });
        if (error) return fail(error.code === '23505' ? 'Already an admin' : 'Couldn\'t add', error);
        await loadAll(); render();
        toast(`${value} is now an admin. Send them the link: ${location.origin}${location.pathname}`, { ms: 12000 });
      });
    });
    const rows = state.admins.map(a => h('tr', null,
      h('td', null, a.email, a.email === state.me.email ? h('span', { class: 'muted', text: ' (you)' }) : null),
      h('td', null, a.is_owner ? h('span', { class: 'status status-upcoming', text: 'Owner' }) : h('span', { class: 'status status-live', text: 'Admin' })),
      h('td', { class: 'muted small', text: `${a.added_by && a.added_by !== 'setup' ? 'by ' + a.added_by + ', ' : ''}${formatWhen(a.created_at)}` }),
      h('td', null, a.is_owner || a.email === state.me.email ? null : h('button', { class: 'btn btn-small btn-danger', type: 'button', text: 'Remove', onclick: async () => {
        if (!confirm(`Remove ${a.email} as an admin? They lose access straight away.`)) return;
        const { error } = await db.from('admins').delete().eq('email', a.email);
        if (error) return fail('Couldn\'t remove', error);
        await loadAll(); render(); toast(`${a.email} removed.`);
      } }))));
    main.append(head('Admins', 'People who can use this panel. The owner can\'t be removed, and you can\'t remove yourself.'),
      form, h('div', { class: 'card table-wrap' }, h('table', null,
        h('thead', null, h('tr', null, ['Email', 'Role', 'Added', ''].map(t => h('th', { text: t })))), h('tbody', null, rows))));
  }

  // ---------- Settings ----------
  function settingsView(main) {
    const cfg = state.settings.drive_import || {};
    const url = h('input', { type: 'url', value: cfg.url || '', placeholder: 'https://script.google.com/macros/s/…/exec' });
    const token = h('input', { type: 'password', value: cfg.token || '', autocomplete: 'off' });
    const status = h('p', { class: 'muted small' });
    const save = h('button', { class: 'btn btn-primary', type: 'submit', text: 'Save and check connection' });
    const form = h('form', { class: 'card stack' },
      h('h3', { text: 'Google Drive import' }),
      h('p', { class: 'muted small' }, 'Shows new posters from the "Mentor Sessions" Drive folder in the panel. One-time setup: open ',
        h('code', { text: 'admin/drive_import_apps_script.gs' }), ' in the website code, follow the steps at the top (about 3 minutes), then paste the web app URL and token here.'),
      h('label', { class: 'field' }, h('span', { text: 'Web app URL' }), url),
      h('label', { class: 'field' }, h('span', { text: 'Token' }), token),
      h('div', { class: 'btn-row' }, save), status);
    form.addEventListener('submit', async e => {
      e.preventDefault();
      await busy(save, async () => {
        if (url.value && !/^https:\/\/script\.google(usercontent)?\.com\//.test(url.value.trim())) return toast('That should be a script.google.com web app link.', { bad: true });
        const value = { url: url.value.trim(), token: token.value.trim() };
        const { error } = await db.from('settings').upsert({ key: 'drive_import', value });
        if (error) return fail('Couldn\'t save', error);
        state.settings.drive_import = value;
        await checkDrive();
        status.textContent = state.drive && !state.drive.error ? `Connected. ${state.drive.files.length} posters in the folder, ${state.drive.fresh.length} new.` : `Saved, but couldn't connect: ${state.drive ? state.drive.error : 'no link'}.`;
      });
    });
    main.append(head('Settings'), form,
      h('section', { class: 'card' }, h('h3', { text: 'Security', style: 'margin-bottom:0.6rem' }),
        h('ul', { class: 'nudges' },
          h('li', { class: 'ok', text: 'Two-step sign-in is on for every admin.' }),
          h('li', { class: 'ok', text: 'The database itself refuses changes from anyone who isn\'t on the admin list.' }),
          h('li', { class: 'ok', text: 'Every change is recorded in History with who made it.' }))));
  }

  route();
})();

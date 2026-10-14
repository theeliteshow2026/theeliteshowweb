// ===== SATURDAY MENTOR SESSIONS =====
// To add a session: copy one entry, fill it in, and drop the poster image into
// the posters/ folder. Newest sessions show first automatically. Leave `poster`
// empty to show a generated poster until the real one is ready.
//
// PLACEHOLDERS: the entries below stand in for the real sessions. Replace the
// titles, mentors, dates and summaries, and add each poster.
const MENTOR_SESSIONS = [
  { number: 1, date: '2026-08-15', title: 'Saturday Mentor Session #1', mentor: 'Mentor name', summary: 'One line about what the session covered.', poster: '' },
  { number: 2, date: '2026-08-22', title: 'Saturday Mentor Session #2', mentor: 'Mentor name', summary: 'One line about what the session covered.', poster: '' },
  { number: 3, date: '2026-08-29', title: 'Saturday Mentor Session #3', mentor: 'Mentor name', summary: 'One line about what the session covered.', poster: '' },
  { number: 4, date: '2026-09-05', title: 'Saturday Mentor Session #4', mentor: 'Mentor name', summary: 'One line about what the session covered.', poster: '' },
  { number: 5, date: '2026-09-12', title: 'Saturday Mentor Session #5', mentor: 'Mentor name', summary: 'One line about what the session covered.', poster: '' },
  { number: 6, date: '2026-09-19', title: 'Saturday Mentor Session #6', mentor: 'Mentor name', summary: 'One line about what the session covered.', poster: '' },
  { number: 7, date: '2026-09-26', title: 'Saturday Mentor Session #7', mentor: 'Mentor name', summary: 'One line about what the session covered.', poster: '' },
  { number: 8, date: '2026-10-03', title: 'Saturday Mentor Session #8', mentor: 'Mentor name', summary: 'One line about what the session covered.', poster: '' },
  { number: 9, date: '2026-10-10', title: 'Saturday Mentor Session #9', mentor: 'Mentor name', summary: 'One line about what the session covered.', poster: '' }
];

(function () {
  const sessions = [...MENTOR_SESSIONS].sort((a, b) => b.date.localeCompare(a.date));

  function formatDate(iso) {
    const [y, m, d] = iso.split('-').map(Number);
    return new Date(y, m - 1, d).toLocaleDateString('en-IN', {
      weekday: 'short', day: 'numeric', month: 'short', year: 'numeric'
    });
  }

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  // A poster in the community's style, used until the real poster is uploaded
  function generatedPoster(session) {
    const poster = el('div', 'gen-poster' + (session.number % 2 ? '' : ' gen-poster--dark'));
    poster.append(
      el('span', 'gen-poster-eyebrow', 'Saturday Mentor Session'),
      el('span', 'gen-poster-number', '#' + String(session.number).padStart(2, '0')),
      el('span', 'gen-poster-title', session.title),
      el('span', 'gen-poster-mentor', session.mentor),
      el('span', 'gen-poster-foot', formatDate(session.date))
    );
    return poster;
  }

  function posterFor(session) {
    if (!session.poster) return generatedPoster(session);
    const img = el('img', 'session-poster-img');
    img.src = session.poster;
    img.alt = `Poster for ${session.title} with ${session.mentor}`;
    img.loading = 'lazy';
    return img;
  }

  function card(session) {
    const button = el('button', 'session-card');
    button.type = 'button';
    button.setAttribute('aria-label', `Open the poster for ${session.title}`);
    const frame = el('div', 'session-poster');
    frame.append(posterFor(session));
    const meta = el('div', 'session-meta');
    meta.append(
      el('time', 'session-date', formatDate(session.date)),
      el('h3', 'session-title', session.title),
      el('p', 'session-mentor', session.mentor),
      el('p', 'session-summary', session.summary)
    );
    button.append(frame, meta);
    button.addEventListener('click', () => openLightbox(session, button));
    return button;
  }

  // ----- Poster viewer -----
  let lightbox = null;
  let lastFocus = null;

  function buildLightbox() {
    lightbox = el('div', 'poster-lightbox');
    lightbox.setAttribute('role', 'dialog');
    lightbox.setAttribute('aria-modal', 'true');
    lightbox.setAttribute('aria-labelledby', 'posterLightboxTitle');
    lightbox.hidden = true;
    lightbox.innerHTML = `
      <div class="poster-lightbox-inner">
        <button class="poster-lightbox-close" type="button" aria-label="Close">✕</button>
        <div class="poster-lightbox-poster"></div>
        <div class="poster-lightbox-meta">
          <time class="session-date"></time>
          <h3 class="session-title" id="posterLightboxTitle"></h3>
          <p class="session-mentor"></p>
          <p class="session-summary"></p>
        </div>
      </div>`;
    lightbox.addEventListener('click', e => { if (e.target === lightbox) closeLightbox(); });
    lightbox.querySelector('.poster-lightbox-close').addEventListener('click', closeLightbox);
    document.addEventListener('keydown', e => { if (e.key === 'Escape' && !lightbox.hidden) closeLightbox(); });
    document.body.append(lightbox);
  }

  function openLightbox(session, opener) {
    if (!lightbox) buildLightbox();
    lastFocus = opener;
    lightbox.querySelector('.poster-lightbox-poster').replaceChildren(posterFor(session));
    lightbox.querySelector('.session-date').textContent = formatDate(session.date);
    lightbox.querySelector('.session-title').textContent = session.title;
    lightbox.querySelector('.session-mentor').textContent = session.mentor;
    lightbox.querySelector('.session-summary').textContent = session.summary;
    lightbox.hidden = false;
    document.body.style.overflow = 'hidden';
    lightbox.querySelector('.poster-lightbox-close').focus();
  }

  function closeLightbox() {
    lightbox.hidden = true;
    document.body.style.overflow = '';
    if (lastFocus) lastFocus.focus();
  }

  // Fill every [data-sessions] grid; data-limit shows only the newest few
  document.querySelectorAll('[data-sessions]').forEach(grid => {
    const limit = Number(grid.dataset.limit) || sessions.length;
    grid.replaceChildren(...sessions.slice(0, limit).map(card));
  });
  document.querySelectorAll('[data-sessions-count]').forEach(node => {
    node.textContent = sessions.length;
  });
})();

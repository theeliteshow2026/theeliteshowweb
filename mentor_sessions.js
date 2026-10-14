// ===== SATURDAY MENTOR SESSIONS =====
// To add a session: copy one entry, fill it in, and drop the poster image into
// the posters/ folder (portrait, about 900px wide). Newest sessions show first
// automatically. Leave `poster` empty to show a generated poster until the
// real one is ready. `number` is only used on that generated poster.
const MENTOR_SESSIONS = [
  {
    label: 'Community Session',
    date: '2026-07-11',
    title: 'How to Find a Good Co-Founder',
    mentor: 'AIMER Business School × NextGen Founders',
    summary: 'Find the right partner. Build the right startup.',
    poster: 'posters/2026-07-11-co-founder-session.jpg'
  },
  {
    label: 'Community Session',
    date: '2026-08-16',
    title: 'Dream, Design, Do: The Route Map to Achieve Anything',
    mentor: 'Azvan Sait',
    summary: 'Author, co-founder of The Elite Show Community and India Book of Records holder.',
    poster: 'posters/2026-08-16-dream-design-do.jpg'
  },
  {
    label: 'Mentor Session #06',
    number: 6,
    date: '2026-09-05',
    title: 'How Brands Are Using AI to Create, Market & Sell Better',
    mentor: 'Muhammed Mazin KP',
    summary: 'AI Content Architect, Desgro Media.',
    poster: 'posters/2026-09-05-mentor-session-06.jpg'
  },
  {
    label: 'Mentor Session #07',
    number: 7,
    date: '2026-09-12',
    title: 'Emerging Trends in the Healthy Food Space',
    mentor: 'Akash Akhilesh',
    summary: 'Director, Morfuel India Pvt Ltd.',
    poster: 'posters/2026-09-12-mentor-session-07.jpg'
  },
  {
    label: 'Workshop #01',
    date: '2026-09-13',
    title: 'Placement Workshop: How to Crack Interviews',
    mentor: 'Irfan TT',
    summary: 'Senior Finance Analyst, Johnson & Johnson. Placement coach and career mentor.',
    poster: 'posters/2026-09-13-placement-workshop-01.jpg'
  },
  {
    label: 'Mentor Session #08',
    number: 8,
    date: '2026-09-19',
    title: 'The Future of AI: Where Are We Heading?',
    mentor: 'Mohammed Sami',
    summary: 'Founder, OffWare.',
    poster: 'posters/2026-09-19-mentor-session-08.jpg'
  },
  {
    label: 'Mentor Session #09',
    number: 9,
    date: '2026-10-03',
    title: 'The Psychological Game Behind Every Sale',
    mentor: 'Aflah C P',
    summary: 'Corporate sales strategist and life skills trainer.',
    poster: 'posters/2026-10-03-mentor-session-09.jpg'
  },
  {
    label: 'Mentor Session #10',
    number: 10,
    date: '2026-10-10',
    title: 'The Social Media Advantage: Turning Your Online Presence Into Opportunities',
    mentor: 'Yasir Muhammed',
    summary: 'Founder & CEO, Whoyer.',
    poster: 'posters/2026-10-10-mentor-session-10.jpg'
  }
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
    const poster = el('div', 'gen-poster' + ((session.number || 0) % 2 ? '' : ' gen-poster--dark'));
    poster.append(
      el('span', 'gen-poster-eyebrow', session.label),
      el('span', 'gen-poster-number', session.number ? '#' + String(session.number).padStart(2, '0') : ''),
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
      el('time', 'session-date', `${session.label} · ${formatDate(session.date)}`),
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
    lightbox.querySelector('.session-date').textContent = `${session.label} · ${formatDate(session.date)}`;
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
})();

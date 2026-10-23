// ===== SATURDAY MENTOR SESSIONS =====
// Sessions are now managed in the admin panel (/admin) and load live from Supabase
// (see site_content.js). The list below is the backup the pages use if Supabase
// can't be reached, so keep it roughly in step.
//
// To add a session by hand: copy one entry, fill it in, and drop the poster image into
// the posters/ folder (portrait, about 900px wide). Newest sessions show first
// automatically. Leave `poster` empty to show a generated poster until the
// real one is ready. `number` is only used on that generated poster.
// `short` is the brief title shown on the cards; the full title shows when
// the poster is opened.
//
// The home page counts down to the next upcoming session at its own start time. With no
// upcoming session listed, it counts down to next Saturday at this time (India time,
// 24-hour clock; the posters say 7:30 PM).
const SESSION_START_IST = '19:30';
const SESSION_LENGTH_HOURS = 2;
const MENTOR_SESSIONS = [
  {
    label: 'Community Session',
    date: '2026-07-11',
    title: 'How to Find a Good Co-Founder',
    short: 'Finding a Good Co-Founder',
    mentor: 'AIMER Business School × NextGen Founders',
    summary: 'Find the right partner. Build the right startup.',
    poster: 'posters/2026-07-11-co-founder-session.jpg'
  },
  {
    label: 'Community Session',
    date: '2026-08-16',
    title: 'Dream, Design, Do: The Route Map to Achieve Anything',
    short: 'Dream, Design, Do',
    mentor: 'Azvan Sait',
    summary: 'Author, co-founder of The Elite Show Community and India Book of Records holder.',
    poster: 'posters/2026-08-16-dream-design-do.jpg'
  },
  {
    label: 'Mentor Session #06',
    number: 6,
    date: '2026-09-05',
    title: 'How Brands Are Using AI to Create, Market & Sell Better',
    short: 'How Brands Use AI',
    mentor: 'Muhammed Mazin KP',
    summary: 'AI Content Architect, Desgro Media.',
    poster: 'posters/2026-09-05-mentor-session-06.jpg'
  },
  {
    label: 'Mentor Session #07',
    number: 7,
    date: '2026-09-12',
    title: 'Emerging Trends in the Healthy Food Space',
    short: 'Healthy Food Trends',
    mentor: 'Akash Akhilesh',
    summary: 'Director, Morfuel India Pvt Ltd.',
    poster: 'posters/2026-09-12-mentor-session-07.jpg'
  },
  {
    label: 'Workshop #01',
    date: '2026-09-13',
    title: 'Placement Workshop: How to Crack Interviews',
    short: 'Placement Workshop',
    mentor: 'Irfan TT',
    summary: 'Senior Finance Analyst, Johnson & Johnson. Placement coach and career mentor.',
    poster: 'posters/2026-09-13-placement-workshop-01.jpg'
  },
  {
    label: 'Mentor Session #08',
    number: 8,
    date: '2026-09-19',
    title: 'The Future of AI: Where Are We Heading?',
    short: 'The Future of AI',
    mentor: 'Mohammed Sami',
    summary: 'Founder, OffWare.',
    poster: 'posters/2026-09-19-mentor-session-08.jpg'
  },
  {
    label: 'Mentor Session #09',
    number: 9,
    date: '2026-10-03',
    title: 'The Psychological Game Behind Every Sale',
    short: 'The Psychology of Selling',
    mentor: 'Aflah C P',
    summary: 'Corporate sales strategist and life skills trainer.',
    poster: 'posters/2026-10-03-mentor-session-09.jpg'
  },
  {
    label: 'Mentor Session #10',
    number: 10,
    date: '2026-10-10',
    title: 'The Social Media Advantage: Turning Your Online Presence Into Opportunities',
    short: 'The Social Media Advantage',
    mentor: 'Yasir Muhammed',
    summary: 'Founder & CEO, Whoyer.',
    poster: 'posters/2026-10-10-mentor-session-10.jpg'
  }
];

// Fills an <img> with a session poster: small and large WebP copies (posters/sm, posters/lg,
// made by tools/poster_sizes.py) so each screen downloads the size it shows. `sizes` says how
// wide the poster appears. If a copy is missing, the image falls back to the original file.
// Posters uploaded in the admin panel already come as a 900px copy plus a 480px `small` one.
function setPosterImage(img, path, sizes, small) {
  const name = path.replace(/^posters\//, '').replace(/\.[a-z]+$/i, '');
  img.src = path;
  if (path.startsWith('posters/') || small) {
    img.srcset = small ? `${small} 480w, ${path} 900w` : `posters/sm/${name}.webp 480w, posters/lg/${name}.webp 900w`;
    img.sizes = sizes;
    img.addEventListener('error', () => {
      if (!img.srcset) return;
      img.removeAttribute('srcset');
      img.src = path;
    }, { once: true });
  }
  img.width = 900;
  img.height = 1125;
  img.decoding = 'async';
  return img;
}

// The day it is in India, as YYYY-MM-DD
function todayIST() {
  return new Date(Date.now() + 5.5 * 3600e3).toISOString().slice(0, 10);
}

(typeof SITE_CONTENT !== 'undefined' ? SITE_CONTENT : Promise.resolve({}))
  .then(content => {
    renderSessions(content.sessions || MENTOR_SESSIONS);
    // The sections grew after the page opened, so a link like #sessions needs its scroll again
    const target = location.hash.length > 1 && document.getElementById(location.hash.slice(1));
    if (target && window.scrollY > 0) target.scrollIntoView();
  });

function renderSessions(source) {
  const sessions = [...source].sort((a, b) => b.date.localeCompare(a.date));
  const today = todayIST();
  const dateLine = session => `${session.date >= today ? 'Coming up · ' : ''}${session.label} · ${formatDate(session.date)}`;

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

  function posterFor(session, sizes = '(max-width: 599px) 50vw, (max-width: 1023px) 33vw, 25vw') {
    if (!session.poster) return generatedPoster(session);
    const img = setPosterImage(el('img', 'session-poster-img'), session.poster, sizes, session.posterSmall);
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
      el('time', 'session-date', dateLine(session)),
      el('h3', 'session-title', session.short || session.title),
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
    lightbox.querySelector('.poster-lightbox-poster').replaceChildren(posterFor(session, '(max-width: 899px) 90vw, 420px'));
    lightbox.querySelector('.session-date').textContent = dateLine(session);
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

  // ----- Home page: posters on an arc, countdown inside it -----
  const arc = document.querySelector('[data-session-arc]');
  if (arc && sessions.length) buildArc(arc);

  function buildArc(stage) {
    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const ring = stage.querySelector('.arc-ring');
    let cards = [];
    let radius = 0, step = 0, centerX = 0, centerY = 0;
    let angle = 0, target = null, hovering = false, visible = false, dragging = null, moved = false;

    function stamp(iso) {
      const [y, m, d] = iso.split('-').map(Number);
      return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' }).toUpperCase();
    }

    function arcCard(session) {
      const button = el('button', 'arc-card');
      button.type = 'button';
      button.setAttribute('aria-label', `Open the poster for ${session.title}`);
      const frame = el('div', 'session-poster');
      frame.append(posterFor(session, '(max-width: 639px) 110px, 240px'), el('span', 'arc-stamp', stamp(session.date)));
      const caption = el('p', 'arc-caption', session.short || session.title);
      caption.append(el('small', null, session.mentor));
      button.append(frame, caption);
      button.addEventListener('click', e => {
        if (moved) { e.preventDefault(); return; }
        openLightbox(session, button);
      });
      // Turn the shortest way round to bring a focused poster to the top
      button.addEventListener('focus', () => {
        const goal = -cards.indexOf(button) * step;
        target = angle + (((goal - angle) % 360) + 540) % 360 - 180;
      });
      return button;
    }

    // The ring is filled with as many cards as fit around the whole circle, repeating sessions
    function layout() {
      const width = stage.clientWidth;
      // Cards and ring grow with the root font size, which scales up on very wide screens
      const rem = parseFloat(getComputedStyle(document.documentElement).fontSize) / 16 || 1;
      const cardWidth = (width < 640 ? 104 : 168) * rem;
      const cardHeight = cardWidth * 1.25 + 44;
      // The countdown sits inside the ring, so the ring must clear it
      const center = stage.querySelector('.arc-center');
      const clearance = center.offsetHeight + parseFloat(getComputedStyle(center).bottom) + cardHeight / 2 + 28;
      radius = Math.max(width < 640 ? width * 0.56 : Math.min(width * 0.4, 500 * rem), clearance);
      stage.style.height = Math.round(radius + cardHeight / 2 + 28) + 'px';
      centerX = width / 2;
      centerY = stage.clientHeight;
      const count = Math.max(sessions.length, Math.floor((2 * Math.PI * radius) / (cardWidth * 1.14)));
      step = 360 / count;
      if (cards.length !== count) {
        cards.forEach(c => c.remove());
        cards = Array.from({ length: count }, (_, i) => arcCard(sessions[i % sessions.length]));
        cards.forEach((c, i) => { if (i >= sessions.length) c.tabIndex = -1; });
        stage.prepend(...cards);
      }
      cards.forEach(c => { c.style.width = cardWidth + 'px'; });
      ring.style.width = ring.style.height = radius * 2 + 'px';
      ring.style.top = centerY + 'px';
      place();
    }

    function place() {
      let best = null, bestOff = 999;
      cards.forEach((c, i) => {
        let a = ((i * step + angle) % 360 + 540) % 360 - 180;
        const off = Math.abs(a);
        const rad = a * Math.PI / 180;
        const x = centerX + radius * Math.sin(rad);
        const y = centerY - radius * Math.cos(rad);
        c.style.transform = `translate(${x}px, ${y}px) translate(-50%, -50%) rotate(${a}deg) scale(${off < step / 2 ? 1.08 : 1})`;
        c.style.opacity = off > 100 ? 0 : Math.max(0.3, 1 - off / 120).toFixed(2);
        c.style.zIndex = String(200 - Math.round(off));
        c.style.visibility = off > 100 ? 'hidden' : 'visible';
        if (off < bestOff) { bestOff = off; best = c; }
      });
      cards.forEach(c => c.classList.toggle('is-active', c === best));
    }

    let last = performance.now();
    function tick(now) {
      requestAnimationFrame(tick);
      const dt = Math.min(now - last, 64) / 1000;
      last = now;
      if (!visible || dragging) return;
      if (target !== null) {
        angle += (target - angle) * Math.min(1, dt * 7);
        if (Math.abs(target - angle) < 0.05) { angle = target; target = null; }
      } else if (!hovering && !reduceMotion) {
        angle -= dt * 4;
      } else {
        return;
      }
      place();
    }

    stage.addEventListener('mouseenter', () => { hovering = true; });
    stage.addEventListener('mouseleave', () => { hovering = false; target = Math.round(angle / step) * step; });
    stage.addEventListener('pointerdown', e => {
      if (e.target.closest('.arc-btn')) return;
      dragging = { x: e.clientX, angle };
      moved = false;
    });
    window.addEventListener('pointermove', e => {
      if (!dragging) return;
      const dx = e.clientX - dragging.x;
      if (Math.abs(dx) > 6) moved = true;
      angle = dragging.angle + (dx / radius) * (180 / Math.PI);
      place();
    });
    const release = () => {
      if (!dragging) return;
      dragging = null;
      target = Math.round(angle / step) * step;
      setTimeout(() => { moved = false; }, 0);
    };
    window.addEventListener('pointerup', release);
    window.addEventListener('pointercancel', release);
    stage.querySelectorAll('[data-arc-step]').forEach(btn => btn.addEventListener('click', () => {
      const base = target ?? Math.round(angle / step) * step;
      target = base - Number(btn.dataset.arcStep) * step;
    }));

    new IntersectionObserver(entries => { visible = entries[entries.length - 1].isIntersecting; }).observe(stage);
    window.addEventListener('resize', layout);
    layout();
    requestAnimationFrame(tick);
    startCountdown();
  }

  // Counts down to the next session; while one is on, it says so
  function startCountdown() {
    const IST = 5.5 * 3600e3;
    const [hh, mm] = SESSION_START_IST.split(':').map(Number);
    const length = SESSION_LENGTH_HOURS * 3600e3;
    // Start times of the sessions listed from today on, soonest first
    const listed = sessions
      .filter(s => s.date >= today)
      .map(s => {
        const [y, m, d] = s.date.split('-').map(Number);
        const [h, min] = (s.time || SESSION_START_IST).split(':').map(Number);
        return Date.UTC(y, m - 1, d, h, min) - IST;
      })
      .sort((a, b) => a - b);
    const kicker = document.getElementById('arcKicker');
    const count = document.getElementById('arcCount');
    const when = document.getElementById('arcWhen');
    const pad = n => String(n).padStart(2, '0');

    function nextStart(now) {
      const upcoming = listed.find(start => now < start + length);
      if (upcoming) return upcoming;
      const ist = new Date(now + IST);
      const daysAhead = (6 - ist.getUTCDay() + 7) % 7;
      let start = Date.UTC(ist.getUTCFullYear(), ist.getUTCMonth(), ist.getUTCDate() + daysAhead, hh, mm) - IST;
      if (now >= start + length) start += 7 * 864e5;
      return start;
    }

    function update() {
      const now = Date.now();
      const start = nextStart(now);
      const live = now >= start;
      kicker.textContent = live ? 'Happening now' : 'Next room opens in';
      count.hidden = live;
      when.textContent = new Date(start).toLocaleString('en-IN', {
        weekday: 'long', day: 'numeric', month: 'long', hour: 'numeric', minute: '2-digit', timeZone: 'Asia/Kolkata'
      });
      if (live) return;
      let s = Math.floor((start - now) / 1000);
      document.getElementById('arcDays').textContent = Math.floor(s / 86400); s %= 86400;
      document.getElementById('arcHours').textContent = pad(Math.floor(s / 3600)); s %= 3600;
      document.getElementById('arcMins').textContent = pad(Math.floor(s / 60));
      document.getElementById('arcSecs').textContent = pad(s % 60);
    }
    update();
    setInterval(update, 1000);
  }
}

// ===== RESPONSIVE: MENU, JOIN BAR, MOTION LEVEL AND FIT GUARDS =====
// Loaded last on home.html and sessions.html. Layout lives in responsive.css; this file only adds
// what CSS can't do on its own.

// ----- Motion level -----
// Small or low-power phones get lighter effects (see responsive.css and the cube's pixel ratio).
(function () {
  const conn = navigator.connection || {};
  const lowPower = (navigator.deviceMemory && navigator.deviceMemory <= 4) ||
    (navigator.hardwareConcurrency && navigator.hardwareConcurrency <= 4);
  const small = window.matchMedia('(max-width: 599px)').matches;
  if (conn.saveData || (small && lowPower) || window.matchMedia('(max-width: 374px)').matches) {
    document.documentElement.dataset.motion = 'lite';
  }
})();

// ----- Phone and tablet menu -----
// A Menu button next to Join Us opens a full-screen list of every section. Shown below 1360px.
(function () {
  const nav = document.querySelector('nav');
  const navCta = nav && nav.querySelector('.nav-cta');
  if (!nav || !navCta) return;

  const onHome = !!document.getElementById('hero');
  // On the sessions page the section links go back to the home page the logo points at
  const home = onHome ? '' : (nav.querySelector('.nav-logo').getAttribute('href') || 'index.html');
  const items = [
    ['#why', 'Why we exist'],
    ['#about', 'What we do'],
    ['#experiences', 'The experience'],
    ['#sessions', 'Saturday sessions'],
    ['#reviews', 'What members say'],
    ['#membership', 'Membership'],
    ['#get-involved', 'Get involved'],
    ['#vision', 'The vision']
  ];

  const button = document.createElement('button');
  button.type = 'button';
  button.className = 'nav-menu-btn';
  button.setAttribute('aria-expanded', 'false');
  button.setAttribute('aria-controls', 'siteMenu');
  button.innerHTML = '<span class="nav-menu-icon" aria-hidden="true"><i></i><i></i></span><span class="nav-menu-label">Menu</span>';
  navCta.after(button);

  const menu = document.createElement('div');
  menu.className = 'site-menu';
  menu.id = 'siteMenu';
  menu.hidden = true;
  menu.setAttribute('role', 'dialog');
  menu.setAttribute('aria-modal', 'true');
  menu.setAttribute('aria-label', 'Menu');
  menu.innerHTML = `
    <div class="site-menu-inner">
      <ul class="site-menu-links">
        ${items.map(([hash, label], i) => `<li style="--i:${i}"><a href="${home}${hash}">${label}</a></li>`).join('')}
        <li style="--i:${items.length}"><a href="sessions.html">All sessions</a></li>
      </ul>
      <div class="site-menu-foot" style="--i:${items.length + 1}">
        <a class="site-menu-join" href="${home}${onHome ? '#membership' : '#waitlist'}">Join the community</a>
        <p>Saturday sessions · Daily discussions</p>
      </div>
    </div>`;
  document.body.appendChild(menu);

  const label = button.querySelector('.nav-menu-label');
  let lastFocus = null;

  function setOpen(open) {
    if (open === !menu.hidden) return;
    button.setAttribute('aria-expanded', String(open));
    label.textContent = open ? 'Close' : 'Menu';
    document.documentElement.classList.toggle('menu-open', open);
    if (open) {
      lastFocus = document.activeElement;
      menu.hidden = false;
      // next frame so the curtain transition runs from its closed state
      requestAnimationFrame(() => menu.classList.add('is-open'));
      menu.querySelector('a').focus({ preventScroll: true });
    } else {
      menu.classList.remove('is-open');
      menu.hidden = true;
      if (lastFocus && lastFocus !== document.body) lastFocus.focus({ preventScroll: true });
    }
  }

  button.addEventListener('click', () => setOpen(menu.hidden));
  menu.addEventListener('click', e => {
    if (e.target.closest('a') || e.target === menu) setOpen(false);
  });
  document.addEventListener('keydown', e => {
    if (menu.hidden) return;
    if (e.key === 'Escape') { setOpen(false); return; }
    // keep Tab inside the menu and its button
    if (e.key === 'Tab') {
      const stops = [button, ...menu.querySelectorAll('a')];
      const i = stops.indexOf(document.activeElement);
      const next = e.shiftKey ? (i <= 0 ? stops.length - 1 : i - 1) : (i + 1) % stops.length;
      e.preventDefault();
      stops[next].focus();
    }
  });
  // Closes if the screen grows past the point where the links show in the bar
  window.matchMedia('(min-width: 1360px)').addEventListener('change', e => { if (e.matches) setOpen(false); });
})();

// ----- Thumb-zone join bar (phones, home page) -----
// Slides up from the bottom once the hero has scrolled away, and steps aside wherever joining is
// already on screen (membership, the form, the closing screen and footer) or while typing.
(function () {
  const hero = document.getElementById('hero');
  if (!hero || !document.getElementById('membership')) return;

  const bar = document.createElement('div');
  bar.className = 'join-bar';
  bar.innerHTML = `
    <a class="join-bar-btn" href="#membership">Join the community</a>
    <span class="join-bar-note">Free, or Premium ₹199/mo</span>`;
  document.body.appendChild(bar);

  const blockers = new Set();
  let pastHero = false;
  const update = () => {
    const typing = document.activeElement && document.activeElement.matches('input, textarea, select');
    bar.classList.toggle('is-shown', pastHero && blockers.size === 0 && !typing);
  };

  new IntersectionObserver(entries => {
    const last = entries[entries.length - 1];
    pastHero = !last.isIntersecting && last.boundingClientRect.top < 0;
    update();
  }).observe(hero);

  const watch = new IntersectionObserver(entries => {
    entries.forEach(e => { if (e.isIntersecting) blockers.add(e.target); else blockers.delete(e.target); });
    update();
  });
  ['#membership', '#waitlist', '#rise', 'footer'].forEach(sel => {
    const el = document.querySelector(sel);
    if (el) watch.observe(el);
  });
  document.addEventListener('focusin', update);
  document.addEventListener('focusout', () => setTimeout(update, 0));
})();

// ----- Quote deck: grow to fit the longest review -----
// The cards are stacked absolutely inside a fixed-height deck, so a long review (or bigger text
// settings) could spill out of its card. Measure and give the deck the room it needs.
(function () {
  const deck = document.getElementById('quoteDeck');
  if (!deck) return;
  let base = 0;
  function fit() {
    deck.style.height = '';
    base = deck.clientHeight;
    let extra = 0;
    deck.querySelectorAll('.quote-card').forEach(card => {
      extra = Math.max(extra, card.scrollHeight - card.clientHeight);
    });
    if (extra > 0) deck.style.height = `${base + extra + 8}px`;
  }
  let lastWidth = window.innerWidth;
  window.addEventListener('resize', () => {
    if (window.innerWidth === lastWidth) return;
    lastWidth = window.innerWidth;
    fit();
  });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fit);
  fit();
})();

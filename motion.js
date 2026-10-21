// ===== MOTION: CURTAIN TITLES AND $ DECODE LABELS =====
// Section titles rise line by line out of a hidden slot, then a hand-drawn lime swoosh draws under the italic word.
// Section labels decode through $ signs, echoing the brand band under the hero.
(function () {
  const titles = [...document.querySelectorAll('.section-title')];
  const labels = [...document.querySelectorAll('.section-label')];
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const SWOOSH = ['M3 15 C 50 6, 120 3, 197 9', 'M28 21 C 80 15, 130 14, 172 17'];
  const SVG_NS = 'http://www.w3.org/2000/svg';

  // One svg per stroke, revealed left to right with a clip, so the stroke never distorts as it stretches with the word
  function addSwoosh(em) {
    if (em.querySelector('.title-swoosh')) return;
    SWOOSH.forEach(d => {
      const svg = document.createElementNS(SVG_NS, 'svg');
      svg.setAttribute('class', 'title-swoosh');
      svg.setAttribute('viewBox', '0 0 200 24');
      svg.setAttribute('preserveAspectRatio', 'none');
      svg.setAttribute('aria-hidden', 'true');
      const path = document.createElementNS(SVG_NS, 'path');
      path.setAttribute('d', d);
      svg.appendChild(path);
      em.appendChild(svg);
    });
  }

  // Reduced motion: titles and labels stay at rest, with the swoosh already drawn (see motion.css).
  if (reduceMotion) {
    titles.forEach(title => title.querySelectorAll('em').forEach(addSwoosh));
    return;
  }

  document.documentElement.classList.add('motion-on');
  // These now have their own entrances, so take them off the shared fade-up
  titles.concat(labels).forEach(el => el.classList.remove('reveal'));

  // ----- Curtain titles -----
  // Wrap each word (and each <em>, kept whole) so the rendered lines can be measured
  function tokenize(title) {
    const frag = document.createDocumentFragment();
    [...title.childNodes].forEach(node => {
      if (node.nodeType === Node.TEXT_NODE) {
        node.textContent.split(/\s+/).filter(Boolean).forEach(word => {
          const w = document.createElement('span');
          w.className = 'w';
          w.textContent = word;
          frag.append(w, ' ');
        });
      } else if (node.nodeType === Node.ELEMENT_NODE && node.nodeName !== 'BR') {
        node.classList.add('w');
        frag.append(node, ' ');
      }
    });
    title.replaceChildren(frag);
  }

  // Rebuild the title as one hidden slot per rendered line
  function split(title) {
    if (title.dataset.source) title.innerHTML = title.dataset.source;
    else title.dataset.source = title.innerHTML;
    tokenize(title);

    const tolerance = parseFloat(getComputedStyle(title).fontSize) * 0.5;
    const lines = [];
    let lineTop = null;
    title.querySelectorAll(':scope > .w').forEach(w => {
      if (lineTop === null || Math.abs(w.offsetTop - lineTop) > tolerance) {
        lines.push([]);
        lineTop = w.offsetTop;
      }
      lines[lines.length - 1].push(w);
    });

    const frag = document.createDocumentFragment();
    lines.forEach((words, i) => {
      const slot = document.createElement('span');
      slot.className = 'ln';
      const line = document.createElement('span');
      line.className = 'li';
      line.style.setProperty('--i', i);
      words.forEach((w, j) => line.append(j ? ' ' : '', w));
      slot.appendChild(line);
      frag.appendChild(slot);
    });
    title.replaceChildren(frag);
    title.style.setProperty('--lines', lines.length);
    title.querySelectorAll('em').forEach(addSwoosh);
    title.classList.add('is-split');
  }

  // ----- $ decode labels -----
  const GLYPHS = '$$$$$$#%&*';
  const DECODE_MS = 700;

  function prepareLabel(label) {
    const text = label.textContent.trim();
    const readable = document.createElement('span');
    readable.className = 'motion-sr';
    readable.textContent = text;
    const shown = document.createElement('span');
    shown.className = 'decode';
    shown.setAttribute('aria-hidden', 'true');
    shown.textContent = text.replace(/\S/g, '$');
    label.replaceChildren(readable, shown);
    label.dataset.text = text;
  }

  function decode(label, instant) {
    const text = label.dataset.text;
    const shown = label.querySelector('.decode');
    if (instant) { shown.textContent = text; return; }
    const start = performance.now();
    (function tick(now) {
      const progress = Math.min(1, (now - start) / DECODE_MS);
      const fixed = Math.floor(progress * text.length);
      shown.textContent = [...text].map((ch, i) =>
        i < fixed || ch === ' ' ? ch : GLYPHS[Math.floor(Math.random() * GLYPHS.length)]).join('');
      if (progress < 1) requestAnimationFrame(tick);
    })(start);
  }

  // ----- Entrances -----
  function enter(el, instant) {
    if (el.classList.contains('section-label')) decode(el, instant);
    else el.classList.add('is-in');
  }

  let started = false;
  function start() {
    if (started) return;
    started = true;
    titles.forEach(split);
    labels.forEach(prepareLabel);

    const watcher = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        enter(entry.target, false);
        watcher.unobserve(entry.target);
      });
    }, { rootMargin: '0px 0px -10% 0px' });

    titles.concat(labels).forEach(el => {
      // Already scrolled past (e.g. a reload halfway down): show it at rest
      if (el.getBoundingClientRect().bottom < 0) enter(el, true);
      else watcher.observe(el);
    });

    // Lines depend on width, so re-split when it changes (not on the mobile URL bar's height changes)
    let lastWidth = window.innerWidth;
    let resizeTimer;
    window.addEventListener('resize', () => {
      if (window.innerWidth === lastWidth) return;
      lastWidth = window.innerWidth;
      clearTimeout(resizeTimer);
      resizeTimer = setTimeout(() => titles.forEach(split), 150);
    });
  }

  // Measure lines with the real fonts, but never wait on them for long
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(start);
  setTimeout(start, 1500);
})();

// ===== MOTION: VELOCITY RIBBON =====
// Two rows of type drift in opposite directions, speed up and lean with the scroll speed,
// and flip direction when the visitor scrolls back up. Runs only while the band is on screen.
(function () {
  const band = document.querySelector('.ribbon-band');
  if (!band || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const DRIFT = 0.6; // px per frame at rest
  const rows = [...band.querySelectorAll('.ribbon-row')].map(el => ({ el, dir: Number(el.dataset.dir), x: 0, set: 0, source: el.innerHTML }));

  // Repeat each row's words until one set covers the screen, then add a second set for a seamless loop
  function fill() {
    rows.forEach(row => {
      row.el.innerHTML = row.source;
      while (row.el.scrollWidth < window.innerWidth) row.el.insertAdjacentHTML('beforeend', row.source);
      row.set = row.el.scrollWidth;
      row.el.insertAdjacentHTML('beforeend', row.el.innerHTML);
      row.x = -row.set * (row.dir > 0 ? 0 : 0.5);
    });
  }

  let lastY = window.scrollY, velocity = 0, sign = 1, lastT = 0, visible = false;
  function frame(now) {
    if (!visible) return;
    const dt = lastT ? Math.min(now - lastT, 48) / 16.67 : 1;
    lastT = now;
    const delta = window.scrollY - lastY;
    lastY = window.scrollY;
    velocity += (delta - velocity) * 0.15;
    if (Math.abs(delta) > 0.5) sign = delta > 0 ? 1 : -1;
    const skew = Math.max(-12, Math.min(12, -velocity * 0.5));
    rows.forEach(row => {
      row.x -= (DRIFT * sign + velocity * 0.8) * row.dir * dt;
      if (row.x <= -row.set) row.x += row.set;
      if (row.x > 0) row.x -= row.set;
      row.el.style.transform = `translate3d(${row.x}px, 0, 0) skewX(${skew}deg)`;
    });
    requestAnimationFrame(frame);
  }

  new IntersectionObserver(entries => {
    visible = entries[0].isIntersecting;
    if (visible) {
      lastY = window.scrollY;
      lastT = 0;
      requestAnimationFrame(frame);
    }
  }).observe(band);

  let lastWidth = window.innerWidth;
  window.addEventListener('resize', () => {
    if (window.innerWidth === lastWidth) return;
    lastWidth = window.innerWidth;
    fill();
  });
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(fill);
  fill();
})();

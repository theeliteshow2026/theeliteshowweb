// ===== REVIEWS =====
// Reviews are now managed in the admin panel (/admin) and load live from Supabase
// (see site_content.js). The list below is the backup used if Supabase can't be reached.
// To add a review by hand: copy one entry and fill it in. `session` is optional.
// Entries marked `sample: true` are placeholders and show a "Sample" tag;
// replace them with real words from members before going live.
const REVIEWS = [
  {
    quote: 'I came for one Saturday session and left with a mentor\'s number and two people to build with. I haven\'t missed a week since.',
    name: 'Sample Member',
    role: 'College Student',
    session: 'Dream, Design, Do',
    sample: true
  },
  {
    quote: 'Every talk I\'d watched online felt far away. Here the speaker sat across the table and answered my exact question.',
    name: 'Sample Member',
    role: 'Founder',
    session: 'Finding a Good Co-Founder',
    sample: true
  },
  {
    quote: 'Elite Brew is the best hour of my month. Small table, good coffee, people who actually want to help.',
    name: 'Sample Member',
    role: 'Working Professional',
    session: 'Elite Brew',
    sample: true
  },
  {
    quote: 'The placement workshop gave me a plan instead of advice. I used it in my interview the next week.',
    name: 'Sample Member',
    role: 'College Student',
    session: 'Placement Workshop',
    sample: true
  }
];

// A deck of quote cards: the top card flicks away and goes to the back.
// Drag or swipe it, use the arrows, or let it turn on its own.
(typeof SITE_CONTENT !== 'undefined' ? SITE_CONTENT : Promise.resolve({}))
  .then(content => buildQuoteDeck(content.reviews || REVIEWS));

function buildQuoteDeck(reviews) {
  const deck = document.getElementById('quoteDeck');
  if (!deck || !reviews.length) return;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  const counter = document.getElementById('deckCount');
  const pad = n => String(n).padStart(2, '0');

  function el(tag, className, text) {
    const node = document.createElement(tag);
    if (className) node.className = className;
    if (text != null) node.textContent = text;
    return node;
  }

  const cards = reviews.map((review, i) => {
    const card = el('figure', 'quote-card');
    card.dataset.index = i;
    const by = el('figcaption', 'quote-by');
    const name = el('p', 'quote-name', review.name);
    name.append(el('small', null, review.role));
    by.append(name);
    if (review.session) by.append(el('span', 'quote-session', review.session));
    card.append(el('span', 'quote-mark', '“'), el('blockquote', 'quote-text', review.quote), by);
    if (review.sample) card.append(el('span', 'quote-sample', 'Sample'));
    deck.append(card);
    return card;
  });

  let order = cards.map((_, i) => i);
  let busy = false;

  function stack() {
    order.forEach((index, depth) => {
      const card = cards[index];
      const tilt = depth === 0 ? 0 : (depth % 2 ? -3 : 3) * Math.min(depth, 2);
      card.dataset.depth = depth;
      card.style.zIndex = String(cards.length - depth);
      card.style.transform = `translateY(${Math.min(depth, 3) * 14}px) scale(${1 - Math.min(depth, 3) * 0.05}) rotate(${tilt}deg)`;
      card.style.opacity = depth > 2 ? 0 : 1;
      card.setAttribute('aria-hidden', depth === 0 ? 'false' : 'true');
    });
    counter.textContent = `${pad(order[0] + 1)} / ${pad(cards.length)}`;
  }

  // Sends the top card flying off (fly: 1 right, -1 left) to the back of the deck
  function advance(fly = 1) {
    if (busy || cards.length < 2) return;
    busy = true;
    const top = cards[order[0]];
    top.classList.add('is-leaving');
    top.style.transform = `translateX(${fly * 115}%) rotate(${fly * 14}deg)`;
    setTimeout(() => {
      top.classList.remove('is-leaving');
      order.push(order.shift());
      stack();
      busy = false;
    }, reduceMotion ? 0 : 420);
  }

  // Brings the card at the back in from the left
  function goBack() {
    if (busy || cards.length < 2) return;
    const back = cards[order[order.length - 1]];
    back.style.transition = 'none';
    back.style.transform = 'translateX(-115%) rotate(-14deg)';
    back.style.zIndex = String(cards.length + 1);
    void back.offsetWidth;
    back.style.transition = '';
    order.unshift(order.pop());
    stack();
  }

  // Drag or swipe the top card sideways
  let drag = null;
  deck.addEventListener('pointerdown', e => {
    const top = cards[order[0]];
    if (!top.contains(e.target)) return;
    drag = { x: e.clientX, card: top };
    top.classList.add('is-dragging');
  });
  window.addEventListener('pointermove', e => {
    if (!drag) return;
    const dx = e.clientX - drag.x;
    drag.card.style.transform = `translateX(${dx}px) rotate(${dx / 18}deg)`;
  });
  const release = e => {
    if (!drag) return;
    const dx = (e.clientX || drag.x) - drag.x;
    drag.card.classList.remove('is-dragging');
    drag = null;
    if (Math.abs(dx) > 80) advance(Math.sign(dx));
    else stack();
  };
  window.addEventListener('pointerup', release);
  window.addEventListener('pointercancel', release);

  document.getElementById('deckNext').addEventListener('click', () => advance(1));
  document.getElementById('deckPrev').addEventListener('click', goBack);

  // Turns on its own every 7 seconds while on screen, unless someone is reading
  let paused = false, visible = false;
  deck.addEventListener('mouseenter', () => { paused = true; });
  deck.addEventListener('mouseleave', () => { paused = false; });
  new IntersectionObserver(entries => { visible = entries[entries.length - 1].isIntersecting; }).observe(deck);
  if (!reduceMotion) setInterval(() => { if (visible && !paused && !drag) advance(1); }, 7000);

  stack();
  document.dispatchEvent(new Event('quotedeck:ready'));
}

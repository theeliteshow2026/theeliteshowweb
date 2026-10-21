// Web app URL of coming_soon_apps_script.gs, which saves to its own
// "Coming Soon Sign-ups" spreadsheet (not the Waitlist sheet).
const COMING_SOON_SCRIPT_URL = "";

const OPEN_MAX_DEG = 70;     // how far the door swings at a full peek
const PEEK_AT = 0.6;         // fraction of the swing that counts as a peek
const SHUT_FOR_MS = 1600;    // how long the door stays shut after "Not yet."

const scene = document.getElementById('csScene');
const door = document.getElementById('csDoor');
const leaf = document.getElementById('csLeaf');
const floorLight = document.getElementById('csFloorLight');
const title = document.getElementById('csTitle');
const hint = document.getElementById('csHint');

const restTitle = title.textContent;
const touchFirst = matchMedia('(hover: none)').matches;
if (touchFirst) hint.textContent = 'Tap the door to peek';

let locked = false;
let armed = true;  // the pointer must back away before the next peek

function swing(fraction) {
  const f = Math.max(0, Math.min(1, fraction));
  leaf.style.transform = `rotateY(${-8 - f * (OPEN_MAX_DEG - 8)}deg)`;
  floorLight.style.opacity = 0.35 + f * 0.65;
}

// Peek, say "Not yet.", then slam the door and hold it shut for a moment
function notYet() {
  locked = true;
  title.textContent = 'Not yet.';
  title.classList.add('is-peek');
  setTimeout(() => {
    leaf.classList.add('is-slam');
    swing(0);
    setTimeout(() => {
      scene.classList.remove('is-thud');
      void scene.offsetWidth;
      scene.classList.add('is-thud');
    }, 180);
  }, 650);
  setTimeout(() => {
    leaf.classList.remove('is-slam');
    title.textContent = restTitle;
    title.classList.remove('is-peek');
    locked = false;
  }, SHUT_FOR_MS);
}

// Mouse: the door opens the closer the pointer gets to it
document.addEventListener('pointermove', e => {
  if (e.pointerType !== 'mouse' || locked) return;
  const r = door.getBoundingClientRect();
  const dx = e.clientX - (r.left + r.width / 2);
  const dy = e.clientY - (r.top + r.height / 2);
  const f = 1 - Math.hypot(dx, dy) / 420;
  if (!armed) {
    if (f < PEEK_AT / 2) armed = true;
    return;
  }
  swing(f);
  if (f >= PEEK_AT) {
    armed = false;
    swing(1);
    notYet();
  }
});

// Touch and keyboard: a tap or Enter opens it for a peek
door.addEventListener('click', () => {
  if (locked) return;
  swing(1);
  notYet();
});

// --- Knock form ---
const form = document.getElementById('csForm');
const nameEl = document.getElementById('csName');
const phoneEl = document.getElementById('csPhone');
const knockBtn = document.getElementById('csKnock');
const msg = document.getElementById('csMsg');

function say(text, kind) {
  msg.textContent = text;
  msg.className = 'cs-msg' + (kind ? ' is-' + kind : '');
}

function knock() {
  scene.classList.remove('is-knock');
  void scene.offsetWidth;
  scene.classList.add('is-knock');
}

form.addEventListener('submit', async e => {
  e.preventDefault();
  const name = nameEl.value.trim();
  const phone = phoneEl.value.trim();
  if (!name) {
    say('Please add your name.', 'error');
    nameEl.focus();
    return;
  }
  if (phone.replace(/\D/g, '').length < 10) {
    say('Please add a WhatsApp number with at least 10 digits.', 'error');
    phoneEl.focus();
    return;
  }

  if (!COMING_SOON_SCRIPT_URL) {
    say('Sign-ups open shortly. Please try again soon.', 'error');
    return;
  }

  knockBtn.disabled = true;
  knock();
  say('Knocking...');
  try {
    // text/plain keeps this a "simple" CORS request, so the JSON reply is readable
    const res = await fetch(COMING_SOON_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify({ name, phone })
    });
    const result = await res.json();
    if (!result.success) throw new Error(result.message);
    form.reset();
    say(`We heard you, ${name}. We'll message you on WhatsApp when the doors open.`, 'ok');
  } catch (err) {
    say('That knock did not go through. Please try again.', 'error');
  } finally {
    knockBtn.disabled = false;
  }
});

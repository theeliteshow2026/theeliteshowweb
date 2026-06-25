// ===== CONFIG =====
// 🔧 REPLACE THESE TWO VALUES BEFORE GOING LIVE:
const WHATSAPP_LINK = "https://chat.whatsapp.com/ItDdTXKakan01FUREdRxar";
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbylsTW9H43fY6-Mzuz6F9E19jeKf8vu6N7Wrn1IB1o2uwDU6mfHLVx1rFWePnczknDR/exec";

// Update WhatsApp button dynamically
document.querySelector('.btn-whatsapp').href = WHATSAPP_LINK;

// ===== PARTICLES =====
const container = document.getElementById('particles');
for (let i = 0; i < 25; i++) {
  const p = document.createElement('div');
  p.className = 'particle';
  const size = Math.random() * 3 + 1;
  p.style.cssText = `
      width: ${size}px;
      height: ${size}px;
      left: ${Math.random() * 100}%;
      animation-duration: ${Math.random() * 15 + 10}s;
      animation-delay: ${Math.random() * 10}s;
      opacity: ${Math.random() * 0.5 + 0.1};
    `;
  container.appendChild(p);
}

// ===== SCROLL REVEAL =====
const observer = new IntersectionObserver((entries) => {
  entries.forEach((e, i) => {
    if (e.isIntersecting) {
      setTimeout(() => e.target.classList.add('visible'), (i % 4) * 100);
      observer.unobserve(e.target);
    }
  });
}, { threshold: 0.12 });

document.querySelectorAll('.reveal, .reveal-left, .reveal-right, .reveal-scale').forEach(el => observer.observe(el));

// ===== VALIDATION HELPERS =====
function showFieldError(inputId, errorId, msg) {
  const input = document.getElementById(inputId);
  const err = document.getElementById(errorId);
  input.classList.add('invalid');
  input.classList.remove('valid');
  err.textContent = msg;
  err.classList.add('visible');
}

function clearFieldError(inputId, errorId) {
  const input = document.getElementById(inputId);
  const err = document.getElementById(errorId);
  input.classList.remove('invalid');
  input.classList.add('valid');
  err.textContent = '';
  err.classList.remove('visible');
}

function clearAllErrors() {
  ['fullname', 'phone', 'email', 'state', 'city'].forEach(id => {
    document.getElementById(id).classList.remove('invalid', 'valid');
  });
  ['nameError', 'phoneError', 'emailError', 'stateError', 'cityError'].forEach(id => {
    const el = document.getElementById(id);
    el.textContent = '';
    el.classList.remove('visible');
  });
  document.getElementById('formError').style.display = 'none';
}

function showGroupError(groupId, errorId, msg) {
  document.getElementById(groupId).classList.add('invalid');
  const err = document.getElementById(errorId);
  err.textContent = msg;
  err.classList.add('visible');
}

function clearGroupError(groupId, errorId) {
  document.getElementById(groupId).classList.remove('invalid');
  const err = document.getElementById(errorId);
  err.textContent = '';
  err.classList.remove('visible');
}

function clearAboutMeErrors() {
  [
    ['ageGroup', 'ageError'],
    ['roleGroup', 'roleError'],
    ['topicsGroup', 'topicsError'],
    ['involvementGroup', 'involvementError'],
    ['paymentGroup', 'paymentError']
  ].forEach(([groupId, errorId]) => clearGroupError(groupId, errorId));
  document.getElementById('formError').style.display = 'none';
}

// ===== REAL-TIME INPUT RESTRICTIONS =====

// Name: block digits being typed
document.getElementById('fullname').addEventListener('keypress', function (e) {
  if (/[0-9]/.test(e.key)) {
    e.preventDefault();
    showFieldError('fullname', 'nameError', 'Name cannot contain numbers.');
  }
});
// Also strip any pasted digits
document.getElementById('fullname').addEventListener('input', function () {
  if (/[0-9]/.test(this.value)) {
    this.value = this.value.replace(/[0-9]/g, '');
    showFieldError('fullname', 'nameError', 'Name cannot contain numbers.');
  } else if (this.value.trim()) {
    clearFieldError('fullname', 'nameError');
  }
});

// Phone: only allow digits, +, -, spaces, ( )
document.getElementById('phone').addEventListener('keypress', function (e) {
  if (!/[\d\s\+\-\(\)]/.test(e.key)) {
    e.preventDefault();
    showFieldError('phone', 'phoneError', 'Phone number cannot contain letters.');
  }
});
document.getElementById('phone').addEventListener('input', function () {
  const cleaned = this.value.replace(/[^0-9\s\+\-\(\)]/g, '');
  if (cleaned !== this.value) {
    this.value = cleaned;
    showFieldError('phone', 'phoneError', 'Phone number cannot contain letters.');
  } else if (this.value.trim()) {
    clearFieldError('phone', 'phoneError');
  }
});

// Email: live format check on blur
document.getElementById('email').addEventListener('blur', function () {
  const val = this.value.trim();
  if (!val) return;
  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(val);
  if (!valid) {
    showFieldError('email', 'emailError', 'Please enter a valid email address (e.g. you@example.com).');
  } else {
    clearFieldError('email', 'emailError');
  }
});
document.getElementById('email').addEventListener('input', function () {
  const val = this.value.trim();
  if (/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(val)) {
    clearFieldError('email', 'emailError');
  }
});

// State & City: clear error on input
['state', 'city'].forEach(id => {
  document.getElementById(id).addEventListener('input', function () {
    if (this.value.trim()) clearFieldError(id, id + 'Error');
  });
});

function validateContactDetails() {
  clearAllErrors();

  const name = document.getElementById('fullname').value.trim();
  const phone = document.getElementById('phone').value.trim();
  const email = document.getElementById('email').value.trim();
  const state = document.getElementById('state').value.trim();
  const city = document.getElementById('city').value.trim();
  let hasError = false;

  // Name validation
  if (!name) {
    showFieldError('fullname', 'nameError', 'Full name is required.');
    hasError = true;
  } else if (/[0-9]/.test(name)) {
    showFieldError('fullname', 'nameError', 'Name cannot contain numbers.');
    hasError = true;
  }

  // Phone validation
  if (!phone) {
    showFieldError('phone', 'phoneError', 'Phone number is required.');
    hasError = true;
  } else if (!/^[\d\s\+\-\(\)]{7,}$/.test(phone)) {
    showFieldError('phone', 'phoneError', 'Enter a valid phone number (digits only).');
    hasError = true;
  }

  // Email validation
  if (!email) {
    showFieldError('email', 'emailError', 'Email address is required.');
    hasError = true;
  } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email)) {
    showFieldError('email', 'emailError', 'Please enter a valid email address (e.g. you@example.com).');
    hasError = true;
  }

  // State & City
  if (!state) { showFieldError('state', 'stateError', 'State is required.'); hasError = true; }
  if (!city) { showFieldError('city', 'cityError', 'City is required.'); hasError = true; }

  return !hasError;
}

function setFormStep(step) {
  const isAboutMe = step === 2;
  document.getElementById('formStep1').classList.toggle('active', !isAboutMe);
  document.getElementById('formStep2').classList.toggle('active', isAboutMe);
  document.getElementById('progressStep1').classList.toggle('complete', isAboutMe);
  document.getElementById('progressStep2').classList.toggle('active', isAboutMe);
  document.getElementById('progressLineFill').classList.toggle('complete', isAboutMe);
}

function goToAboutMe() {
  if (!validateContactDetails()) return;
  setFormStep(2);
  document.getElementById('formStep2').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function goToContactDetails() {
  setFormStep(1);
  document.getElementById('formStep1').scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function validateAboutMe() {
  clearAboutMeErrors();

  const age = document.querySelector('input[name="age"]:checked');
  const role = document.querySelector('input[name="role"]:checked');
  const topics = [...document.querySelectorAll('input[name="topics"]:checked')];
  const involvement = document.querySelector('input[name="involvement"]:checked');
  const paymentConsent = document.getElementById('paymentConsent').checked;
  let hasError = false;

  if (!age) {
    showGroupError('ageGroup', 'ageError', 'Please select your age group.');
    hasError = true;
  }
  if (!role) {
    showGroupError('roleGroup', 'roleError', 'Please select the option that describes you.');
    hasError = true;
  }
  if (topics.length === 0) {
    showGroupError('topicsGroup', 'topicsError', 'Please choose at least one topic.');
    hasError = true;
  }
  if (!involvement) {
    showGroupError('involvementGroup', 'involvementError', 'Please select how you would like to be involved.');
    hasError = true;
  }
  if (!paymentConsent) {
    showGroupError('paymentGroup', 'paymentError', 'You must confirm the ₹299 access fee to submit.');
    hasError = true;
  }

  return !hasError;
}

document.querySelectorAll('input[name="topics"]').forEach(input => {
  input.addEventListener('change', function () {
    const selected = document.querySelectorAll('input[name="topics"]:checked');
    if (selected.length > 3) {
      this.checked = false;
      showGroupError('topicsGroup', 'topicsError', 'You can choose up to 3 topics.');
      return;
    }
    if (selected.length > 0) clearGroupError('topicsGroup', 'topicsError');
  });
});

[
  ['age', 'ageGroup', 'ageError'],
  ['role', 'roleGroup', 'roleError'],
  ['involvement', 'involvementGroup', 'involvementError']
].forEach(([name, groupId, errorId]) => {
  document.querySelectorAll(`input[name="${name}"]`).forEach(input => {
    input.addEventListener('change', () => clearGroupError(groupId, errorId));
  });
});

document.getElementById('paymentConsent').addEventListener('change', function () {
  if (this.checked) clearGroupError('paymentGroup', 'paymentError');
});

// ===== FORM SUBMIT =====
async function handleSubmit() {
  if (localStorage.getItem('eliteWaitlistSubmitted') === 'true') return;
  if (!validateContactDetails()) {
    setFormStep(1);
    return;
  }
  if (!validateAboutMe()) return;

  const name = document.getElementById('fullname').value.trim();
  const phone = document.getElementById('phone').value.trim();
  const email = document.getElementById('email').value.trim();
  const state = document.getElementById('state').value.trim();
  const city = document.getElementById('city').value.trim();
  const age = document.querySelector('input[name="age"]:checked').value;
  const role = document.querySelector('input[name="role"]:checked').value;
  const topics = [...document.querySelectorAll('input[name="topics"]:checked')].map(input => input.value);
  const involvement = document.querySelector('input[name="involvement"]:checked').value;
  const paymentConsent = document.getElementById('paymentConsent').checked;
  const errEl = document.getElementById('formError');
  const btn = document.getElementById('submitBtn');
  const btnTxt = document.getElementById('btnText');

  btn.disabled = true;
  btnTxt.textContent = 'Submitting...';

  const payload = {
    name,
    phone,
    email,
    state,
    city,
    age,
    role,
    topics: topics.join(', '),
    involvement,
    paymentConsent,
    accessFee: 299
  };
  let isSuccess = false;

  try {
    if (GOOGLE_SCRIPT_URL && GOOGLE_SCRIPT_URL !== "YOUR_GOOGLE_APPS_SCRIPT_URL") {
      await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        mode: 'no-cors',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload)
      });
    }
    openModal();
    localStorage.setItem('eliteWaitlistSubmitted', 'true');
    isSuccess = true;
  } catch (err) {
    errEl.textContent = 'Something went wrong. Please try again.';
    errEl.style.display = 'block';
  } finally {
    if (!isSuccess) {
      btn.disabled = false;
      btnTxt.textContent = 'Join The Elite';
    } else {
      btnTxt.textContent = 'Already Joined';
    }
  }
}

document.getElementById('waitlistForm').addEventListener('submit', function (e) {
  e.preventDefault();
  handleSubmit();
});

// Check on page load
if (localStorage.getItem('eliteWaitlistSubmitted') === 'true') {
  const btn = document.getElementById('submitBtn');
  const btnTxt = document.getElementById('btnText');
  if (btn && btnTxt) {
    btn.disabled = true;
    btnTxt.textContent = 'Already Joined';
  }
}

function openModal() {
  document.getElementById('modalOverlay').classList.add('active');
  document.body.style.overflow = 'hidden';
  launchConfetti();
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('active');
  document.body.style.overflow = '';
}

// CONFETTI ANIMATION EFFECT
function launchConfetti() {
  const colors = [
    '#00FF40', '#00e676', '#69f0ae',  // vibrant greens
    '#FFD700', '#FFA500', '#ffea00',  // vibrant golds/yellows
    '#ffffff', '#00FFFF', '#FF00FF'   // bright white, cyan, magenta
  ];
  const shapes = ['square', 'circle', 'ribbon', 'star'];
  const total = 180;

  const container = document.createElement('div');
  container.id = 'confetti-container';
  container.style.cssText = `
    position: fixed; inset: 0; pointer-events: none; z-index: 99999; overflow: hidden;
  `;
  document.body.appendChild(container);

  for (let i = 0; i < total; i++) {
    const piece = document.createElement('div');
    const color = colors[Math.floor(Math.random() * colors.length)];
    const shape = shapes[Math.floor(Math.random() * shapes.length)];
    const size = Math.random() * 6 + 3; // Smaller size

    // Bottom-left origin
    const startLeft = -5 + Math.random() * 5;
    const startBottom = -5 + Math.random() * 5;

    const delay = Math.random() * 0.3; // tighter burst
    const duration = Math.random() * 2.5 + 2.5;

    const rotStart = Math.random() * 360;
    const rotEnd = rotStart + (Math.random() * 1440 - 720);

    // Shoot up and right
    const horizontalDistance = Math.random() * 100 + 30; // 30vw to 130vw
    const peakHeight = -(Math.random() * 70 + 50); // -50vh to -120vh
    const endHeight = 20; // 20vh below screen bottom

    let borderRadius = '2px';
    let width = size + 'px';
    let height = size + 'px';
    let clipPath = 'none';

    if (shape === 'circle') {
      borderRadius = '50%';
    } else if (shape === 'ribbon') {
      width = (size * 0.5) + 'px';
      height = (size * 2.5) + 'px';
    } else if (shape === 'star') {
      clipPath = 'polygon(50% 0%, 61% 35%, 98% 35%, 68% 57%, 79% 91%, 50% 70%, 21% 91%, 32% 57%, 2% 35%, 39% 35%)';
      borderRadius = '0';
      width = (size * 1.5) + 'px';
      height = (size * 1.5) + 'px';
    }

    piece.style.cssText = `
      position: absolute;
      bottom: ${startBottom}%;
      left: ${startLeft}%;
      width: ${width};
      height: ${height};
      background: ${color};
      border-radius: ${borderRadius};
      clip-path: ${clipPath};
      opacity: 1;
      box-shadow: ${shape === 'star' ? 'none' : `0 0 6px ${color}88`};
      transform-origin: center center;
    `;

    const kfName = 'cf_' + i;
    const style = document.createElement('style');
    style.textContent = `
      @keyframes ${kfName} {
        0%   { 
          transform: translate(0, 0) rotate(${rotStart}deg); 
          animation-timing-function: cubic-bezier(0.25, 0.46, 0.45, 0.94); 
          opacity: 1;
        }
        40%  { 
          transform: translate(${horizontalDistance * 0.5}vw, ${peakHeight}vh) rotate(${rotStart + (rotEnd - rotStart) * 0.4}deg); 
          animation-timing-function: cubic-bezier(0.55, 0.085, 0.68, 0.53); 
          opacity: 1; 
        }
        100% { 
          transform: translate(${horizontalDistance}vw, ${endHeight}vh) rotate(${rotEnd}deg); 
          opacity: 0; 
        }
      }
    `;
    document.head.appendChild(style);
    piece.style.animation = `${kfName} ${duration}s linear ${delay}s forwards`;

    container.appendChild(piece);
  }

  // Auto-clean DOM after animation completes
  setTimeout(() => {
    container.remove();
    document.querySelectorAll('style').forEach(s => {
      if (s.textContent.includes('cf_')) s.remove();
    });
  }, 6000);
}

// Close on overlay click
document.getElementById('modalOverlay').addEventListener('click', function (e) {
  if (e.target === this) closeModal();
});

// Enter key on text inputs
document.querySelectorAll('#formStep1 input').forEach(input => {
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      goToAboutMe();
    }
  });
});

// ===== CUSTOM CURSOR =====
const cursorDot = document.getElementById('cursorDot');
const cursorRing = document.getElementById('cursorRing');
const supportsPointerEffects = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
let mouseX = 0, mouseY = 0;
let ringX = 0, ringY = 0;

if (supportsPointerEffects) {
  document.addEventListener('mousemove', (e) => {
    mouseX = e.clientX;
    mouseY = e.clientY;
    
    if(cursorDot) {
      cursorDot.style.left = `${mouseX}px`;
      cursorDot.style.top = `${mouseY}px`;
    }
  });

  const animateRing = () => {
    ringX += (mouseX - ringX) * 0.15;
    ringY += (mouseY - ringY) * 0.15;
    if(cursorRing) {
      cursorRing.style.left = `${ringX}px`;
      cursorRing.style.top = `${ringY}px`;
    }
    requestAnimationFrame(animateRing);
  };
  animateRing();

  const interactables = document.querySelectorAll('a, button, input, textarea, .feature-card, .scramble-target');
  interactables.forEach(el => {
    el.addEventListener('mouseenter', () => {
      cursorRing?.classList.add('hovered');
      cursorDot?.classList.add('hovered');
    });
    el.addEventListener('mouseleave', () => {
      cursorRing?.classList.remove('hovered');
      cursorDot?.classList.remove('hovered');
    });
  });
}

// ===== MAGNETIC NAV LINKS =====
if (supportsPointerEffects) {
  document.querySelectorAll('.nav-cta').forEach(link => {
    link.addEventListener('mousemove', e => {
      const rect = link.getBoundingClientRect();
      const x = e.clientX - rect.left - rect.width / 2;
      const y = e.clientY - rect.top - rect.height / 2;
      link.style.transform = `translate(${x * 0.2}px, ${y * 0.2}px)`;
    });
    link.addEventListener('mouseleave', () => {
      link.style.transform = '';
    });
  });
}

// ===== HERO TITLE TEXT SCRAMBLE =====
const scrambleTarget = document.querySelector('.scramble-target');
if (scrambleTarget && supportsPointerEffects) {
  const letters = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
  let interval = null;

  scrambleTarget.addEventListener('mouseenter', e => {
    let step = 0;
    clearInterval(interval);
    const targetText = e.target.dataset.value;
    
    interval = setInterval(() => {
      e.target.innerText = targetText
        .split("")
        .map((letter, index) => {
          if (letter === " ") return " ";
          
          if (step < 12) {
            return letters[Math.floor(Math.random() * 26)];
          } else if (step < 24) {
            return "₹";
          } else {
            const resolveThreshold = 24 + index * 2;
            if (step >= resolveThreshold) {
              return letter;
            }
            return "₹";
          }
        })
        .join("");
      
      step++;
      
      if (step >= 24 + targetText.length * 2) {
        clearInterval(interval);
        e.target.innerText = targetText;
      }
    }, 30);
  });
}

// ===== 3D CARD TILT & SPOTLIGHT =====
if (supportsPointerEffects) {
  document.querySelectorAll('.feature-card').forEach(card => {
    card.addEventListener('mousemove', e => {
      const rect = card.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;
      
      // Spotlight variables
      card.style.setProperty('--mouse-x', `${x}px`);
      card.style.setProperty('--mouse-y', `${y}px`);

      // 3D Tilt
      const cx = rect.width / 2;
      const cy = rect.height / 2;
      const rotX = ((y - cy) / cy) * -8;
      const rotY = ((x - cx) / cx) * 8;
      card.style.transform = `perspective(800px) rotateX(${rotX}deg) rotateY(${rotY}deg) translateY(-4px)`;
    });
    card.addEventListener('mouseleave', () => {
      card.style.transform = 'perspective(800px) rotateX(0) rotateY(0) translateY(0)';
      card.style.transition = 'transform 0.5s ease, background 0.4s ease, border-color 0.4s ease, box-shadow 0.4s ease';
    });
    card.addEventListener('mouseenter', () => {
      card.style.transition = 'transform 0.1s ease, background 0.4s ease, border-color 0.4s ease, box-shadow 0.4s ease';
    });
  });
}

// ===== ANIMATED STAT COUNTERS =====
const statTargets = [
  { el: document.querySelectorAll('.stat-number')[0], target: 100, suffix: '%', prefix: '' },
  { el: document.querySelectorAll('.stat-number')[2], target: null, suffix: '', prefix: 'Elite' },
  { el: document.querySelectorAll('.stat-number')[3], target: null, suffix: '', prefix: '24/7' },
];

function animateCounter(el, target, suffix, prefix) {
  if (target === null) return;
  let start = 0;
  const duration = 1800;
  const startTime = performance.now();
  function step(now) {
    const progress = Math.min((now - startTime) / duration, 1);
    const ease = 1 - Math.pow(1 - progress, 3);
    el.textContent = Math.floor(ease * target) + suffix;
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

const statsObserver = new IntersectionObserver(entries => {
  entries.forEach(entry => {
    if (entry.isIntersecting) {
      animateCounter(statTargets[0].el, 100, '%', '');
      statsObserver.disconnect();
    }
  });
}, { threshold: 0.5 });

if (statTargets[0].el) statsObserver.observe(statTargets[0].el);

// ===== MAGNETIC EFFECT ON JOIN WAITLIST BUTTON =====
const magBtn = document.querySelector('.btn-primary');
if (magBtn && supportsPointerEffects) {
  magBtn.addEventListener('mousemove', e => {
    const rect = magBtn.getBoundingClientRect();
    const x = e.clientX - rect.left - rect.width / 2;
    const y = e.clientY - rect.top - rect.height / 2;
    magBtn.style.transform = `translate(${x * 0.18}px, ${y * 0.28}px) translateY(-2px) scale(1.03)`;
    magBtn.style.opacity = '1';
  });
  magBtn.addEventListener('mouseleave', () => {
    magBtn.style.transform = '';
    magBtn.style.opacity = '1';
    magBtn.style.transition = 'transform 0.5s cubic-bezier(0.23,1,0.32,1), box-shadow 0.3s ease';
  });
  magBtn.addEventListener('mouseenter', () => {
    magBtn.style.opacity = '1';
    magBtn.style.transition = 'transform 0.15s ease, box-shadow 0.3s ease';
  });
}

// ===== TYPEWRITER EFFECT on hero eyebrow =====
const eyebrow = document.querySelector('.hero-eyebrow');
if (eyebrow) {
  const originalText = eyebrow.textContent.trim();
  eyebrow.textContent = '';
  let i = 0;
  setTimeout(() => {
    const type = setInterval(() => {
      eyebrow.textContent = originalText.slice(0, ++i);
      if (i >= originalText.length) clearInterval(type);
    }, 45);
  }, 400);
}

// ===== RIPPLE on submit button =====
document.querySelectorAll('.btn-submit').forEach(button => button.addEventListener('click', function (e) {
  const rect = this.getBoundingClientRect();
  const ripple = document.createElement('span');
  const size = Math.max(rect.width, rect.height) * 2;
  ripple.style.cssText = `
      position:absolute; border-radius:50%; background:rgba(255,255,255,0.25);
      width:${size}px; height:${size}px;
      left:${e.clientX - rect.left - size / 2}px;
      top:${e.clientY - rect.top - size / 2}px;
      transform:scale(0); animation:rippleOut 0.6s ease forwards; pointer-events:none;
    `;
  this.appendChild(ripple);
  setTimeout(() => ripple.remove(), 700);
}));

// Ripple keyframe
const rippleStyle = document.createElement('style');
rippleStyle.textContent = `@keyframes rippleOut { to { transform:scale(1); opacity:0; } }`;
document.head.appendChild(rippleStyle);

// ===== SCROLL EFFECTS (Parallax, Progress Bar, etc) =====
window.addEventListener('scroll', () => {
  const winScroll = window.scrollY;
  const docHeight = document.body.scrollHeight - window.innerHeight;
  const scrollRatio = winScroll / docHeight;
  
  // 1. Cursor ring fade out at bottom
  if (typeof cursorRing !== 'undefined' && cursorRing && typeof cursorDot !== 'undefined' && cursorDot) {
    const op = scrollRatio > 0.95 ? '0' : '1';
    cursorRing.style.opacity = op;
    cursorDot.style.opacity = op;
  }

  // 2. Scroll Progress Bar
  const progressBar = document.getElementById('scrollProgress');
  if (progressBar) progressBar.style.width = (scrollRatio * 100) + '%';

  // 3. Hero Parallax
  const heroWrap = document.querySelector('.hero-name-wrap');
  if (heroWrap) {
    heroWrap.style.transform = `translateY(${winScroll * 0.4}px) scale(${1 - winScroll * 0.0003})`;
    heroWrap.style.opacity = 1 - winScroll * 0.0015;
  }
  
  const heroDesc = document.querySelector('.hero-desc');
  if (heroDesc) {
    heroDesc.style.transform = `translateY(${winScroll * 0.2}px)`;
    heroDesc.style.opacity = 1 - winScroll * 0.002;
  }

  // 4. Grid BG Parallax
  const gridBg = document.querySelector('.grid-bg');
  if (gridBg) {
    gridBg.style.backgroundPositionY = `${winScroll * 0.3}px`;
  }
});

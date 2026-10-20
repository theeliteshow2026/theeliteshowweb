// ===== CONFIG =====
// 🔧 REPLACE THESE TWO VALUES BEFORE GOING LIVE:
const WHATSAPP_LINK = "https://chat.whatsapp.com/ItDdTXKakan01FUREdRxar";
const GOOGLE_SCRIPT_URL = "https://script.google.com/macros/s/AKfycbylsTW9H43fY6-Mzuz6F9E19jeKf8vu6N7Wrn1IB1o2uwDU6mfHLVx1rFWePnczknDR/exec";
// Premium Community payments: Razorpay Checkout, backed by Supabase Edge Functions
const PAYMENTS_API = "https://mlrzeqekvhbzwnblzzlv.supabase.co/functions/v1";
const RAZORPAY_CHECKOUT_JS = "https://checkout.razorpay.com/v1/checkout.js";

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

function resetFieldErrors(fields) {
  fields.forEach(([inputId, errorId]) => {
    document.getElementById(inputId).classList.remove('invalid', 'valid');
    const err = document.getElementById(errorId);
    err.textContent = '';
    err.classList.remove('visible');
  });
  document.getElementById('formError').style.display = 'none';
}

function clearAllErrors() {
  resetFieldErrors([
    ['fullname', 'nameError'],
    ['phone', 'phoneError'],
    ['email', 'emailError'],
    ['state', 'stateError'],
    ['city', 'cityError']
  ]);
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
// Clear a field's error as soon as it has a value
['state', 'city', 'organisation', 'profileLink', 'message'].forEach(id => {
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
  } else if (!/^[\d\s\+\-\(\)]+$/.test(phone) || phone.replace(/\D/g, '').length < 10) {
    showFieldError('phone', 'phoneError', 'Enter a valid phone number with at least 10 digits.');
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

// ===== JOINING AS (free member / premium member / mentor / investor / partner) =====
// 'Member' is the paid Premium Community; the value is kept so earlier signups still match.
const PARTNER_MODAL = {
  modalTitle: 'Thank you for reaching out 🤝',
  modalMsg: "We've received your details and <strong>someone from the team will reach out personally</strong>. " +
    'In the meantime, you are welcome to join the WhatsApp community and see the room for yourself.'
};

const JOIN_COPY = {
  'Free Member': {
    step2: 'About Me',
    progress: 'About Me',
    submit: 'Join for Free',
    modalTitle: 'Welcome to The Elite Show Community 🎉',
    modalMsg: "You're officially in.<br><br>You've just taken your <strong>first step into the room</strong>. " +
      'Join our WhatsApp community to hear about the next mentor session, Elite Brew and workshop first.'
  },
  Member: {
    step2: 'Your Membership',
    progress: 'Membership',
    submit: 'Join for ₹199/month',
    // Shown only if online payment is unavailable; a paid member sees openPremiumWelcome instead
    modalTitle: 'Welcome to The Elite Show Premium Community 🎉',
    modalMsg: "Your spot is reserved.<br><br><strong>One last step: pay your first month's ₹199.</strong> " +
      "We'll send your payment link to your WhatsApp and email shortly." +
      '<br><br>Meanwhile, join our WhatsApp community to hear about the next mentor session, Elite Brew and workshop first.'
  },
  Mentor: {
    ...PARTNER_MODAL,
    progress: 'Your Interest',
    step2: 'Mentoring With Us',
    submit: 'Apply as a Mentor',
    label: 'What could you share with the community?',
    placeholder: 'Your area of expertise, and whether you would host a mentor session, an Elite Brew or a workshop.'
  },
  Investor: {
    ...PARTNER_MODAL,
    progress: 'Your Interest',
    step2: 'Investing With Us',
    submit: 'Start the Conversation',
    label: 'What would you like to explore with us?',
    placeholder: 'A little about you or your fund, and what you would like to know about The Elite Show Community.'
  },
  Collaborator: {
    ...PARTNER_MODAL,
    progress: 'Your Interest',
    step2: 'Partnering With Us',
    submit: 'Partner With Us',
    label: 'How would you like to collaborate?',
    placeholder: 'Hosting, sponsoring or co-creating an event, a workshop, a program or something else.'
  }
};

function checkedValue(name) {
  return document.querySelector(`input[name="${name}"]:checked`)?.value || '';
}

function getJoiningAs() {
  return checkedValue('joiningAs') || 'Free Member';
}

// One submission per audience, so a member can still apply as a mentor later.
// Members keep the original key so earlier signups stay recognised.
function submittedKey(joiningAs) {
  return joiningAs === 'Member' ? 'eliteWaitlistSubmitted' : `eliteWaitlistSubmitted:${joiningAs}`;
}

function hasSubmitted(joiningAs) {
  try {
    return localStorage.getItem(submittedKey(joiningAs)) === 'true';
  } catch (e) {
    return false;
  }
}

function markSubmitted(joiningAs) {
  try {
    localStorage.setItem(submittedKey(joiningAs), 'true');
  } catch (e) { /* storage blocked: nothing to remember */ }
}

// Free and Premium members answer the same questions; only Premium pays
function isMemberType(joiningAs) {
  return joiningAs === 'Member' || joiningAs === 'Free Member';
}

function updateMinorNote() {
  document.getElementById('minorNote').hidden = !(getJoiningAs() === 'Member' && checkedValue('age') === '13-17');
}

function updateJoinMode() {
  const joiningAs = getJoiningAs();
  const copy = JOIN_COPY[joiningAs];
  const isMember = isMemberType(joiningAs);

  document.getElementById('memberFields').hidden = !isMember;
  document.getElementById('partnerFields').hidden = isMember;
  document.getElementById('paymentGroup').hidden = joiningAs !== 'Member';
  updateMinorNote();
  document.getElementById('step2Title').textContent = copy.step2;
  document.querySelector('#progressStep2 strong').textContent = copy.progress;
  document.getElementById('nextBtnText').textContent = `Next: ${copy.progress}`;
  if (!isMember) {
    document.getElementById('messageLabel').textContent = copy.label;
    document.getElementById('message').placeholder = copy.placeholder;
  }

  const submitted = hasSubmitted(joiningAs);
  const awaitingPayment = joiningAs === 'Member' && pendingPremium && !submitted;
  document.getElementById('submitBtn').disabled = submitted;
  document.getElementById('btnText').textContent =
    submitted ? 'Already Joined' : awaitingPayment ? 'Complete Payment · ₹199/month' : copy.submit;
}

document.querySelectorAll('input[name="joiningAs"]').forEach(input => {
  input.addEventListener('change', updateJoinMode);
});

// Audience buttons pre-select who is joining before jumping to the form
document.querySelectorAll('[data-join]').forEach(link => {
  link.addEventListener('click', () => {
    const option = document.querySelector(`input[name="joiningAs"][value="${link.dataset.join}"]`);
    if (!option || option.checked) return;
    option.checked = true;
    updateJoinMode();
  });
});

function validatePartnerDetails() {
  resetFieldErrors([
    ['organisation', 'organisationError'],
    ['profileLink', 'profileLinkError'],
    ['message', 'messageError']
  ]);

  const organisation = document.getElementById('organisation').value.trim();
  const profileLink = document.getElementById('profileLink').value.trim();
  const message = document.getElementById('message').value.trim();
  let hasError = false;

  if (!organisation) {
    showFieldError('organisation', 'organisationError', 'Tell us your organisation or what you do.');
    hasError = true;
  }
  if (profileLink && !/^(https?:\/\/)?[a-z0-9-]+(\.[a-z0-9-]+)*\.[a-z]{2,}(\/\S*)?$/i.test(profileLink)) {
    showFieldError('profileLink', 'profileLinkError', 'Enter a valid link, or leave this blank.');
    hasError = true;
  }
  if (message.length < 10) {
    showFieldError('message', 'messageError', 'Please add a few words so we know how to reach out.');
    hasError = true;
  }

  return !hasError;
}

function validateAboutMe() {
  if (!isMemberType(getJoiningAs())) return validatePartnerDetails();
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
  if (getJoiningAs() === 'Member' && !paymentConsent) {
    showGroupError('paymentGroup', 'paymentError', 'Please agree to the ₹199 monthly membership fee to join.');
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

// Members under 18 get a reminder to involve a parent before paying
document.querySelectorAll('input[name="age"]').forEach(input => {
  input.addEventListener('change', updateMinorNote);
});

document.getElementById('paymentConsent').addEventListener('change', function () {
  if (this.checked) clearGroupError('paymentGroup', 'paymentError');
});

// ===== PREMIUM PAYMENT (Razorpay Checkout) =====
// Set once a Premium signup is saved, so closing the payment window and trying
// again goes straight back to payment.
let pendingPremium = null;

function loadScript(src) {
  return new Promise((resolve, reject) => {
    if (document.querySelector(`script[src="${src}"]`) && window.Razorpay) return resolve();
    const script = document.createElement('script');
    script.src = src;
    script.onload = resolve;
    script.onerror = () => reject(new Error(`Could not load ${src}`));
    document.head.append(script);
  });
}

async function postPayments(path, body) {
  const res = await fetch(`${PAYMENTS_API}/${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body)
  });
  const data = await res.json().catch(() => ({}));
  return { ok: res.ok && data.success, data };
}

// Resolves with { status: 'paid' | 'unavailable' | 'dismissed' | 'error', ... }
async function startPremiumPayment(contact) {
  const tryAgain = "We couldn't start the payment. Please check your connection and try again.";
  let start;
  try {
    start = await postPayments('create-subscription', contact);
    await loadScript(RAZORPAY_CHECKOUT_JS);
  } catch (err) {
    return { status: 'error', message: tryAgain };
  }
  // Payments not switched on yet: the member is told the link will be sent
  if (start.data.code === 'not_configured') return { status: 'unavailable' };
  if (!start.ok) return { status: 'error', message: start.data.message || tryAgain };

  return new Promise(resolve => {
    const checkout = new window.Razorpay({
      key: start.data.keyId,
      subscription_id: start.data.subscriptionId,
      name: 'The Elite Show Community',
      description: 'Premium Community · ₹199/month',
      prefill: { name: contact.name, email: contact.email, contact: contact.phone },
      theme: { color: '#CAFB0C' },
      handler: async response => {
        const notConfirmed = "Your payment went through but we couldn't confirm it yet. " +
          "Please don't pay again. We'll check it and reach out to you.";
        try {
          const verified = await postPayments('verify-payment', response);
          resolve(verified.ok ? { status: 'paid', ...verified.data } : { status: 'error', message: notConfirmed });
        } catch (err) {
          resolve({ status: 'error', message: notConfirmed });
        }
      },
      modal: {
        ondismiss: () => resolve({
          status: 'dismissed',
          message: 'Payment not completed. Tap "Complete Payment" whenever you are ready.'
        })
      }
    });
    checkout.open();
  });
}

function escapeHtml(text) {
  return String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

function openPremiumWelcome({ memberCode, communityLink }) {
  openModal('Member');
  document.getElementById('modalMsg').innerHTML =
    "Your payment is confirmed. <strong>You're now a Premium member.</strong>" +
    (memberCode ? `<br><br>Your member ID is <strong>${escapeHtml(memberCode)}</strong>. Keep it handy.` : '') +
    (communityLink
      ? '<br><br>Tap below to join the Premium community.'
      : "<br><br>We'll add you to the Premium community shortly.");
  const premiumBtn = document.getElementById('premiumBtn');
  premiumBtn.hidden = !communityLink;
  if (communityLink) premiumBtn.href = communityLink;
  document.querySelector('.btn-whatsapp').hidden = Boolean(communityLink);
}

// ===== FORM SUBMIT =====
async function handleSubmit() {
  const joiningAs = getJoiningAs();
  if (hasSubmitted(joiningAs)) return;
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
  const errEl = document.getElementById('formError');
  const btn = document.getElementById('submitBtn');
  const btnTxt = document.getElementById('btnText');

  btn.disabled = true;
  btnTxt.textContent = 'Submitting...';

  // Only the visible half of step 2 is sent; the Apps Script fills blanks for the rest.
  const payload = { name, phone, email, state, city, joiningAs };
  if (isMemberType(joiningAs)) {
    Object.assign(payload, {
      age: checkedValue('age'),
      role: checkedValue('role'),
      topics: [...document.querySelectorAll('input[name="topics"]:checked')].map(input => input.value).join(', '),
      involvement: checkedValue('involvement')
    });
    if (joiningAs === 'Member') {
      Object.assign(payload, { paymentConsent: document.getElementById('paymentConsent').checked, accessFee: 199 });
    }
  } else {
    Object.assign(payload, {
      organisation: document.getElementById('organisation').value.trim(),
      profileLink: document.getElementById('profileLink').value.trim(),
      message: document.getElementById('message').value.trim()
    });
  }

  try {
    // A Premium member who closed the payment window is already in the sheet
    const resumingPayment = joiningAs === 'Member' && pendingPremium;
    if (!resumingPayment && GOOGLE_SCRIPT_URL && GOOGLE_SCRIPT_URL !== "YOUR_GOOGLE_APPS_SCRIPT_URL") {
      // text/plain keeps this a "simple" CORS request, so Apps Script's JSON
      // reply is readable and a failed save is no longer shown as a success.
      const res = await fetch(GOOGLE_SCRIPT_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'text/plain;charset=utf-8' },
        body: JSON.stringify(payload)
      });
      const result = await res.json();
      if (!result.success) throw new Error(result.message || 'Unable to save registration.');
    }
    if (joiningAs === 'Member') {
      pendingPremium = pendingPremium || { name, email, phone };
      btnTxt.textContent = 'Opening Payment...';
      const outcome = await startPremiumPayment(pendingPremium);
      if (outcome.status === 'paid' || outcome.status === 'unavailable') {
        pendingPremium = null;
        markSubmitted(joiningAs);
        outcome.status === 'paid' ? openPremiumWelcome(outcome) : openModal(joiningAs);
      } else {
        errEl.textContent = outcome.message;
        errEl.style.display = 'block';
      }
      return;
    }
    markSubmitted(joiningAs);
    openModal(joiningAs);
  } catch (err) {
    errEl.textContent = 'Something went wrong. Please try again.';
    errEl.style.display = 'block';
  } finally {
    updateJoinMode();
  }
}

document.getElementById('waitlistForm').addEventListener('submit', function (e) {
  e.preventDefault();
  handleSubmit();
});

updateJoinMode();

function openModal(joiningAs = 'Free Member') {
  document.getElementById('modalTitle').textContent = JOIN_COPY[joiningAs].modalTitle;
  document.getElementById('modalMsg').innerHTML = JOIN_COPY[joiningAs].modalMsg;
  document.getElementById('premiumBtn').hidden = true;
  document.querySelector('.btn-whatsapp').hidden = false;
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

// Close on Escape
document.addEventListener('keydown', e => {
  if (e.key === 'Escape') closeModal();
});

// Keep the footer year current
const footerYear = document.getElementById('footerYear');
if (footerYear) footerYear.textContent = new Date().getFullYear();

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

  const interactables = document.querySelectorAll('a, button, input, textarea, .feature-card, .audience-card, .session-card, .scramble-target');
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

// ===== HERO SPOTLIGHT =====
// Session posters sit under a dark stage; the cursor (or a tap) moves the spotlight.
// When nobody is steering, the beam drifts on its own.
const hero = document.getElementById('hero');
const heroCrowd = document.querySelector('.hero-crowd');
if (hero && heroCrowd && typeof MENTOR_SESSIONS !== 'undefined') {
  const posters = MENTOR_SESSIONS.filter(s => s.poster)
    .sort((a, b) => (b.date || '').localeCompare(a.date || ''))
    .map(s => s.poster);
  if (posters.length) {
    heroCrowd.innerHTML = Array.from({ length: 8 }, (_, i) =>
      `<img src="${posters[i % posters.length]}" alt="" loading="${i < 4 ? 'eager' : 'lazy'}">`).join('');
  }

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  let steeredAt = 0;
  let heroVisible = true;
  let t = 0;
  const moveSpot = e => {
    const rect = hero.getBoundingClientRect();
    hero.style.setProperty('--spot-x', (e.clientX - rect.left) + 'px');
    hero.style.setProperty('--spot-y', (e.clientY - rect.top) + 'px');
    steeredAt = performance.now();
  };
  hero.addEventListener('pointermove', moveSpot);
  hero.addEventListener('pointerdown', moveSpot);
  // A finger lifting also fires pointerleave; only a mouse leaving hands the beam back to the drift
  hero.addEventListener('pointerleave', e => { if (e.pointerType === 'mouse') steeredAt = 0; });

  new IntersectionObserver(entries => { heroVisible = entries[0].isIntersecting; }).observe(hero);

  const drift = now => {
    requestAnimationFrame(drift);
    if (reduceMotion || !heroVisible || now - steeredAt < 2500) return;
    t += 0.008;
    hero.style.setProperty('--spot-x', (50 + Math.cos(t) * 32) + '%');
    hero.style.setProperty('--spot-y', (38 + Math.sin(t * 1.7) * 20) + '%');
  };
  requestAnimationFrame(drift);
}

// ===== BRAND BAND: TITLE SCRAMBLE =====
// Letters shuffle, flip to ₹, then settle one by one. Plays when the band
// scrolls into view, and again on hover where there is a mouse.
const scrambleTarget = document.querySelector('.scramble-target');
if (scrambleTarget) {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const rupee = String.fromCharCode(8377);
  const targetText = scrambleTarget.dataset.value;
  let interval = null;
  const scramble = () => {
    let step = 0;
    clearInterval(interval);
    interval = setInterval(() => {
      scrambleTarget.textContent = [...targetText].map((letter, index) => {
        if (letter === ' ') return ' ';
        if (step < 12) return letters[Math.floor(Math.random() * 26)];
        return step >= 24 + index * 2 ? letter : rupee;
      }).join('');
      step++;
      if (step >= 24 + targetText.length * 2) {
        clearInterval(interval);
        scrambleTarget.textContent = targetText;
      }
    }, 34);
  };
  if (!window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const bandWatcher = new IntersectionObserver(entries => {
      if (entries[0].isIntersecting) { scramble(); bandWatcher.disconnect(); }
    }, { threshold: 0.6 });
    bandWatcher.observe(scrambleTarget);
    if (supportsPointerEffects) scrambleTarget.addEventListener('mouseenter', scramble);
  }
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
function animateCounter(el) {
  const target = Number(el.dataset.count);
  const pad = Number(el.dataset.pad || 0);
  const suffix = el.dataset.suffix || '';
  const duration = 1400;
  const startTime = performance.now();
  function step(now) {
    const progress = Math.min((now - startTime) / duration, 1);
    const ease = 1 - Math.pow(1 - progress, 3);
    el.textContent = String(Math.round(ease * target)).padStart(pad, '0') + suffix;
    if (progress < 1) requestAnimationFrame(step);
  }
  requestAnimationFrame(step);
}

// Reduced-motion users get the final numbers straight away
const counters = window.matchMedia('(prefers-reduced-motion: reduce)').matches
  ? []
  : document.querySelectorAll('.stat-number[data-count]');
const statsObserver = new IntersectionObserver(entries => {
  if (entries.some(entry => entry.isIntersecting)) {
    counters.forEach(animateCounter);
    statsObserver.disconnect();
  }
}, { threshold: 0.5 });

if (counters.length) statsObserver.observe(counters[0]);

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

  // 3. Grid BG Parallax
  const gridBg = document.querySelector('.grid-bg');
  if (gridBg) {
    gridBg.style.backgroundPositionY = `${winScroll * 0.3}px`;
  }
});

// ===== THINK BIG: HARD DROP =====
// Lines fall bottom line first, so each lands on the one below, and slam down when the closing screen scrolls
// into view: shake and flash on every impact. Runs once.
(function () {
  const section = document.getElementById('rise');
  if (!section || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const title = section.querySelector('.rise-title');
  const lines = section.querySelectorAll('.rise-line');
  const IMPACT_AT = 0.52 * 1150; // ms into each line's drop, matches rise-drop's 52% frame
  const STAGGER = 320;

  section.classList.add('rise--armed');

  function impact() {
    title.classList.remove('is-shaking');
    section.classList.remove('is-impact');
    void title.offsetWidth; // restart the animations
    title.classList.add('is-shaking');
    section.classList.add('is-impact');
  }

  const watcher = new IntersectionObserver(entries => {
    if (!entries[0].isIntersecting) return;
    watcher.disconnect();
    section.classList.add('rise--dropped');
    lines.forEach((_, i) => setTimeout(impact, i * STAGGER + IMPACT_AT));
  }, { threshold: 0.55 });
  watcher.observe(section);
})();


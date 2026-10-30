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
// Mentors, investors and collaborators get a handwritten "Thank you" from the founders
const PARTNER_MODAL = {
  scene: 'note',
  modalEyebrow: 'Request received',
  modalTitle: "We'll be in touch",
  modalMsg: '<strong>Someone from the team will reach out personally</strong> to talk through your idea.'
};

const JOIN_COPY = {
  'Free Member': {
    step2: 'About Me',
    progress: 'About Me',
    submit: 'Join for Free',
    scene: 'stamp',
    modalEyebrow: 'Welcome to The Elite Show Community',
    modalTitle: 'Stamped and in',
    modalMsg: 'Your <strong>first step into the room</strong>. Join WhatsApp to hear about ' +
      '<strong>Saturday sessions</strong> and <strong>daily discussions</strong> first.'
  },
  Member: {
    step2: 'Your Membership',
    progress: 'Membership',
    submit: 'Join for ₹199/month',
    // Shown only if online payment is unavailable; a paid member sees openPremiumWelcome instead
    scene: '',
    modalEyebrow: 'Premium · Spot reserved',
    modalTitle: 'Your spot is reserved',
    modalMsg: "<strong>One last step: pay your first month's ₹199.</strong> " +
      "We'll send your payment link to your WhatsApp and email shortly." +
      '<br><br>Meanwhile, join our WhatsApp community to hear about the next mentor session, Elite Brew and workshop first.'
  },
  Mentor: {
    ...PARTNER_MODAL,
    progress: 'Your Interest',
    noteRole: 'Mentor request',
    modalMsg: '<strong>Someone from the team will reach out personally</strong> to plan a session with you.',
    step2: 'Mentoring With Us',
    submit: 'Apply as a Mentor',
    label: 'What could you share with the community?',
    placeholder: 'Your area of expertise, and whether you would host a mentor session, an Elite Brew or a workshop.'
  },
  Investor: {
    ...PARTNER_MODAL,
    progress: 'Your Interest',
    noteRole: 'Investor note',
    modalMsg: '<strong>A founder will reach out personally</strong> to set up a conversation.',
    step2: 'Investing With Us',
    submit: 'Start the Conversation',
    label: 'What would you like to explore with us?',
    placeholder: 'A little about you or your fund, and what you would like to know about The Elite Show Community.'
  },
  Collaborator: {
    ...PARTNER_MODAL,
    progress: 'Your Interest',
    noteRole: 'Partnership idea',
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

// A paid Premium member first sees a sealed letter; opening it shows their member card
function openPremiumWelcome({ memberCode, communityLink, name }) {
  openModal('Member', name, 'letter');
  if (window.MemberShare) MemberShare.remember(name, memberCode);
  document.getElementById('memberShare').hidden = true;
  document.getElementById('modalEyebrow').textContent = 'Payment confirmed' + (memberCode ? ' · ' + memberCode : '');
  document.getElementById('modalTitle').textContent = 'Something arrived for you';
  document.getElementById('modalMsg').innerHTML =
    "You're a <strong>Premium member</strong> now. Your membership card is sealed inside.";
  document.querySelector('.btn-whatsapp').hidden = true;
  const openCardBtn = document.getElementById('openCardBtn');
  openCardBtn.hidden = false;
  openCardBtn.onclick = () => {
    setModalScene('');
    openCardBtn.hidden = true;
    showMemberCard(name, memberCode);
    document.getElementById('modalEyebrow').textContent = 'Your membership card';
    document.getElementById('modalTitle').textContent = 'Welcome to Premium';
    document.getElementById('modalMsg').innerHTML = communityLink
      ? 'Tap below to join the Premium community.'
      : "We'll add you to the Premium community shortly.";
    const premiumBtn = document.getElementById('premiumBtn');
    premiumBtn.hidden = !communityLink;
    if (communityLink) premiumBtn.href = communityLink;
    document.querySelector('.btn-whatsapp').hidden = Boolean(communityLink);
    // The share image was already prepared by MemberShare.remember above
    document.getElementById('memberShare').hidden = !window.MemberShare;
    // The card view above stays underneath; the 3D envelope opens on top where the device can run it
    if (canRunCardReveal()) openCardReveal({ name, memberCode, communityLink, since: memberSinceNow() });
  };
}

// ===== CARD REVEAL (the 3D sealed envelope in card_reveal.html) =====
// Only loaded when a paid member taps "Open your membership card". Older phones, reduced motion
// and browsers without WebGL keep the flat card in the popup instead.
function canRunCardReveal() {
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return false;
  if (navigator.deviceMemory && navigator.deviceMemory < 3) return false;
  if (navigator.hardwareConcurrency && navigator.hardwareConcurrency < 4) return false;
  try {
    const gl = document.createElement('canvas').getContext('webgl2');
    return Boolean(gl);
  } catch (err) {
    return false;
  }
}

function openCardReveal(member) {
  if (document.getElementById('cardReveal')) return;
  window.__cardReveal = member;
  const frame = document.createElement('iframe');
  frame.id = 'cardReveal';
  frame.className = 'card-reveal';
  frame.title = 'Your membership card';
  frame.src = 'card_reveal.html';
  frame.allow = 'vibrate';
  document.body.appendChild(frame);
  frame.focus();
}

// Called from inside card_reveal.html. share: true goes straight to the share sheet.
function closeCardReveal({ share = false } = {}) {
  const frame = document.getElementById('cardReveal');
  if (frame) frame.remove();
  if (share) document.getElementById('shareCardImage').click();
  else document.querySelector('#modalOverlay .modal-close').focus();
}

function memberSinceNow() {
  return new Date().toLocaleDateString('en-IN', { month: 'short', year: 'numeric' }).toUpperCase();
}

// Only a paid Premium member sees their card: name, ESP number and join month.
// It tilts and catches the light under the cursor.
function showMemberCard(name, memberCode, since = memberSinceNow()) {
  const card = document.getElementById('memberCard');
  document.getElementById('memberCardName').textContent = name || 'Premium Member';
  document.getElementById('memberCardId').textContent = memberCode || 'ESP-····';
  document.getElementById('memberCardSince').textContent = since;
  document.querySelector('.modal-icon').hidden = true;
  card.hidden = false;
}

(function () {
  const card = document.getElementById('memberCard');
  if (!card || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  const modal = card.closest('.modal');
  modal.addEventListener('pointermove', e => {
    if (card.hidden) return;
    const rect = card.getBoundingClientRect();
    const x = Math.min(Math.max((e.clientX - rect.left) / rect.width, 0), 1);
    const y = Math.min(Math.max((e.clientY - rect.top) / rect.height, 0), 1);
    card.style.transform = `perspective(900px) rotateY(${(x - 0.5) * 22}deg) rotateX(${(0.5 - y) * 18}deg)`;
    card.style.setProperty('--sheen-x', x * 100 + '%');
    card.style.setProperty('--sheen-y', y * 100 + '%');
    card.style.setProperty('--sheen-a', x * 220 + 'deg');
  });
  modal.addEventListener('pointerleave', () => { card.style.transform = ''; });
})();

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
        const payer = pendingPremium;
        pendingPremium = null;
        markSubmitted(joiningAs);
        outcome.status === 'paid' ? openPremiumWelcome({ ...outcome, name: payer.name }) : openModal(joiningAs, payer.name);
      } else {
        errEl.textContent = outcome.message;
        errEl.style.display = 'block';
      }
      return;
    }
    markSubmitted(joiningAs);
    openModal(joiningAs, name);
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

function shortDate(date = new Date()) {
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }).toUpperCase();
}

// Shows one scene in the popup's stage ('letter', 'stamp', 'note' or '' for none) and replays its animation
function setModalScene(scene) {
  const modal = document.querySelector('#modalOverlay .modal');
  modal.dataset.scene = scene;
  modal.classList.remove('is-playing');
  void modal.offsetWidth;
  modal.classList.add('is-playing');
  document.querySelector('.modal-icon').hidden = Boolean(scene);
}

function fillModalScene(copy, name) {
  const fullName = name || 'Friend';
  const firstName = fullName.split(/\s+/)[0];
  const today = shortDate();
  document.getElementById('tyLetterName').textContent = fullName;
  document.getElementById('tyPostDate').textContent = today.replace(/ /g, '·');
  document.getElementById('tyPassName').textContent = fullName;
  document.getElementById('tyPassDate').textContent = today;
  document.getElementById('tyStampDate').textContent = '★ ' + today + ' ★';
  const line = document.getElementById('tyNoteLine');
  line.textContent = `Thank you, ${firstName}.`;
  // Shrinks the handwriting for long first names so the line stays inside the note
  line.style.fontSize = Math.min(34, Math.floor(650 / line.textContent.length)) + 'px';
  document.getElementById('tyNoteRole').textContent = copy.noteRole || '';
}

function openModal(joiningAs = 'Free Member', name = '', scene = JOIN_COPY[joiningAs].scene || '') {
  const copy = JOIN_COPY[joiningAs];
  document.getElementById('modalEyebrow').textContent = copy.modalEyebrow || '';
  document.getElementById('modalTitle').textContent = copy.modalTitle;
  document.getElementById('modalMsg').innerHTML = copy.modalMsg;
  document.getElementById('premiumBtn').hidden = true;
  document.getElementById('openCardBtn').hidden = true;
  document.querySelector('.btn-whatsapp').hidden = scene === 'note';
  document.getElementById('modalUpsell').hidden = joiningAs !== 'Free Member';
  document.getElementById('modalBack').hidden = scene !== 'note';
  document.getElementById('memberCard').hidden = true;
  document.getElementById('memberShare').hidden = true;
  fillModalScene(copy, name);
  setModalScene(scene);
  document.getElementById('modalOverlay').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  document.getElementById('modalOverlay').classList.remove('active');
  document.body.style.overflow = '';
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

  // Watched on the whole page so cards that load later (live sessions, reviews) count too
  const interactable = 'a, button, input, textarea, .feature-card, .audience-card, .session-card';
  document.addEventListener('mouseover', e => {
    const on = !!e.target.closest(interactable);
    cursorRing?.classList.toggle('hovered', on);
    cursorDot?.classList.toggle('hovered', on);
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
  // One tile per session, newest first. The grid picks its own columns and rows
  // from the session count and the hero's shape so tiles stay poster-shaped
  // (4:5) and always fill the stage. Tiles shrink as sessions add up, down to a
  // minimum width; past that the wall shows the newest sessions that fit.
  // Spare cells in the last row repeat the newest posters, so there are no holes.
  let sessions = [];
  let crowdLayout = '';
  const layoutCrowd = () => {
    const w = hero.clientWidth, h = hero.clientHeight;
    if (!sessions.length || !w || !h) return;
    const n = sessions.length;
    const maxCols = Math.max(2, Math.floor(w / (w <= 700 ? 90 : 120)));
    const rowsFor = c => Math.max(1, Math.round(h / (w / c * 1.25)));
    // Prefer a grid that fits every session with the fewest repeats while
    // tiles stay roughly poster-shaped
    let cols = 0, rows = 0, best = Infinity;
    for (let c = 1; c <= maxCols; c++) {
      const r = Math.ceil(n / c), shape = (h / r) / (w / c);
      if (shape < 0.85 || shape > 1.8) continue;
      const score = (c * r - n) + Math.abs(Math.log(shape / 1.25)) * 2;
      if (score < best) { best = score; cols = c; rows = r; }
    }
    // Otherwise size tiles from the poster shape: the fewest columns that
    // hold every session, or the densest allowed grid of the newest ones
    if (!cols) {
      for (cols = 1; cols < maxCols && cols * rowsFor(cols) < n; cols++);
      rows = rowsFor(cols);
    }
    const key = cols + 'x' + rows;
    if (key === crowdLayout) return;
    crowdLayout = key;
    heroCrowd.style.setProperty('--crowd-cols', cols);
    heroCrowd.style.setProperty('--crowd-rows', rows);
    heroCrowd.replaceChildren(...Array.from({ length: cols * rows }, (_, i) => {
      const s = sessions[i % n];
      const img = setPosterImage(document.createElement('img'), s.poster, `${Math.ceil(100 / cols)}vw`, s.posterSmall);
      img.alt = '';
      img.decoding = 'async';
      if (i >= 8) img.fetchPriority = 'low';
      return img;
    }));
  };
  // The live posters from the admin panel, or the built-in ones if Supabase doesn't answer
  (typeof SITE_CONTENT !== 'undefined' ? SITE_CONTENT : Promise.resolve({}))
    .then(c => {
      sessions = (c.sessions && c.sessions.length ? c.sessions : MENTOR_SESSIONS)
        .filter(s => s.poster)
        .sort((a, b) => (b.date || '').localeCompare(a.date || ''));
      crowdLayout = '';
      layoutCrowd();
    });
  new ResizeObserver(layoutCrowd).observe(hero);

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

  new IntersectionObserver(entries => { heroVisible = entries[entries.length - 1].isIntersecting; }).observe(hero);

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
// Letters shuffle, flip to $, then settle one by one. Plays when the band
// scrolls into view, then stays put.
const scrambleTarget = document.querySelector('.scramble-target');
if (scrambleTarget) {
  const letters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  const targetText = scrambleTarget.dataset.value;
  let interval = null;
  const scramble = () => {
    let step = 0;
    clearInterval(interval);
    interval = setInterval(() => {
      scrambleTarget.textContent = [...targetText].map((letter, index) => {
        if (letter === ' ') return ' ';
        if (step < 12) return letters[Math.floor(Math.random() * 26)];
        return step >= 24 + index * 2 ? letter : '$';
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
      if (entries[entries.length - 1].isIntersecting) { scramble(); bandWatcher.disconnect(); }
    }, { threshold: 0.6 });
    bandWatcher.observe(scrambleTarget);
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

// ===== WHAT WE DO: LIGHT ONE VERB AT A TIME =====
// The verb crossing the middle of the screen lights up; hovering or focusing one takes over.
(function () {
  const verbs = [...document.querySelectorAll('.verb')];
  if (!verbs.length) return;
  const light = verb => verbs.forEach(v => v.classList.toggle('is-lit', v === verb));
  verbs.forEach(verb => {
    verb.addEventListener('mouseenter', () => light(verb));
    verb.addEventListener('focus', () => light(verb));
  });
  const middle = new IntersectionObserver(entries => {
    entries.forEach(entry => { if (entry.isIntersecting) light(entry.target); });
  }, { rootMargin: '-45% 0px -45% 0px' });
  verbs.forEach(verb => middle.observe(verb));
})();

// ===== THE EXPERIENCE: LIVE / REAL LINES RISE IN =====
(function () {
  const lines = document.querySelector('.live-real');
  if (!lines || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;
  lines.classList.add('is-armed');
  const watcher = new IntersectionObserver(entries => {
    if (!entries[entries.length - 1].isIntersecting) return;
    watcher.disconnect();
    lines.classList.add('is-in');
  }, { threshold: 0.4 });
  watcher.observe(lines);
})();

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

  // Magnetic hold: the page eases the screen into place and holds it until the last line lands, then lets go
  const HOLD = (lines.length - 1) * STAGGER + IMPACT_AT + 150;
  const swallow = e => e.preventDefault();
  const swallowKeys = e => {
    if ([' ', 'PageDown', 'PageUp', 'ArrowDown', 'ArrowUp', 'End', 'Home'].includes(e.key)) e.preventDefault();
  };
  function magnetHold() {
    const top = section.getBoundingClientRect().top + window.scrollY;
    window.scrollTo({ top, behavior: 'smooth' });
    window.addEventListener('wheel', swallow, { passive: false });
    window.addEventListener('touchmove', swallow, { passive: false });
    window.addEventListener('keydown', swallowKeys);
    setTimeout(() => {
      window.removeEventListener('wheel', swallow);
      window.removeEventListener('touchmove', swallow);
      window.removeEventListener('keydown', swallowKeys);
    }, HOLD);
  }

  const watcher = new IntersectionObserver(entries => {
    if (!entries[entries.length - 1].isIntersecting) return;
    watcher.disconnect();
    magnetHold();
    section.classList.add('rise--dropped');
    lines.forEach((_, i) => setTimeout(impact, i * STAGGER + IMPACT_AT));
  }, { threshold: 0.55 });
  watcher.observe(section);
})();


// ===== SHARE THE MEMBER CARD =====
// After paying, a Premium member can share their card: as an image (drawn here in the browser
// with their name, ESP number and join month) and as the /join link with an invite message.
// The card is kept on this device, so "Share your member card" in Membership brings it back later.

window.MemberShare = (() => {
  const STORAGE_KEY = 'eliteShowMemberCard';
  const JOIN_URL = 'https://www.theeliteshow.com/join';
  const MESSAGE = "I just joined The Elite Show Community 🎉 Now it's your turn to be a part of this community. " +
    'Join now 👉 ' + JOIN_URL;
  const LIME = '#CAFB0C';
  const W = 1080;
  const H = 1920;

  let member = null;
  let imageBlob = null;
  let imagePromise = null;

  function load() {
    try { return JSON.parse(localStorage.getItem(STORAGE_KEY)); } catch { return null; }
  }

  function remember(name, memberCode) {
    member = { name: name || 'Premium Member', memberCode: memberCode || '', since: memberSinceNow() };
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify(member)); } catch { /* private mode: share still works now */ }
    document.getElementById('shareMyCard').hidden = false;
    prepare();
  }

  // Shows the share buttons under the card and starts drawing the image, so it is ready
  // the moment someone taps Share (phones only allow sharing straight after a tap).
  function prepare() {
    document.getElementById('memberShare').hidden = false;
    document.getElementById('shareCardWhatsApp').href = 'https://wa.me/?text=' + encodeURIComponent(MESSAGE);
    imageBlob = null;
    imagePromise = drawCard().then(blob => (imageBlob = blob)).catch(() => null);
  }

  // Opens the welcome popup again, showing only the card and the share buttons.
  function reopen() {
    openModal('Member');
    document.querySelectorAll('#confetti-container').forEach(el => el.remove());
    showMemberCard(member.name, member.memberCode, member.since);
    document.getElementById('modalTitle').textContent = 'Your member card';
    document.getElementById('modalMsg').innerHTML =
      "Show people you're in. <strong>Your image, link and message are ready to send.</strong>";
    document.querySelector('.btn-whatsapp').hidden = true;
    prepare();
  }

  function fileName() {
    return 'elite-show-member' + (member.memberCode ? '-' + member.memberCode : '') + '.png';
  }

  async function shareImage(button) {
    const blob = imageBlob || await imagePromise;
    if (!blob) return flash(button, "Couldn't make the image");
    const file = new File([blob], fileName(), { type: 'image/png' });
    if (navigator.canShare && navigator.canShare({ files: [file] })) {
      try {
        await navigator.share({ files: [file], text: MESSAGE });
      } catch (err) {
        if (err.name !== 'AbortError') saveImage(button);
      }
    } else {
      saveImage(button);
    }
  }

  async function saveImage(button) {
    const blob = imageBlob || await imagePromise;
    if (!blob) return flash(button, "Couldn't make the image");
    const url = URL.createObjectURL(blob);
    const link = Object.assign(document.createElement('a'), { href: url, download: fileName() });
    document.body.appendChild(link);
    link.click();
    link.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
    flash(button, 'Image saved');
  }

  async function copyLink(button) {
    try {
      await navigator.clipboard.writeText(MESSAGE);
    } catch {
      const box = Object.assign(document.createElement('textarea'), { value: MESSAGE });
      box.setAttribute('readonly', '');
      box.style.cssText = 'position:fixed;opacity:0';
      document.body.appendChild(box);
      box.select();
      document.execCommand('copy');
      box.remove();
    }
    flash(button, 'Copied');
  }

  function flash(button, text) {
    if (!button.dataset.label) button.dataset.label = button.textContent;
    button.textContent = text;
    clearTimeout(button.flashTimer);
    button.flashTimer = setTimeout(() => { button.textContent = button.dataset.label; }, 2200);
  }

  // ----- The image: a 1080x1920 story with the member's card over the session poster wall -----

  async function drawCard() {
    await Promise.all([
      document.fonts.load('900 120px Archivo'),
      document.fonts.load('700 40px "Cormorant Garamond"'),
      document.fonts.load('600 40px Montserrat'),
      document.fonts.load('500 40px Montserrat')
    ]).catch(() => {});
    const logo = await loadImage('images/logo/the-elite-show-horizontal.png');
    const canvas = document.createElement('canvas');
    canvas.width = W;
    canvas.height = H;
    const ctx = canvas.getContext('2d');

    ctx.fillStyle = '#070707';
    ctx.fillRect(0, 0, W, H);
    drawPosterWall(ctx);
    const veil = ctx.createRadialGradient(W / 2, 980, 120, W / 2, 980, 1100);
    veil.addColorStop(0, 'rgba(7,7,7,0.35)');
    veil.addColorStop(1, 'rgba(7,7,7,0.96)');
    ctx.fillStyle = veil;
    ctx.fillRect(0, 0, W, H);
    const glow = ctx.createRadialGradient(W / 2, 1000, 0, W / 2, 1000, 620);
    glow.addColorStop(0, 'rgba(202,251,12,0.22)');
    glow.addColorStop(1, 'rgba(202,251,12,0)');
    ctx.fillStyle = glow;
    ctx.fillRect(0, 0, W, H);

    ctx.textAlign = 'center';
    ctx.textBaseline = 'alphabetic';
    if (logo) {
      const logoH = 130;
      const logoW = logoH * logo.naturalWidth / logo.naturalHeight;
      ctx.drawImage(logo, (W - logoW) / 2, 110, logoW, logoH);
    } else {
      spacedText(ctx, [['THE ELITE SHOW ', LIME], ['COMMUNITY', '#f5f5f0']], W / 2, 190, '700 40px "Cormorant Garamond", serif', 12);
    }

    display(ctx, 132);
    ctx.fillStyle = '#f5f5f0';
    ctx.fillText("I'M IN", W / 2, 470);
    ctx.fillText('THE ROOM.', W / 2, 610);

    drawMemberCard(ctx, W / 2, 1010);

    ctx.font = '500 46px Montserrat, sans-serif';
    ctx.fillStyle = '#d6d6cf';
    ctx.fillText("Now it's your turn.", W / 2, 1450);

    const btnW = 760;
    const btnH = 130;
    ctx.fillStyle = LIME;
    ctx.fillRect((W - btnW) / 2, 1520, btnW, btnH);
    ctx.fillStyle = '#070707';
    spacedText(ctx, [['JOIN NOW', '#070707']], W / 2, 1600, '700 40px Montserrat, sans-serif', 8);
    spacedText(ctx, [['THEELITESHOW.COM/JOIN', '#9a9a92']], W / 2, 1770, '600 34px Montserrat, sans-serif', 6);

    return new Promise((resolve, reject) =>
      canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('no image'))), 'image/png'));
  }

  // A PNG, not the SVG: Safari will not export a canvas that has an SVG drawn on it
  function loadImage(src) {
    return new Promise(resolve => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null);
      img.src = src;
    });
  }

  // Faint, tilted wall of the session posters already on the page (same site only, so the image can be saved).
  function drawPosterWall(ctx) {
    const seen = new Set();
    const posters = [...document.querySelectorAll('img')].filter(img => {
      const src = img.currentSrc || img.src;
      if (!src.includes('/posters/') || !img.complete || !img.naturalWidth || seen.has(src)) return false;
      if (new URL(src, location.href).origin !== location.origin) return false;
      seen.add(src);
      return true;
    }).slice(0, 12);
    if (!posters.length) return;
    const cols = 5;
    const tileW = 300;
    const tileH = 375;
    const gap = 18;
    ctx.save();
    ctx.globalAlpha = 0.5;
    ctx.translate(W / 2, H / 2);
    ctx.rotate(-8 * Math.PI / 180);
    let i = 0;
    for (let row = -4; row <= 4; row++) {
      for (let col = 0; col < cols; col++) {
        const img = posters[i++ % posters.length];
        const x = (col - cols / 2) * (tileW + gap) + (row % 2 ? tileW / 2 : 0);
        const y = row * (tileH + gap) - tileH / 2;
        cover(ctx, img, x, y, tileW, tileH);
      }
    }
    ctx.restore();
  }

  function cover(ctx, img, x, y, w, h) {
    const scale = Math.max(w / img.naturalWidth, h / img.naturalHeight);
    const sw = w / scale;
    const sh = h / scale;
    ctx.drawImage(img, (img.naturalWidth - sw) / 2, (img.naturalHeight - sh) / 2, sw, sh, x, y, w, h);
  }

  // Same look as the card in the popup: dark, lime edge, lime chip.
  function drawMemberCard(ctx, cx, cy) {
    const cw = 900;
    const ch = Math.round(cw / 1.586);
    ctx.save();
    ctx.translate(cx, cy);
    ctx.rotate(-4 * Math.PI / 180);
    ctx.translate(-cw / 2, -ch / 2);
    ctx.shadowColor = 'rgba(202,251,12,0.28)';
    ctx.shadowBlur = 90;
    const bg = ctx.createRadialGradient(0, 0, 0, 0, 0, cw * 1.1);
    bg.addColorStop(0, '#2a3014');
    bg.addColorStop(0.6, '#050505');
    ctx.fillStyle = bg;
    roundRect(ctx, 0, 0, cw, ch, 44);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.lineWidth = 3;
    ctx.strokeStyle = 'rgba(202,251,12,0.5)';
    ctx.stroke();

    ctx.textAlign = 'left';
    spacedText(ctx, [['THE ELITE SHOW', LIME]], 62, 100, '600 26px Montserrat, sans-serif', 5, 'left');
    spacedText(ctx, [['PREMIUM COMMUNITY', '#aaaaaa']], 62, 142, '600 26px Montserrat, sans-serif', 5, 'left');
    const chip = ctx.createLinearGradient(cw - 160, 60, cw - 62, 136);
    chip.addColorStop(0, '#d9f86a');
    chip.addColorStop(1, '#8da516');
    ctx.fillStyle = chip;
    roundRect(ctx, cw - 160, 60, 98, 76, 12);
    ctx.fill();

    const name = (member.name || 'Premium Member').toUpperCase();
    let size = 80;
    display(ctx, size);
    while (ctx.measureText(name).width > cw - 124 && size > 36) display(ctx, (size -= 4));
    ctx.fillStyle = '#f5f5f0';
    ctx.fillText(name, 62, ch - 150);

    const cells = [['MEMBER ID', member.memberCode || 'ESP-····'], ['SINCE', member.since], ['MONTHLY', '₹199']];
    cells.forEach(([label, value], index) => {
      const x = 62 + index * ((cw - 124) / 3);
      spacedText(ctx, [[label, '#aaaaaa']], x, ch - 88, '600 22px Montserrat, sans-serif', 4, 'left');
      ctx.font = '700 36px Montserrat, sans-serif';
      ctx.fillStyle = '#f5f5f0';
      ctx.fillText(value, x, ch - 44);
    });
    ctx.restore();
    ctx.textAlign = 'center';
  }

  function display(ctx, size) {
    ctx.font = `900 ${size}px Archivo, "Arial Black", sans-serif`;
    if ('fontStretch' in ctx) ctx.fontStretch = 'expanded';
  }

  // Letter-spaced text drawn piece by piece (canvas letterSpacing isn't in every browser yet).
  function spacedText(ctx, parts, x, y, font, spacing, align = 'center') {
    ctx.font = font;
    if ('fontStretch' in ctx) ctx.fontStretch = 'normal';
    const prevAlign = ctx.textAlign;
    ctx.textAlign = 'left';
    const chars = parts.flatMap(([text, color]) => [...text].map(ch => [ch, color]));
    const width = chars.reduce((sum, [ch]) => sum + ctx.measureText(ch).width + spacing, -spacing);
    let cursor = align === 'center' ? x - width / 2 : x;
    for (const [ch, color] of chars) {
      ctx.fillStyle = color;
      ctx.fillText(ch, cursor, y);
      cursor += ctx.measureText(ch).width + spacing;
    }
    ctx.textAlign = prevAlign;
  }

  function roundRect(ctx, x, y, w, h, r) {
    ctx.beginPath();
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }

  // ----- Wiring -----
  document.getElementById('shareCardImage').addEventListener('click', e => shareImage(e.currentTarget));
  document.getElementById('shareCardSave').addEventListener('click', e => saveImage(e.currentTarget));
  document.getElementById('shareCardCopy').addEventListener('click', e => copyLink(e.currentTarget));
  document.getElementById('shareMyCard').addEventListener('click', () => member && reopen());

  member = load();
  if (member && member.name) document.getElementById('shareMyCard').hidden = false;

  return { remember };
})();

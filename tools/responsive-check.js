// Screen-size check for the full site. Loads each page at phone, tablet, laptop and wide sizes
// (plus 200% zoom and large text), scrolls through so every animation plays, then reports
// anything that scrolls sideways, sticks out of the screen, gets clipped, overlaps other text,
// is too small to read or too small to tap. Saves a full-page screenshot of each size.
//
//   python3 -m http.server 8080          (in the site folder, in another terminal)
//   node tools/responsive-check.js [http://localhost:8080] [out-folder]
//
// Needs Playwright (npm i -g playwright, then npx playwright install chromium).
// Set PLAYWRIGHT_CHROMIUM to use an existing Chromium. Exits with code 1 if anything fails.

const fs = require('fs');
const path = require('path');
let playwright;
try { playwright = require('playwright'); } catch { playwright = require(process.env.PLAYWRIGHT_MODULE || 'playwright'); }

const BASE = process.argv[2] || 'http://localhost:8080';
const OUT = process.argv[3] || 'responsive-check';
const PAGES = ['index.html', 'sessions.html'];
const SIZES = [
  { name: 'phone-320', width: 320, height: 568, touch: true },
  { name: 'phone-360', width: 360, height: 780, touch: true },
  { name: 'phone-375', width: 375, height: 667, touch: true },
  { name: 'phone-390', width: 390, height: 844, touch: true },
  { name: 'phone-430', width: 430, height: 932, touch: true },
  { name: 'phone-land-568', width: 568, height: 320, touch: true },
  { name: 'phone-land-844', width: 844, height: 390, touch: true },
  { name: 'tablet-768', width: 768, height: 1024, touch: true },
  { name: 'tablet-land-1024', width: 1024, height: 768, touch: true },
  { name: 'laptop-1280', width: 1280, height: 720 },
  { name: 'desktop-1440', width: 1440, height: 900 },
  { name: 'wide-1920', width: 1920, height: 1080 },
  { name: 'wide-2560', width: 2560, height: 1440 },
  { name: 'zoom200-1280', width: 640, height: 400, scale: 2 },
  { name: 'large-text-390', width: 390, height: 844, touch: true, fontSize: 24 }
];

// Runs in the page: returns a list of problems
function inspect({ touch, root }) {
  const vw = document.documentElement.clientWidth;
  const problems = [];
  const label = el => {
    let s = el.tagName.toLowerCase();
    if (el.id) s += '#' + el.id;
    const cls = typeof el.className === 'string' ? el.className.trim().split(/\s+/).filter(Boolean).slice(0, 2) : [];
    if (cls.length) s += '.' + cls.join('.');
    const sec = el.closest('section, header, footer, nav, main, .site-menu, .join-bar, .modal-overlay');
    return s + (sec && sec !== el ? ` in ${sec.id ? '#' + sec.id : sec.className.split(' ')[0] || sec.tagName.toLowerCase()}` : '');
  };
  const style = el => getComputedStyle(el);
  const srOnly = el => {
    const r = el.getBoundingClientRect();
    return r.width <= 1 && r.height <= 1;
  };
  // Hidden, transparent, or inside something that is
  const unseen = el => {
    for (let a = el; a && a !== document.documentElement; a = a.parentElement) {
      const cs = style(a);
      if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.05) return true;
      if (a.getAttribute('aria-hidden') === 'true' && a.classList.contains('ribbon-band')) return true;
    }
    return false;
  };
  // Inside a box that deliberately clips (carousels, lanes, ribbons)
  const clippedBy = el => {
    for (let a = el.parentElement; a && a !== document.body; a = a.parentElement) {
      const cs = style(a);
      if (cs.overflowX !== 'visible' || cs.clipPath !== 'none') return a;
    }
    return null;
  };
  const hasOwnText = el => [...el.childNodes].some(n => n.nodeType === 3 && n.textContent.trim());

  if (!root && document.documentElement.scrollWidth > vw + 1) {
    problems.push(`page scrolls sideways: ${document.documentElement.scrollWidth}px wide on a ${vw}px screen`);
  }

  // the top bar should stay one tidy row: no link or button wrapping onto a second line
  const navBar = document.querySelector('nav');
  if (!root && navBar) {
    navBar.querySelectorAll('.nav-links a, .nav-cta, .nav-menu-btn').forEach(el => {
      const r = el.getBoundingClientRect();
      if (r.height && r.height > 50) problems.push(`nav item wraps onto two lines: ${el.textContent.trim()}`);
    });
  }

  const scope = root ? document.querySelector(root) : document.body;
  const all = [...scope.querySelectorAll('*')].filter(el => !unseen(el) && !srOnly(el));
  const seen = new Set();
  const once = msg => { if (!seen.has(msg)) { seen.add(msg); problems.push(msg); } };

  for (const el of all) {
    const cs = style(el);
    const r = el.getBoundingClientRect();
    if (!r.width || !r.height) continue;
    if (cs.position !== 'fixed' && (r.right > vw + 2 || r.left < -2) && !clippedBy(el)) {
      once(`sticks out of the screen: ${label(el)} (${Math.round(r.left)} to ${Math.round(r.right)})`);
    }
    if (hasOwnText(el)) {
      const clamp = cs.webkitLineClamp && cs.webkitLineClamp !== 'none';
      if (!clamp && cs.overflowX !== 'visible' && el.scrollWidth > el.clientWidth + 2) {
        once(`text cut off sideways: ${label(el)}`);
      }
      // (.verb-text opens and closes with a max-height transition, so it is skipped)
      if (!clamp && cs.overflowY !== 'visible' && el.scrollHeight > el.clientHeight + 2 && el.clientHeight > 0 && !el.matches('.verb-text')) {
        once(`text cut off at the bottom: ${label(el)}`);
      }
      const size = parseFloat(cs.fontSize);
      if (size < 11 && el.textContent.trim().length > 2 && !el.closest('.session-poster')) {
        once(`text too small (${size.toFixed(1)}px): ${label(el)}`);
      }
    }
  }

  // Lines of text that overlap other text. Uses the text's own line boxes, trimmed to whatever
  // clips them, and skips fixed bars (nav, join bar) and lines within the same heading or
  // paragraph, where tight display type is deliberate.
  const fixedAncestor = el => { for (let a = el; a; a = a.parentElement) if (style(a).position === 'fixed') return true; return false; };
  const clipRect = el => {
    let box = { left: -1e9, top: -1e9, right: 1e9, bottom: 1e9 };
    for (let a = el; a && a !== document.documentElement; a = a.parentElement) {
      const cs = style(a);
      if (cs.overflowX !== 'visible' || cs.overflowY !== 'visible' || cs.clipPath !== 'none') {
        const r = a.getBoundingClientRect();
        box = { left: Math.max(box.left, r.left), top: Math.max(box.top, r.top), right: Math.min(box.right, r.right), bottom: Math.min(box.bottom, r.bottom) };
      }
    }
    return box;
  };
  const lines = [];
  for (const el of all) {
    // (.quote-mark is one big decorative glyph whose font box is taller than its line)
    if (!hasOwnText(el) || el.matches('.quote-mark') || el.closest('.arc-card, .quote-card:not([data-depth="0"]), .ribbon-band') || (!root && fixedAncestor(el))) continue;
    const block = el.closest('h1, h2, h3, p, li, blockquote, label, a, button') || el;
    const clip = clipRect(el);
    for (const node of el.childNodes) {
      if (node.nodeType !== 3 || !node.textContent.trim()) continue;
      const range = document.createRange();
      range.selectNodeContents(node);
      for (const r of range.getClientRects()) {
        const box = { left: Math.max(r.left, clip.left), top: Math.max(r.top, clip.top), right: Math.min(r.right, clip.right), bottom: Math.min(r.bottom, clip.bottom) };
        if (box.right - box.left > 2 && box.bottom - box.top > 2) lines.push({ el, block, box });
      }
    }
  }
  for (let i = 0; i < lines.length; i++) {
    for (let j = i + 1; j < lines.length; j++) {
      const a = lines[i], b = lines[j];
      if (a.block === b.block || a.block.contains(b.block) || b.block.contains(a.block)) continue;
      const x = Math.min(a.box.right, b.box.right) - Math.max(a.box.left, b.box.left);
      const y = Math.min(a.box.bottom, b.box.bottom) - Math.max(a.box.top, b.box.top);
      if (x > 3 && y > 3) once(`text overlaps: ${label(a.el)} and ${label(b.el)}`);
    }
  }

  if (touch) {
    for (const el of all.filter(el => el.matches('a, button, [role="button"], label.choice-option, label.payment-consent'))) {
      if (el.closest('.session-poster') || style(el).position === 'fixed' && !el.closest('nav, .join-bar, .site-menu')) continue;
      const r = el.getBoundingClientRect();
      // a ::after hit pad counts toward the tap area
      const pad = getComputedStyle(el, '::after');
      const padH = pad.content !== 'none' && pad.position === 'absolute' ? -2 * parseFloat(pad.top || 0) : 0;
      if (r.height + padH < 43.5 || r.width < 43.5) once(`tap target too small (${Math.round(r.width)}×${Math.round(r.height + padH)}): ${label(el)}`);
    }
  }
  return problems;
}

(async () => {
  fs.mkdirSync(OUT, { recursive: true });
  const browser = await playwright.chromium.launch(process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {});
  const report = {};
  let failures = 0;
  for (const pageName of PAGES) {
    for (const size of SIZES) {
      const context = await browser.newContext({
        viewport: { width: size.width, height: size.height },
        deviceScaleFactor: size.scale || 1,
        isMobile: !!size.touch && size.width < 900,
        hasTouch: !!size.touch
      });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', e => errors.push(`script error: ${e.message}`));
      if (size.fontSize) {
        const cdp = await context.newCDPSession(page);
        await cdp.send('Page.enable');
        await cdp.send('Page.setFontSizes', { fontSizes: { standard: size.fontSize } });
      }
      await page.goto(`${BASE}/${pageName}`, { waitUntil: 'networkidle' }).catch(() => {});
      await page.waitForTimeout(400);
      // scroll through slowly so reveals, pins and the cube run, then check every screenful
      const problems = new Set(errors);
      const height = await page.evaluate(() => document.documentElement.scrollHeight);
      for (let y = 0; y <= height; y += Math.round(size.height * 0.7)) {
        await page.evaluate(top => window.scrollTo(0, top), y);
        await page.waitForTimeout(160);
      }
      await page.waitForTimeout(1200);
      for (let y = 0; y <= height; y += Math.round(size.height * 0.9)) {
        await page.evaluate(top => window.scrollTo(0, top), y);
        await page.waitForTimeout(90);
        (await page.evaluate(inspect, { touch: !!size.touch })).forEach(p => problems.add(p));
      }
      // the menu, where there is one
      if (await page.locator('.nav-menu-btn').isVisible().catch(() => false)) {
        await page.evaluate(() => window.scrollTo(0, 0));
        await page.click('.nav-menu-btn');
        await page.waitForTimeout(900);
        (await page.evaluate(inspect, { touch: !!size.touch, root: '.site-menu' })).forEach(p => problems.add('menu open: ' + p));
        await page.screenshot({ path: path.join(OUT, `${pageName.replace('.html', '')}-${size.name}-menu.png`) });
        await page.keyboard.press('Escape');
      }
      await page.evaluate(() => window.scrollTo(0, 0));
      await page.waitForTimeout(300);
      await page.screenshot({ path: path.join(OUT, `${pageName.replace('.html', '')}-${size.name}.png`), fullPage: true });
      report[`${pageName} @ ${size.name}`] = [...problems];
      failures += problems.size;
      console.log(`${problems.size ? '✗' : '✓'} ${pageName} @ ${size.name}${problems.size ? '' : ' — all clear'}`);
      problems.forEach(p => console.log('    ' + p));
      await context.close();
    }
  }
  await browser.close();
  fs.writeFileSync(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
  console.log(failures ? `\n${failures} problem(s) found. Screenshots in ${OUT}/` : `\nAll clear. Screenshots in ${OUT}/`);
  process.exit(failures ? 1 : 0);
})();

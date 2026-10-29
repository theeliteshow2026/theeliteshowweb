// Rebuilds the link preview images in images/share/ from tools/share_cards.html:
//   poster-wall-logo.jpg  what WhatsApp, LinkedIn and X show when the full site is shared
//   invite-logo.jpg       what they show for the /join link a Premium member shares
// Run it after adding new session posters, from the site folder:
//   node tools/make_share_cards.js
// Needs Playwright (see responsive-check.js) and Pillow (python3, for JPG compression).
// WhatsApp skips preview images over about 300 KB, so it checks the size of each file.

const fs = require('fs');
const path = require('path');
const { execFileSync } = require('child_process');
let playwright;
try { playwright = require('playwright'); } catch { playwright = require(process.env.PLAYWRIGHT_MODULE || 'playwright'); }

const ROOT = path.resolve(__dirname, '..');
const OUT = path.join(ROOT, 'images', 'share');
const CARDS = ['poster-wall-logo', 'invite-logo'];

(async () => {
  const posters = fs.readdirSync(path.join(ROOT, 'posters', 'lg'))
    .filter(name => name.endsWith('.webp')).sort().reverse().slice(0, 8)
    .map(name => name.replace(/\.webp$/, ''));
  const browser = await playwright.chromium.launch(
    process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : {});
  const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
  await page.goto('file://' + path.join(__dirname, 'share_cards.html') + '?posters=' + posters.join(','));
  await page.waitForLoadState('networkidle');
  await page.evaluate(() => document.fonts.ready);
  fs.mkdirSync(OUT, { recursive: true });
  for (const id of CARDS) {
    const png = path.join(OUT, id + '.png');
    const jpg = path.join(OUT, id + '.jpg');
    await page.locator('#' + id).screenshot({ path: png });
    execFileSync('python3', ['-c',
      'import sys;from PIL import Image;Image.open(sys.argv[1]).convert("RGB").save(sys.argv[2],quality=82,optimize=True,progressive=True)',
      png, jpg]);
    fs.unlinkSync(png);
    const kb = Math.round(fs.statSync(jpg).size / 1024);
    console.log(`${id}.jpg ${kb} KB${kb > 300 ? '  TOO BIG for WhatsApp' : ''}`);
  }
  await browser.close();
})();

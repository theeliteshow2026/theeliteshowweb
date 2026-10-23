// Checks the free poster reader (admin/poster_reader.js) against the real posters.
// The fixture holds what Tesseract read from each poster in posters/ (both passes the
// admin panel runs), so this runs in a second with no browser:
//
//   node tools/poster_reader_check.js
//
// It prints what the reader would fill in and how many fields match the real session
// (as if each poster were added the week it came out).

const path = require('path');
const fs = require('fs');
const reader = require('../admin/poster_reader.js');
const lines = require('./fixtures/poster_lines.json');
const src = fs.readFileSync(path.join(__dirname, '../mentor_sessions.js'), 'utf8');
const sessions = eval(src.match(/const MENTOR_SESSIONS = (\[[\s\S]*?\n\]);/)[1]);

let score = 0, total = 0;
for (const [file, passes] of Object.entries(lines)) {
  const real = sessions.find(s => s.poster === 'posters/' + file);
  const r = reader.parse(passes.sparse, { today: '2026-10-23', sessions: sessions.filter(s => s.date < real.date) }, passes.blocks);
  const same = (a, b) => (a || '').toLowerCase().replace(/[^a-z0-9]/g, '') === (b || '').toLowerCase().replace(/[^a-z0-9]/g, '');
  const checks = { mentor: same(r.mentor.value, real.mentor), date: r.date.value === real.date, label: same(r.label.value, real.label) };
  score += Object.values(checks).filter(Boolean).length;
  total += 3;
  console.log(`\n${file}`);
  for (const k of ['label', 'title', 'short', 'mentor', 'role', 'date', 'time', 'mode']) {
    const mark = k in checks ? (checks[k] ? '✓' : '✗') : ' ';
    console.log(`  ${mark} ${k.padEnd(7)} ${r[k].value || '—'}${r[k].confidence !== 'sure' ? `  [${r[k].confidence}]` : ''}`);
  }
}
console.log(`\nLabel, mentor and date right: ${score} of ${total}`);

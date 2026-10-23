// ===== POSTER READER =====
// Reads a session poster for free, right in the browser: Tesseract finds the text,
// then the rules below work out which line is the title, the mentor, the date and
// so on. Every field comes back with how sure it is:
//   'sure'     found clearly on the poster
//   'check'    found, but worth a look (shown yellow in the panel)
//   'default'  not on the poster, so a usual value was filled in (7:30 PM, next number)
//   'missing'  not found
(function (root) {
  const BRAND = new Set(('THE ELITE SHOW COMMUNITY PEOPLE IDEAS OPPORTUNITIES OPPORTUNITY IMPACT MPACT OF DOERS ' +
    'GLOBAL A SAME BIGGER BETTER REAL CONVERSATIONS CONVERSATION FOR BRIGHTER TOMORROW TOMORROWS LEARNING ' +
    'GROWTH BUILDING MINDS JOIN LINK IN BIO CHECK TO THE THROUGH WANT SESSION? COMMUNITY! INSIGHTS TODAY ' +
    'HEALTHIER ONLINE OFFLINE SAVE DATE REGISTER NOW FREE ENTRY AN EXCLUSIVE').split(' '));
  const BOILER = /(LINK IN BIO|JOIN THE|WANT TO JOIN|REGISTER|SCAN|FOLLOW US|BRIGHTER TOMORROW|REAL CONVERSATIONS|A GLOBAL COMMUNITY|OF DOERS)/i;
  const ROLE_WORDS = /\b(FOUNDER|CO-?FOUNDER|COFOUNDER|CEO|CTO|COO|CFO|CMO|DIRECTOR|ANALYST|ARCHITECT|TRAINER|STRATEGIST|COACH|MANAGER|AUTHOR|HEAD|LEAD|CONSULTANT|ENGINEER|DESIGNER|DEVELOPER|MENTOR|PARTNER|PRESIDENT|OFFICER|ADVISOR|ADVISER|SPECIALIST|EXPERT|INVESTOR|ENTREPRENEUR|PROFESSOR|LECTURER|DOCTOR|CREATOR|INFLUENCER|PVT|LTD|LLP|INC|MEDIA|LABS|STUDIO|SOLUTIONS|TECHNOLOGIES|SCHOOL|UNIVERSITY|COLLEGE|HOLDER|RECORDS?)\b|@|&/i;
  const LEAD_IN = /^(SPEAKER|SPEAKERS|MENTOR|MENTORS|A SESSION BY|SESSION BY|BY|HOSTED BY|GUEST|GUEST SPEAKER|TRAINER|FACILITATOR|IN CONVERSATION WITH|PRESENTED BY|LED BY|WITH)$/i;
  const LABEL = /(MENT[O0]R\s*SE\S*N|W[O0]RKSH[O0]P|C[O0]MMUNITY\s+SESS\S*N|MASTER\s*CLASS|ELITE\s+BREW|MEET\s*-?UP|PANEL\s+DISCUSSION|B[O0]{2}TCAMP|WEBINAR)\s*\(?\s*#?\s*(\d{1,3})?/i;
  const KINDS = [
    [/MENT/i, 'Mentor Session'], [/W[O0]RK/i, 'Workshop'], [/C[O0]MM/i, 'Community Session'],
    [/MASTER/i, 'Masterclass'], [/BREW/i, 'Elite Brew'], [/MEET/i, 'Meetup'], [/PANEL/i, 'Panel Discussion'],
    [/B[O0]{2}T/i, 'Bootcamp'], [/WEBINAR/i, 'Webinar']
  ];
  const MONTHS = { JAN: 1, FEB: 2, MAR: 3, APR: 4, MAY: 5, JUN: 6, JUL: 7, AUG: 8, SEP: 9, SEPT: 9, OCT: 10, NOV: 11, DEC: 12 };
  const MONTH_NAMES = ['JANUARY', 'FEBRUARY', 'MARCH', 'APRIL', 'MAY', 'JUNE', 'JULY', 'AUGUST', 'SEPTEMBER', 'OCTOBER', 'NOVEMBER', 'DECEMBER'];
  const DAYS = ['SUNDAY', 'MONDAY', 'TUESDAY', 'WEDNESDAY', 'THURSDAY', 'FRIDAY', 'SATURDAY'];
  const ACRONYMS = new Set(['AI', 'CEO', 'CTO', 'COO', 'CFO', 'CMO', 'HR', 'IT', 'UI', 'UX', 'MBA', 'IIT', 'IIM', 'NIT', 'SEO', 'B2B', 'D2C', 'PR', 'VC', 'USA', 'UK', 'UAE', 'ML', 'AR', 'VR', 'IPO', 'GST', 'CA', 'MD', 'KP', 'TT', 'CP', 'PM', 'EX']);
  const SMALL = new Set(['a', 'an', 'and', 'as', 'at', 'by', 'for', 'in', 'into', 'of', 'on', 'or', 'the', 'to', 'vs', 'with', 'from']);

  function lev(a, b) {
    const row = Array.from({ length: b.length + 1 }, (_, i) => i);
    for (let i = 1; i <= a.length; i++) {
      let prev = row[0];
      row[0] = i;
      for (let j = 1; j <= b.length; j++) {
        const keep = row[j];
        row[j] = Math.min(row[j] + 1, row[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1));
        prev = keep;
      }
    }
    return row[b.length];
  }

  const letters = s => (s.match(/[A-Za-z]/g) || []).length;
  const isCaps = s => letters(s) > 0 && s === s.toUpperCase();

  function clean(text) {
    return text
      .replace(/[|]/g, ' | ')
      .replace(/^[\s|=\-—_»«>•·.,:;()[\]{}]+/, '')
      .replace(/[\s|=\-—_»«>•·,;([{]+$/, '')
      .replace(/\s+/g, ' ')
      .trim();
  }

  // Fixes the usual OCR slips: "Al" for AI, a zero inside a word
  function fixWords(text) {
    return text
      .replace(/\bA[l1I]\b/g, 'AI')
      .replace(/\b([A-Za-z]+)0([A-Za-z]*)\b/g, '$1O$2')
      .replace(/\b0([A-Za-z]{2,})\b/g, 'O$1')
      .replace(/\b([A-Za-z])0\b/g, '$1O');
  }

  // Title Case for ALL CAPS text, keeping acronyms and short initials (KP, TT) as they are
  function niceCase(text, { name = false } = {}) {
    if (!isCaps(text)) return text;
    return text.split(' ').map((word, i) => {
      const bare = word.replace(/[^A-Z0-9]/g, '');
      if (ACRONYMS.has(bare) || (name && bare.length <= 2)) return word;
      const lower = word.toLowerCase();
      if (!name && i > 0 && SMALL.has(lower)) return lower;
      return lower.replace(/(^|[-'(])([a-z])/g, (m, p, c) => p + c.toUpperCase());
    }).join(' ');
  }

  function isBrand(text) {
    if (BOILER.test(text)) return true;
    const words = text.toUpperCase().replace(/[^A-Z0-9?!& ]/g, ' ').split(/\s+/).filter(Boolean);
    return words.length > 0 && words.every(w => BRAND.has(w) || w.length < 2);
  }

  function monthOf(token) {
    const t = token.toUpperCase().replace(/0/g, 'O').replace(/[^A-Z]/g, '');
    if (t.length < 3) return 0;
    for (const [abbr, n] of Object.entries(MONTHS)) if (t === abbr) return n;
    for (let i = 0; i < 12; i++) if (t === MONTH_NAMES[i] || (t.length >= 5 && lev(t, MONTH_NAMES[i]) <= 1)) return i + 1;
    if (t.length <= 5) for (const [abbr, n] of Object.entries(MONTHS)) if (lev(t, abbr) <= 1 && t[0] === abbr[0]) return n;
    return 0;
  }

  const iso = (y, m, d) => `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;
  const dayOfWeek = isoDate => new Date(isoDate + 'T00:00:00Z').getUTCDay();

  // A month and day with no year: pick the year that puts it closest to today, leaning to the future
  function withYear(m, d, today) {
    const now = Date.parse(today + 'T00:00:00Z');
    const y = Number(today.slice(0, 4));
    let best = null, bestScore = Infinity;
    for (const year of [y - 1, y, y + 1]) {
      const t = Date.UTC(year, m - 1, d);
      if (new Date(t).getUTCDate() !== d) continue;
      const days = (t - now) / 864e5;
      const score = days >= -3 ? days : -days * 2;
      if (score < bestScore) { bestScore = score; best = iso(year, m, d); }
    }
    return best;
  }

  function findDate(lines, today) {
    const text = lines.map(l => l.text).join('\n').toUpperCase();
    const weekday = DAYS.findIndex(d => new RegExp('\\b' + d + '\\b').test(text));
    let found = null;
    // 19/09/2026, 19.09.26, 19-09-2026
    const numeric = text.match(/\b(\d{1,2})[./-](\d{1,2})[./-](\d{2,4})\b/);
    if (numeric) {
      const [d, m] = [Number(numeric[1]), Number(numeric[2])];
      let y = Number(numeric[3]);
      if (y < 100) y += 2000;
      if (m >= 1 && m <= 12 && d >= 1 && d <= 31) found = { date: iso(y, m, d), year: true };
    }
    if (!found) {
      const tokens = text
        .replace(/\b\d{1,2}\s*[:.]\s*\d{2}\s*(A\.?M\.?|P\.?M\.?)?/g, ' ')
        .replace(/\b\d{1,2}\s*(AM|PM)\b/g, ' ')
        .replace(/(\d)(ST|ND|RD|TH)\b/g, '$1')
        .replace(/([A-Z])(\d)/g, '$1 $2')
        .split(/[^A-Z0-9]+/).filter(Boolean);
      for (let i = 0; i < tokens.length && !found; i++) {
        const m = monthOf(tokens[i]);
        if (!m) continue;
        const after = tokens[i + 1], before = tokens[i - 1] === 'OF' ? tokens[i - 2] : tokens[i - 1];
        const day = [after, before].map(Number).find(n => n >= 1 && n <= 31);
        if (!day) continue;
        const yearToken = [tokens[i + 2], tokens[i + 1]].find(t => /^20\d\d$/.test(t || ''));
        found = yearToken ? { date: iso(Number(yearToken), m, day), year: true } : { date: withYear(m, day, today), year: false };
      }
    }
    if (!found || !found.date) return { value: '', confidence: 'missing', weekday };
    // Sure only when the poster also gives the year or a weekday that agrees
    const agrees = weekday >= 0 && dayOfWeek(found.date) === weekday;
    return { value: found.date, confidence: found.year || agrees ? 'sure' : 'check', weekday };
  }

  function findTime(lines) {
    const text = lines.map(l => l.text).join(' ').toUpperCase();
    // 7:30 PM, 7.30PM, 7 PM; a time with AM/PM beats a bare one
    // (not a date like 19.09.2026, and a colon beats a dot)
    const all = [...text.matchAll(/\b(\d{1,2})(?:\s*:\s*|\.)(\d{2})(?![./-]?\d)\s*(A\.?M\.?|P\.?M\.?)?/g)];
    const m = all.find(x => x[3]) || text.match(/\b(\d{1,2})\s*(A\.?M\.?|P\.?M\.?)\b/) || all.find(x => x[0].includes(':')) || all[0];
    if (!m) return { value: '19:30', confidence: 'default' };
    let h = Number(m[1]);
    const min = m[3] !== undefined || /:|\./.test(m[0]) ? Number(m[2]) || 0 : 0;
    const marker = (m[3] || (m[2] && /[AP]/.test(m[2]) ? m[2] : '') || (/\bPM\b/.test(text) ? 'PM' : /\bAM\b/.test(text) ? 'AM' : '')).replace(/\./g, '');
    if (h > 23 || min > 59) return { value: '19:30', confidence: 'default' };
    // Sessions run in the evening, so a bare 7:30 means 7:30 PM
    if (marker === 'PM' && h < 12) h += 12;
    else if (!marker && h >= 1 && h <= 11) h += 12;
    if (marker === 'AM' && h === 12) h = 0;
    return { value: `${String(h).padStart(2, '0')}:${String(min).padStart(2, '0')}`, confidence: marker ? 'sure' : 'check' };
  }

  function findLabel(lines, ctx) {
    for (const line of lines) {
      const m = line.text.match(LABEL);
      if (!m) continue;
      const kind = (KINDS.find(([re]) => re.test(m[1])) || [, 'Mentor Session'])[1];
      let number = m[2] ? Number(m[2]) : null;
      let numberConfidence = number ? 'sure' : 'missing';
      if (!number && kind !== 'Community Session' && kind !== 'Elite Brew') {
        const last = (ctx.sessions || []).filter(s => (s.label || '').startsWith(kind) && s.number).map(s => s.number);
        if (last.length) { number = Math.max(...last) + 1; numberConfidence = 'default'; }
      }
      return { kind, number, confidence: 'sure', numberConfidence, line };
    }
    return { kind: 'Mentor Session', number: null, confidence: 'missing', numberConfidence: 'missing', line: null };
  }

  function nameLike(text) {
    const words = text.split(' ');
    if (words.length < 1 || words.length > 5 || text.length > 36 || letters(text) < 3) return false;
    if (isBrand(text) || ROLE_WORDS.test(text) || LABEL.test(text) || LEAD_IN.test(text)) return false;
    if (/\d|[?!:,]/.test(text) || words.some(w => monthOf(w) && w.length <= 4)) return false;
    return words.every(w => /^[A-Za-z][A-Za-z.'-]*$/.test(w));
  }

  function tidyName(text) {
    return niceCase(text.replace(/^(MR|MRS|MS|MISS|SHRI)\.?\s+/i, '').replace(/([a-z])([A-Z]{2,})\b/g, '$1 $2'), { name: true });
  }

  const squash = s => s.toLowerCase().replace(/[^a-z]/g, '');

  // A mentor we already know, spotted anywhere on the poster (allowing one wrong letter)
  function knownMentor(lines, mentors) {
    const all = squash(lines.map(l => l.text).join(' '));
    let best = null;
    for (const mentor of mentors || []) {
      const key = squash(mentor.name);
      if (key.length < 5) continue;
      let hit = all.includes(key);
      if (!hit && key.length >= 8) {
        for (let i = 0; i + key.length <= all.length && !hit; i++) hit = lev(all.substr(i, key.length), key) <= 1;
      }
      if (hit && (!best || key.length > squash(best.name).length)) best = mentor;
    }
    return best;
  }

  function findMentor(lines, ctx) {
    const known = knownMentor(lines, ctx.mentors);
    // Where the mentor's name sits: after a lead-in like SPEAKER, or just above their role
    let index = lines.findIndex((l, i) => LEAD_IN.test(l.text) && lines[i + 1] && nameLike(lines[i + 1].text));
    if (index >= 0) index += 1;
    else {
      // The nearest line above a role line, in the same column and not much bigger than it
      const overlaps = (a, b) => a.x0 == null || b.x0 == null || Math.min(a.x1, b.x1) - Math.max(a.x0, b.x0) > 0;
      const nameAbove = role => {
        const i = lines.indexOf(role);
        for (let j = i - 1; j >= 0 && role.y - lines[j].y < role.height * 8; j--) {
          if (!overlaps(lines[j], role)) continue;
          return nameLike(lines[j].text) && lines[j].height <= role.height * 4.2 && lines[j].height >= role.height * 0.8 ? j : -1;
        }
        return -1;
      };
      const role = lines.find(l => ROLE_WORDS.test(l.text) && !isBrand(l.text) && nameAbove(l) >= 0);
      if (role) {
        index = nameAbove(role);
        // A name split over two lines in the same size (MUHAMMED / MAZIN KP)
        const above = lines[index - 1];
        if (above && nameLike(above.text) && overlaps(above, lines[index]) && Math.abs(above.height - lines[index].height) <= lines[index].height * 0.15) index -= 1;
      }
    }
    let nameLines = [];
    if (index >= 0) {
      nameLines = [lines[index]];
      const next = lines[index + 1];
      if (next && nameLike(next.text) && Math.abs(next.height - lines[index].height) <= lines[index].height * 0.15) nameLines.push(next);
    }
    const read = nameLines.length ? tidyName(nameLines.map(l => l.text).join(' ')) : '';
    // Role: the lines straight after the name that read like a job or a company
    const roleLines = [];
    const start = nameLines.length ? lines.indexOf(nameLines[nameLines.length - 1]) + 1 : -1;
    if (start > 0) {
      const nameLine = nameLines[nameLines.length - 1];
      for (let i = start; i < lines.length && roleLines.length < 3; i++) {
        if (nameLine.x0 != null && lines[i].x0 != null && Math.min(nameLine.x1, lines[i].x1) - Math.max(nameLine.x0, lines[i].x0) <= 0) continue;
        const t = lines[i].text;
        if (/\b(ONLINE|OFFLINE|VENUE|SATURDAY|SUNDAY)\b/i.test(t) || lines[i].conf < 70) break;
        if (isBrand(t) || LABEL.test(t) || nameLike(t) && !ROLE_WORDS.test(t)) break;
        if (ROLE_WORDS.test(t) || roleLines.length) {
          if (/\d{1,2}\s*[:.]\s*\d{2}/.test(t) || findDateIn(t)) break;
          roleLines.push(t);
        } else break;
      }
    }
    const roleRead = roleLines
      .map(t => niceCase(fixWords(t)).replace(/\s*[|@]\s*/g, ', ').replace(/\s+,/g, ','))
      .join(', ')
      .replace(/,\s*,/g, ',')
      .replace(/^,\s*|,\s*$/g, '')
      .replace(/&\s*$/, '')
      .trim();

    if (known) {
      return {
        mentor: { value: known.name, confidence: 'sure', returning: true },
        role: { value: known.role || roleRead, confidence: known.role ? 'sure' : roleRead ? 'check' : 'missing' },
        used: nameLines.concat(roleLines.map(t => lines.find(l => l.text === t)))
      };
    }
    return {
      mentor: { value: read, confidence: read ? (nameLines.every(l => l.conf >= 80) ? 'sure' : 'check') : 'missing', returning: false },
      role: { value: roleRead, confidence: roleRead ? 'check' : 'missing' },
      used: nameLines.concat(roleLines.map(t => lines.find(l => l.text === t)))
    };
  }

  function findDateIn(text) {
    return text.split(/[^A-Za-z0-9]+/).some(t => monthOf(t)) && /\d/.test(text);
  }

  function findTitle(lines, skip) {
    const pool = lines.filter(l => !skip.has(l) && !isBrand(l.text) && !LABEL.test(l.text) && !LEAD_IN.test(l.text) &&
      letters(l.text) >= 2 && !/\b\d{1,2}\s*[:.]\s*\d{2}\b/.test(l.text) && !findDateIn(l.text) && !/^(AM|PM|SATURDAY|SUNDAY)$/i.test(l.text));
    if (!pool.length) return { value: '', confidence: 'missing' };
    const confident = pool.filter(l => l.conf >= 80);
    const tallest = (confident.length ? confident : pool).reduce((a, b) => (b.height > a.height ? b : a));
    const H = tallest.height;
    // The headline: the big lines around the tallest one, in reading order
    const big = pool.filter(l => l.height >= H * 0.45 && l.conf >= 50 && letters(l.text) >= 2);
    const order = big.sort((a, b) => a.y - b.y);
    let head = [tallest];
    let i = order.indexOf(tallest);
    for (let j = i - 1; j >= 0 && tallest.y - order[j].y < H * 4.5; j--) head.unshift(order[j]);
    for (let j = i + 1; j < order.length && order[j].y - head[head.length - 1].y < H * 2.6; j++) head.push(order[j]);
    head = head.filter(l => letters(l.text) >= 2);
    // A smaller line straight under the headline is its second half ("Where are we heading?")
    const bottom = head[head.length - 1];
    const sub = pool
      .filter(l => !head.includes(l) && l.height >= H * 0.22 && l.height < H * 0.45 && l.y > bottom.y && l.y - bottom.y < bottom.height * 2.4 && l.conf >= 70)
      .sort((a, b) => a.y - b.y);
    const subLines = [];
    for (const l of sub) {
      if (subLines.length && l.y - subLines[subLines.length - 1].y > l.height * 2.2) break;
      if (subLines.length < 2) subLines.push(l);
    }
    let title = niceCase(fixWords(head.map(l => l.text).join(' ')));
    if (subLines.length) {
      const rest = niceCase(fixWords(subLines.map(l => l.text).join(' ')));
      title = /[:?]$/.test(title) ? `${title} ${rest}` : `${title}: ${rest}`;
    }
    title = title.replace(/\s+([:?!,])/g, '$1').replace(/[\s:,-]+$/, '').replace(/\s{2,}/g, ' ');
    if (title && title[0] === title[0].toLowerCase()) title = title[0].toUpperCase() + title.slice(1);
    // Poster headlines mix logos and decorations into the text, so a title is always worth a look
    return { value: title, confidence: 'check', used: head.concat(subLines) };
  }

  // Up to three short card titles made from the full title
  function shortTitles(title) {
    if (!title) return [];
    const out = [];
    const add = s => {
      s = s.replace(/[\s:,?!.-]+$/, '').trim();
      if (s && s.split(' ').length <= 6 && s.length <= 34 && !out.includes(s)) out.push(s);
    };
    const [main] = title.split(/:\s*/);
    add(main);
    add(main.replace(/^(How to|How|Why|What|The|A|An)\s+/i, '').replace(/^\w/, c => c.toUpperCase()));
    add(main.split(' ').slice(0, 4).join(' '));
    add(title.replace(/\?.*$/, '').split(' ').slice(0, 3).join(' '));
    return out.slice(0, 3);
  }

  function tidyLines(raw, minConf = 45) {
    return (raw || [])
      .map(l => ({ ...l, text: fixWords(clean(l.text || '')) }))
      .filter(l => l.text && letters(l.text) + (l.text.match(/\d/g) || []).length >= 2 && (l.conf == null || l.conf >= minConf))
      .map(l => ({ ...l, conf: l.conf == null ? 90 : l.conf }))
      .sort((a, b) => a.y - b.y);
  }

  // Works out the session from the poster's text lines: [{ text, height, conf, y, x0, x1 }].
  // `blockLines` are an optional second reading of the poster as paragraphs, which catches
  // dates and times that the line-by-line reading can miss.
  function parse(rawLines, ctx = {}, blockLines = []) {
    const today = ctx.today || new Date().toISOString().slice(0, 10);
    const lines = tidyLines(rawLines);
    // Dates and times are short and often on busy strips, so a less sure reading still counts there
    const blocks = tidyLines(blockLines, 30);
    const both = lines.concat(blocks);

    let label = findLabel(lines, ctx);
    if (label.confidence === 'missing' || label.numberConfidence !== 'sure') {
      const other = findLabel(blocks, ctx);
      if (other.confidence === 'sure' && (label.confidence === 'missing' || other.numberConfidence === 'sure')) label = { ...other, line: label.line };
    }
    let date = findDate(lines, today);
    if (date.confidence === 'missing') date = findDate(both, today);
    let time = findTime(lines);
    if (time.confidence !== 'sure') {
      const other = findTime(blocks);
      if (other.confidence === 'sure' || time.confidence === 'default') time = other;
    }
    const who = findMentor(lines, ctx);
    const skip = new Set([label.line, ...who.used].filter(Boolean));
    const title = findTitle(lines, skip);
    const text = both.map(l => l.text).join(' ').toUpperCase();
    const mode = /\bONLINE\b|\bZOOM\b|GOOGLE MEET|\bLIVE ON\b/.test(text) ? 'online'
      : /\bVENUE\b|\bOFFLINE\b|\bAT\s+[A-Z]/.test(text) ? 'offline' : '';
    const venueLine = lines.findIndex(l => /^VENUE\b/i.test(l.text));
    const venue = venueLine >= 0 ? (lines[venueLine].text.replace(/^VENUE\s*[:-]?\s*/i, '') || (lines[venueLine + 1] || {}).text || '') : '';
    const role = who.role.value;
    const label_ = label.number ? `${label.kind} #${String(label.number).padStart(2, '0')}` : label.kind;
    return {
      kind: { value: label.kind, confidence: label.confidence === 'missing' ? 'check' : 'sure' },
      number: { value: label.number, confidence: label.numberConfidence },
      label: { value: label_, confidence: label.confidence === 'sure' && label.numberConfidence !== 'default' ? 'sure' : 'check' },
      title,
      short: { value: shortTitles(title.value)[0] || '', confidence: title.value ? 'check' : 'missing', options: shortTitles(title.value) },
      mentor: who.mentor,
      role: who.role,
      summary: { value: role ? role.replace(/\.?$/, '.') : '', confidence: role ? who.role.confidence : 'missing' },
      date,
      time,
      mode: { value: mode, confidence: mode ? 'sure' : 'missing' },
      venue: { value: venue, confidence: venue ? 'check' : 'missing' },
      text: lines.map(l => l.text).join('\n')
    };
  }

  // ----- In the browser: read an image -----
  let workerPromise = null;
  let reportProgress = null; // the current read's progress callback
  function getWorker() {
    if (!workerPromise) {
      const base = new URL('../vendor/tesseract/', scriptBase || location.href).href;
      workerPromise = root.Tesseract.createWorker('eng', 1, {
        workerPath: base + 'worker.min.js',
        corePath: base,
        langPath: base.replace(/\/$/, ''),
        gzip: true,
        logger: m => reportProgress && reportProgress(m)
      });
    }
    return workerPromise;
  }
  const scriptBase = typeof document !== 'undefined' && document.currentScript ? document.currentScript.src : '';

  // Doubles the poster's size in grey with the contrast stretched, which Tesseract reads far better
  function prepare(image) {
    const scale = Math.min(2, 2400 / Math.max(image.naturalWidth || image.width, image.naturalHeight || image.height));
    const canvas = document.createElement('canvas');
    canvas.width = Math.round((image.naturalWidth || image.width) * scale);
    canvas.height = Math.round((image.naturalHeight || image.height) * scale);
    const g = canvas.getContext('2d', { willReadFrequently: true });
    g.imageSmoothingQuality = 'high';
    g.drawImage(image, 0, 0, canvas.width, canvas.height);
    const px = g.getImageData(0, 0, canvas.width, canvas.height);
    const d = px.data;
    const hist = new Uint32Array(256);
    for (let i = 0; i < d.length; i += 4) {
      const v = (d[i] * 299 + d[i + 1] * 587 + d[i + 2] * 114) / 1000 | 0;
      d[i] = v;
      hist[v]++;
    }
    const total = d.length / 4;
    let lo = 0, hi = 255, acc = 0;
    while (lo < 255 && (acc += hist[lo]) < total * 0.01) lo++;
    acc = 0;
    while (hi > 0 && (acc += hist[hi]) < total * 0.01) hi--;
    const span = Math.max(1, hi - lo);
    for (let i = 0; i < d.length; i += 4) {
      const v = Math.max(0, Math.min(255, ((d[i] - lo) * 255) / span));
      d[i] = d[i + 1] = d[i + 2] = v;
    }
    g.putImageData(px, 0, 0);
    return canvas;
  }

  const toLines = data => (data.lines || []).map(l => ({
    text: l.text, height: l.bbox.y1 - l.bbox.y0, conf: l.confidence, y: l.bbox.y0, x0: l.bbox.x0, x1: l.bbox.x1
  }));

  async function read(image, ctx = {}, onProgress) {
    reportProgress = onProgress;
    const worker = await getWorker();
    const canvas = prepare(image);
    await worker.setParameters({ tessedit_pageseg_mode: '11' });
    const sparse = await worker.recognize(canvas);
    // The untouched poster, read as paragraphs, is better at the small date and time strip
    await worker.setParameters({ tessedit_pageseg_mode: '3' });
    const blocks = await worker.recognize(image);
    return parse(toLines(sparse.data), ctx, toLines(blocks.data));
  }

  const api = { parse, read, shortTitles, niceCase, scriptBase };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else root.PosterReader = api;
})(typeof window !== 'undefined' ? window : globalThis);

/* Launch day countdown: 31 Oct 2026, India time only.
   Tap to start (browsers only allow sound after a tap), 5-4-3-2-1,
   then a blast that clears to the live site. Sounds are made in the
   browser with Web Audio, no audio files.
   Shows once per visitor. Switches itself off at midnight IST.
   Preview any day with ?countdown=1 (ignores the once-per-visitor memory).
   Safe to delete after launch day: this file, launch_countdown.css and
   the one <script> line in index.html. */
(function () {
  'use strict';

  var START = Date.UTC(2026, 9, 30, 18, 30); // 31 Oct 2026 00:00 IST
  var END = Date.UTC(2026, 9, 31, 18, 30);   // 1 Nov 2026 00:00 IST
  var SEEN_KEY = 'tes_launch_countdown_2026';
  var COUNT = 5;

  /* ---------- Sound: everything is scheduled from one start time ---------- */
  function noiseBuffer(ac, seconds) {
    var len = Math.floor(ac.sampleRate * seconds);
    var buf = ac.createBuffer(1, len, ac.sampleRate);
    var d = buf.getChannelData(0);
    var seed = 12345;
    for (var i = 0; i < len; i++) {
      seed = (seed * 1103515245 + 12345) & 0x7fffffff;
      d[i] = (seed / 0x7fffffff) * 2 - 1;
    }
    return buf;
  }

  function env(g, t, a, peak, hold, rel) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.setValueAtTime(peak, t + a + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + hold + rel);
  }

  function tick(ac, out, t, i) {
    // Low thump + bright click, pitch rising with each number.
    var o = ac.createOscillator(), g = ac.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(140 + i * 12, t);
    o.frequency.exponentialRampToValueAtTime(45, t + 0.28);
    env(g, t, 0.005, 0.9, 0.02, 0.32);
    o.connect(g).connect(out); o.start(t); o.stop(t + 0.4);

    var c = ac.createOscillator(), cg = ac.createGain();
    c.type = 'square';
    c.frequency.setValueAtTime(1300 + i * 160, t);
    env(cg, t, 0.002, 0.12, 0.0, 0.07);
    c.connect(cg).connect(out); c.start(t); c.stop(t + 0.1);
  }

  function riser(ac, out, t, len, nb) {
    var n = ac.createBufferSource(); n.buffer = nb;
    var f = ac.createBiquadFilter(); f.type = 'bandpass'; f.Q.value = 1.2;
    f.frequency.setValueAtTime(250, t);
    f.frequency.exponentialRampToValueAtTime(5000, t + len);
    var g = ac.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.32, t + len - 0.05);
    g.gain.exponentialRampToValueAtTime(0.0001, t + len + 0.05);
    n.connect(f).connect(g).connect(out); n.start(t); n.stop(t + len + 0.1);

    var o = ac.createOscillator(), og = ac.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(70, t);
    o.frequency.exponentialRampToValueAtTime(420, t + len);
    var lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900;
    og.gain.setValueAtTime(0.0001, t);
    og.gain.exponentialRampToValueAtTime(0.12, t + len - 0.05);
    og.gain.exponentialRampToValueAtTime(0.0001, t + len + 0.03);
    o.connect(lp).connect(og).connect(out); o.start(t); o.stop(t + len + 0.1);
  }

  function boom(ac, out, t, nb) {
    // Sub drop.
    var o = ac.createOscillator(), g = ac.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(120, t);
    o.frequency.exponentialRampToValueAtTime(28, t + 1.4);
    env(g, t, 0.004, 1.0, 0.08, 1.6);
    o.connect(g).connect(out); o.start(t); o.stop(t + 1.9);
    // Explosion body.
    var n = ac.createBufferSource(); n.buffer = nb;
    var f = ac.createBiquadFilter(); f.type = 'lowpass';
    f.frequency.setValueAtTime(4000, t);
    f.frequency.exponentialRampToValueAtTime(140, t + 1.8);
    var ng = ac.createGain();
    env(ng, t, 0.003, 0.9, 0.05, 2.0);
    n.connect(f).connect(ng).connect(out); n.start(t); n.stop(t + 2.2);
    // Crack on top.
    var c = ac.createBufferSource(); c.buffer = nb;
    var hp = ac.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 2500;
    var cg = ac.createGain();
    env(cg, t, 0.001, 0.5, 0.0, 0.18);
    c.connect(hp).connect(cg).connect(out); c.start(t, 0.5); c.stop(t + 0.3);
  }

  function cheer(ac, out, t, nb) {
    // A crowd: several bands of noise that swell and flutter.
    var bands = [520, 900, 1400, 2100, 3000];
    bands.forEach(function (fr, k) {
      var n = ac.createBufferSource(); n.buffer = nb; n.loop = true;
      var f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = fr; f.Q.value = 1.4;
      var g = ac.createGain();
      var lfo = ac.createOscillator(), lg = ac.createGain();
      lfo.frequency.value = 5 + k * 1.7; lg.gain.value = 0.05;
      lfo.connect(lg).connect(g.gain);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.13, t + 0.35);
      g.gain.setValueAtTime(0.13, t + 1.2);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 3.4);
      n.connect(f).connect(g).connect(out);
      n.start(t, k * 0.37); n.stop(t + 3.5); lfo.start(t); lfo.stop(t + 3.5);
    });
    // Two whistles.
    [[0.25, 1800, 2700], [0.7, 2100, 3100]].forEach(function (w) {
      var o = ac.createOscillator(), g = ac.createGain(), s = t + w[0];
      o.type = 'sine';
      o.frequency.setValueAtTime(w[1], s);
      o.frequency.exponentialRampToValueAtTime(w[2], s + 0.25);
      o.frequency.exponentialRampToValueAtTime(w[1] * 1.1, s + 0.55);
      env(g, s, 0.03, 0.05, 0.4, 0.15);
      o.connect(g).connect(out); o.start(s); o.stop(s + 0.7);
    });
  }

  // The whole soundtrack, from t0 (countdown start). Also used to render the preview video's audio.
  function scheduleAll(ac, out, t0) {
    var nb = noiseBuffer(ac, 4);
    riser(ac, out, t0, COUNT, nb);
    for (var i = 0; i < COUNT; i++) tick(ac, out, t0 + i, i);
    boom(ac, out, t0 + COUNT, nb);
    cheer(ac, out, t0 + COUNT + 0.15, nb);
  }
  window.TESLaunchSound = { scheduleAll: scheduleAll, count: COUNT };

  /* ---------- Should it show? ---------- */
  var params = new URLSearchParams(location.search);
  var forced = params.get('countdown') === '1';
  var now = Date.now();
  if (!forced && (now < START || now >= END)) return;
  if (!forced) {
    try { if (localStorage.getItem(SEEN_KEY)) return; } catch (e) { /* show anyway */ }
  }

  var root = document.documentElement;
  root.classList.add('lcd-on');
  var link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = 'launch_countdown.css';
  document.head.appendChild(link);

  var reduce = window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches;

  function markSeen() {
    try { localStorage.setItem(SEEN_KEY, String(Date.now())); } catch (e) {}
  }

  function mount() {
    var wrap = document.createElement('div');
    wrap.className = 'lcd';
    wrap.setAttribute('role', 'dialog');
    wrap.setAttribute('aria-modal', 'true');
    wrap.setAttribute('aria-label', 'Launch day countdown for The Elite Show Community');
    wrap.innerHTML =
      '<div class="lcd-bg" aria-hidden="true"></div>' +
      '<div class="lcd-start">' +
        '<img class="lcd-logo" src="images/logo/tes-mark.svg" alt="The Elite Show">' +
        '<div class="lcd-kicker">Launch day &middot; 31 Oct 2026</div>' +
        '<div class="lcd-title">THE ELITE SHOW<br>COMMUNITY</div>' +
        '<button type="button" class="lcd-go">Start the countdown <span aria-hidden="true">🔊</span></button>' +
        '<div class="lcd-hint">Sound on for the full effect</div>' +
      '</div>' +
      '<div class="lcd-stage" aria-live="assertive">' +
        '<svg class="lcd-ring" viewBox="0 0 200 200" aria-hidden="true"><circle cx="100" cy="100" r="92"/><circle class="lcd-ring-fg" cx="100" cy="100" r="92"/></svg>' +
        '<div class="lcd-num"></div>' +
      '</div>' +
      '<div class="lcd-live" aria-hidden="true"><div class="lcd-live-k">The Elite Show Community</div><div class="lcd-live-t">WE&rsquo;RE LIVE</div></div>' +
      '<canvas class="lcd-canvas" aria-hidden="true"></canvas>' +
      '<div class="lcd-flash" aria-hidden="true"></div>' +
      '<button type="button" class="lcd-mute" aria-pressed="false" aria-label="Mute">🔊</button>' +
      '<button type="button" class="lcd-skip">Skip &rsaquo;</button>';
    document.body.appendChild(wrap);
    root.classList.add('lcd-mounted');

    var goBtn = wrap.querySelector('.lcd-go');
    var skipBtn = wrap.querySelector('.lcd-skip');
    var muteBtn = wrap.querySelector('.lcd-mute');
    var num = wrap.querySelector('.lcd-num');
    var ringFg = wrap.querySelector('.lcd-ring-fg');
    var canvas = wrap.querySelector('canvas');
    var ctx = canvas.getContext('2d');

    var timers = [];
    var ac = null, master = null, muted = false, started = false, finished = false;
    function later(f, ms) { timers.push(setTimeout(f, ms)); }

    function cleanup() {
      finished = true;
      timers.forEach(clearTimeout);
      document.removeEventListener('keydown', onKey);
      window.removeEventListener('resize', size);
      wrap.remove();
      root.classList.remove('lcd-on', 'lcd-mounted');
      if (ac) setTimeout(function () { try { ac.close(); } catch (e) {} }, 4000);
    }

    function skip() {
      if (finished) return;
      markSeen();
      if (master) { try { master.gain.setTargetAtTime(0, ac.currentTime, 0.05); } catch (e) {} }
      wrap.classList.add('lcd-fade');
      setTimeout(cleanup, 450);
    }
    function onKey(e) { if (e.key === 'Escape') skip(); }

    function setMute(m) {
      muted = m;
      muteBtn.textContent = m ? '🔇' : '🔊';
      muteBtn.setAttribute('aria-pressed', String(m));
      muteBtn.setAttribute('aria-label', m ? 'Unmute' : 'Mute');
      if (master) master.gain.setTargetAtTime(m ? 0 : 0.9, ac.currentTime, 0.02);
    }

    /* ---------- Blast particles ---------- */
    var W = 0, H = 0, DPR = 1, parts = [], rings = [];
    function size() {
      DPR = Math.min(window.devicePixelRatio || 1, 2);
      W = window.innerWidth; H = window.innerHeight;
      canvas.width = Math.round(W * DPR); canvas.height = Math.round(H * DPR);
      ctx.setTransform(DPR, 0, 0, DPR, 0, 0);
    }
    size();
    window.addEventListener('resize', size);

    function blastParticles() {
      var cx = W / 2, cy = H / 2, big = Math.max(W, H);
      var n = reduce ? 40 : (W < 700 ? 150 : 240);
      for (var i = 0; i < n; i++) {
        var a = Math.random() * Math.PI * 2;
        var sp = (0.35 + Math.pow(Math.random(), 0.6)) * big * 1.25;
        var kind = Math.random() < 0.16 ? 'dollar' : (Math.random() < 0.5 ? 'spark' : 'chip');
        parts.push({
          x: cx, y: cy, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp - big * 0.15,
          life: 1.4 + Math.random() * 1.2, age: 0, kind: kind,
          size: kind === 'dollar' ? 18 + Math.random() * 30 : 3 + Math.random() * 6,
          rot: Math.random() * 6, vr: (Math.random() - 0.5) * 12,
          col: Math.random() < 0.72 ? '#CAFB0C' : (Math.random() < 0.5 ? '#ffffff' : '#e8ff8a')
        });
      }
      rings.push({ r: 10, a: 1, w: 26 }, { r: 0, a: 0.7, w: 10, delay: 0.08 });
    }

    var last = 0;
    function draw(ts) {
      if (finished) return;
      var dt = last ? Math.min(0.05, (ts - last) / 1000) : 0.016;
      last = ts;
      ctx.clearRect(0, 0, W, H);
      var cx = W / 2, cy = H / 2, big = Math.max(W, H);
      rings.forEach(function (r) {
        if (r.delay > 0) { r.delay -= dt; return; }
        r.r += big * 1.6 * dt; r.a -= 1.1 * dt;
        if (r.a <= 0) return;
        ctx.beginPath(); ctx.arc(cx, cy, r.r, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(202,251,12,' + r.a + ')'; ctx.lineWidth = r.w * r.a + 1;
        ctx.shadowColor = '#CAFB0C'; ctx.shadowBlur = 30;
        ctx.stroke(); ctx.shadowBlur = 0;
      });
      parts.forEach(function (p) {
        p.age += dt;
        if (p.age > p.life) return;
        var drag = Math.pow(0.18, dt);
        p.vx *= drag; p.vy = p.vy * drag + big * 0.55 * dt;
        p.x += p.vx * dt; p.y += p.vy * dt; p.rot += p.vr * dt;
        var al = Math.max(0, 1 - p.age / p.life);
        ctx.globalAlpha = al;
        ctx.fillStyle = p.col; ctx.strokeStyle = p.col;
        if (p.kind === 'spark') {
          ctx.lineWidth = Math.max(1.5, p.size / 2.5);
          ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x - p.vx * 0.03, p.y - p.vy * 0.03); ctx.stroke();
        } else if (p.kind === 'chip') {
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot);
          ctx.fillRect(-p.size, -p.size / 3, p.size * 2, p.size / 1.5); ctx.restore();
        } else {
          ctx.save(); ctx.translate(p.x, p.y); ctx.rotate(p.rot * 0.3);
          ctx.font = '900 ' + p.size + 'px Archivo, Montserrat, sans-serif';
          ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
          ctx.fillText('$', 0, 0); ctx.restore();
        }
      });
      ctx.globalAlpha = 1;
      requestAnimationFrame(draw);
    }

    /* ---------- The run ---------- */
    function showNum(n, i) {
      num.textContent = String(n);
      num.classList.remove('lcd-slam');
      void num.offsetWidth; // restart the animation
      num.classList.add('lcd-slam');
      wrap.style.setProperty('--lcd-heat', String((i + 1) / COUNT));
      ringFg.style.transition = 'none';
      ringFg.style.strokeDashoffset = '0';
      void ringFg.getBoundingClientRect();
      ringFg.style.transition = 'stroke-dashoffset 1s linear';
      ringFg.style.strokeDashoffset = '578';
      if (!reduce) {
        wrap.classList.remove('lcd-thump'); void wrap.offsetWidth; wrap.classList.add('lcd-thump');
      }
    }

    function blast() {
      wrap.classList.add('lcd-blast');
      if (!reduce) wrap.classList.add('lcd-shake');
      blastParticles();
      requestAnimationFrame(draw);
      later(function () { wrap.classList.add('lcd-clear'); }, 1350);
      later(function () { wrap.classList.add('lcd-fade'); }, 2600);
      later(cleanup, 3200);
    }

    function start() {
      if (started) return;
      started = true;
      markSeen();
      try {
        var AC = window.AudioContext || window.webkitAudioContext;
        if (AC) {
          ac = new AC();
          master = ac.createGain();
          master.gain.value = muted ? 0 : 0.9;
          var comp = ac.createDynamicsCompressor();
          comp.threshold.value = -10; comp.ratio.value = 6;
          master.connect(comp).connect(ac.destination);
          if (ac.resume) ac.resume();
          scheduleAll(ac, master, ac.currentTime + 0.06);
        }
      } catch (e) { ac = null; }
      wrap.classList.add('lcd-running');
      muteBtn.classList.add('lcd-show');
      for (var i = 0; i < COUNT; i++) {
        (function (i) { later(function () { showNum(COUNT - i, i); }, 60 + i * 1000); })(i);
      }
      later(blast, 60 + COUNT * 1000);
    }

    goBtn.addEventListener('click', start);
    skipBtn.addEventListener('click', skip);
    muteBtn.addEventListener('click', function () { setMute(!muted); });
    document.addEventListener('keydown', onKey);

    // Midnight IST: take it down even if the page stays open.
    if (!forced) {
      var left = END - Date.now();
      if (left > 0 && left < 2147483647) later(skip, left);
    }
    goBtn.focus({ preventScroll: true });
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', mount);
  else mount();
})();

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

  /* ---------- Sound: a movie-trailer cue, scheduled from one start time ----------
     Drone + rising strings build tension under five heavy hits, the music
     cuts out, a reverse swell sucks in, then a huge braam and boom. */
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

  function reverbIR(ac, seconds) {
    var len = Math.floor(ac.sampleRate * seconds);
    var buf = ac.createBuffer(2, len, ac.sampleRate);
    var seed = 777;
    for (var ch = 0; ch < 2; ch++) {
      var d = buf.getChannelData(ch);
      for (var i = 0; i < len; i++) {
        seed = (seed * 1103515245 + 12345) & 0x7fffffff;
        d[i] = ((seed / 0x7fffffff) * 2 - 1) * Math.pow(1 - i / len, 2.6);
      }
    }
    return buf;
  }

  function drive(ac, amount) {
    var ws = ac.createWaveShaper(), n = 2048, curve = new Float32Array(n);
    for (var i = 0; i < n; i++) { var x = i / (n - 1) * 2 - 1; curve[i] = Math.tanh(x * amount) / Math.tanh(amount); }
    ws.curve = curve; ws.oversample = '2x';
    return ws;
  }

  function env(g, t, a, peak, hold, rel) {
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(peak, t + a);
    g.gain.setValueAtTime(peak, t + a + hold);
    g.gain.exponentialRampToValueAtTime(0.0001, t + a + hold + rel);
  }

  // Detuned saw stack through a closing filter and drive: the trailer "braam".
  function braam(ac, out, t, freqs, peak, len, cutoff) {
    var lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 6;
    lp.frequency.setValueAtTime(cutoff, t);
    lp.frequency.exponentialRampToValueAtTime(90, t + len);
    var d = drive(ac, 3), g = ac.createGain();
    env(g, t, 0.012, peak, 0.05, len);
    lp.connect(d).connect(g).connect(out);
    freqs.forEach(function (f) {
      [-9, 0, 9].forEach(function (cents) {
        var o = ac.createOscillator(); o.type = 'sawtooth';
        o.frequency.value = f; o.detune.value = cents;
        var og = ac.createGain(); og.gain.value = 0.22;
        o.connect(og).connect(lp); o.start(t); o.stop(t + len + 0.2);
      });
    });
  }

  function sub(ac, out, t, from, to, peak, len) {
    var o = ac.createOscillator(), g = ac.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(from, t);
    o.frequency.exponentialRampToValueAtTime(to, t + len * 0.8);
    env(g, t, 0.004, peak, 0.04, len);
    o.connect(g).connect(out); o.start(t); o.stop(t + len + 0.1);
  }

  function noiseHit(ac, out, t, nb, type, f0, f1, q, peak, len) {
    var n = ac.createBufferSource(); n.buffer = nb;
    var f = ac.createBiquadFilter(); f.type = type; f.Q.value = q;
    f.frequency.setValueAtTime(f0, t);
    f.frequency.exponentialRampToValueAtTime(f1, t + len);
    var g = ac.createGain();
    env(g, t, 0.002, peak, 0.0, len);
    n.connect(f).connect(g).connect(out); n.start(t, Math.random() * 2); n.stop(t + len + 0.05);
  }

  function hit(ac, out, wet, t, i, nb) {
    var k = (i + 1) / COUNT; // grows towards "1"
    braam(ac, wet, t, [41.2, 55], 0.22 + 0.3 * k, 0.75, 900 + 1400 * k);
    sub(ac, out, t, 110, 38, 0.95, 0.5);
    noiseHit(ac, wet, t, nb, 'bandpass', 3200, 2400, 9, 0.35 + 0.2 * k, 0.35); // metal clank
    noiseHit(ac, out, t, nb, 'lowpass', 2500, 200, 1, 0.5, 0.18);              // impact body
    var c = ac.createOscillator(), cg = ac.createGain();                        // clock tick
    c.type = 'square'; c.frequency.value = 2400;
    env(cg, t + 0.5, 0.001, 0.07, 0, 0.03);
    c.connect(cg).connect(out); c.start(t + 0.5); c.stop(t + 0.56);
  }

  function tension(ac, out, wet, t, len, nb) {
    var cut = t + len - 0.4; // the music drops out just before zero
    // Drone.
    var lp = ac.createBiquadFilter(); lp.type = 'lowpass'; lp.Q.value = 4;
    lp.frequency.setValueAtTime(140, t);
    lp.frequency.exponentialRampToValueAtTime(2400, cut);
    var dg = ac.createGain();
    dg.gain.setValueAtTime(0.0001, t);
    dg.gain.exponentialRampToValueAtTime(0.26, cut - 0.05);
    dg.gain.linearRampToValueAtTime(0, cut);
    lp.connect(drive(ac, 2)).connect(dg).connect(wet);
    [55, 55.5, 82.4, 110.3].forEach(function (f) {
      var o = ac.createOscillator(); o.type = 'sawtooth'; o.frequency.value = f;
      o.connect(lp); o.start(t); o.stop(cut + 0.05);
    });
    // Rising strings (stacked, slightly detuned).
    var sg = ac.createGain();
    sg.gain.setValueAtTime(0.0001, t);
    sg.gain.exponentialRampToValueAtTime(0.1, cut - 0.05);
    sg.gain.linearRampToValueAtTime(0, cut);
    var slp = ac.createBiquadFilter(); slp.type = 'lowpass'; slp.frequency.value = 3500;
    slp.connect(sg).connect(wet);
    [220, 221.5, 330, 440.8].forEach(function (f) {
      var o = ac.createOscillator(); o.type = 'sawtooth';
      o.frequency.setValueAtTime(f, t);
      o.frequency.exponentialRampToValueAtTime(f * 2.4, cut);
      var vib = ac.createOscillator(), vg = ac.createGain();
      vib.frequency.value = 5.5; vg.gain.value = f * 0.006;
      vib.connect(vg).connect(o.frequency);
      o.connect(slp); o.start(t); o.stop(cut + 0.05); vib.start(t); vib.stop(cut + 0.05);
    });
    // Reverse swell that sucks in to the blast.
    var n = ac.createBufferSource(); n.buffer = nb;
    var hp = ac.createBiquadFilter(); hp.type = 'bandpass'; hp.Q.value = 0.7;
    hp.frequency.setValueAtTime(600, cut - 0.1);
    hp.frequency.exponentialRampToValueAtTime(6000, t + len);
    var rg = ac.createGain();
    rg.gain.setValueAtTime(0.0001, cut - 0.1);
    rg.gain.exponentialRampToValueAtTime(0.75, t + len - 0.01);
    rg.gain.linearRampToValueAtTime(0, t + len);
    n.connect(hp).connect(rg).connect(out); n.start(cut - 0.1); n.stop(t + len + 0.02);
  }

  function blastSound(ac, out, wet, t, nb) {
    braam(ac, wet, t, [27.5, 41.2, 55, 82.4], 1.0, 3.2, 3800);
    sub(ac, out, t, 95, 24, 1.0, 2.6);
    noiseHit(ac, wet, t, nb, 'lowpass', 7000, 90, 0.8, 1.0, 2.6);  // explosion body
    noiseHit(ac, out, t, nb, 'highpass', 3000, 3000, 0.7, 0.6, 0.2); // crack
    noiseHit(ac, wet, t + 0.05, nb, 'bandpass', 4200, 1500, 6, 0.3, 1.8); // metal ring
  }

  function cheer(ac, out, t, nb) {
    [520, 900, 1400, 2100, 3000].forEach(function (fr, k) {
      var n = ac.createBufferSource(); n.buffer = nb; n.loop = true;
      var f = ac.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = fr; f.Q.value = 1.4;
      var g = ac.createGain();
      var lfo = ac.createOscillator(), lg = ac.createGain();
      lfo.frequency.value = 5 + k * 1.7; lg.gain.value = 0.03;
      lfo.connect(lg).connect(g.gain);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.08, t + 0.5);
      g.gain.setValueAtTime(0.08, t + 1.4);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 3.6);
      n.connect(f).connect(g).connect(out);
      n.start(t, k * 0.37); n.stop(t + 3.7); lfo.start(t); lfo.stop(t + 3.7);
    });
  }

  // The whole soundtrack, from t0 (countdown start). Also used to render the preview video's audio.
  function scheduleAll(ac, out, t0) {
    var nb = noiseBuffer(ac, 4);
    var verb = ac.createConvolver(); verb.buffer = reverbIR(ac, 3.6);
    var wetG = ac.createGain(); wetG.gain.value = 0.45;
    var wet = ac.createGain(); // dry + reverb bus
    wet.connect(out); wet.connect(verb).connect(wetG).connect(out);
    tension(ac, out, wet, t0, COUNT, nb);
    for (var i = 0; i < COUNT; i++) hit(ac, out, wet, t0 + i, i, nb);
    blastSound(ac, out, wet, t0 + COUNT, nb);
    cheer(ac, wet, t0 + COUNT + 0.6, nb);
  }
  // Compress hard and limit, so it plays loud without clipping.
  function loudChain(ac) {
    var comp = ac.createDynamicsCompressor();
    comp.threshold.value = -20; comp.knee.value = 6; comp.ratio.value = 10;
    comp.attack.value = 0.003; comp.release.value = 0.25;
    var makeup = ac.createGain(); makeup.gain.value = 2.0;
    var lim = ac.createDynamicsCompressor();
    lim.threshold.value = -1.5; lim.knee.value = 0; lim.ratio.value = 20;
    lim.attack.value = 0.001; lim.release.value = 0.1;
    comp.connect(makeup).connect(lim).connect(ac.destination);
    return comp;
  }
  window.TESLaunchSound = { scheduleAll: scheduleAll, loudChain: loudChain, count: COUNT };

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
          master.connect(loudChain(ac));
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

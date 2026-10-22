// ===== WHAT WE DO: A RUBIK'S CUBE THAT SORTS ITSELF =====
// three.js (vendored in vendor/three) loads only when the section gets close.
// It starts a few moves away from solved, sorts itself once when it comes into
// view, pops "All Sorted!" and then stays solved. Drag to turn it around.

const stage = document.querySelector('.cube-stage');
const canvas = document.getElementById('cubeCanvas');
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

// An IntersectionObserver can hand over several entries at once when the page
// shifts while loading; the last one is the current state, so every observer
// here reads entries[entries.length - 1], never entries[0].
if (stage && canvas) {
  // Fetch three.js while the browser is idle, so it is ready before anyone scrolls here
  const warmUp = () => import('three').catch(() => {});
  if ('requestIdleCallback' in window) requestIdleCallback(warmUp, { timeout: 4000 });
  else setTimeout(warmUp, 2500);

  const nearby = new IntersectionObserver(entries => {
    if (!entries[entries.length - 1].isIntersecting) return;
    nearby.disconnect();
    start().catch(() => stage.classList.add('cube-fallback'));
  }, { rootMargin: '300px 0px' });
  nearby.observe(stage);
}

async function start() {
  const THREE = await import('three');
  const { RoundedBoxGeometry } = await import('./vendor/three/RoundedBoxGeometry.js');

  const renderer = new THREE.WebGLRenderer({ canvas, antialias: true, alpha: true });
  // If the graphics card drops the 3D context, show the "All Sorted!" fallback instead of a blank box
  canvas.addEventListener('webglcontextlost', e => {
    e.preventDefault();
    stage.classList.add('cube-fallback');
  });
  // Lighter on small or low-power phones (responsive.js sets data-motion="lite")
  const lite = document.documentElement.dataset.motion === 'lite';
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, lite ? 1.5 : 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);
  camera.position.set(0, 0, 12.5);

  scene.add(new THREE.AmbientLight(0xffffff, 1.1));
  const key = new THREE.DirectionalLight(0xffffff, 2.2);
  key.position.set(5, 8, 7);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0xcafb0c, 1.4);
  rim.position.set(-6, -3, -4);
  scene.add(rim);

  // Standard cube colours, with the brand lime in place of green
  const FACE_COLORS = {
    px: 0xd92b2b, nx: 0xff7a00,
    py: 0xf5f5f0, ny: 0xffd500,
    pz: 0xcafb0c, nz: 0x1e5bff
  };
  const body = new THREE.MeshStandardMaterial({ color: 0x0b0b0b, roughness: 0.55 });
  const bodyGeo = new RoundedBoxGeometry(0.96, 0.96, 0.96, 4, 0.1);
  const stickerGeo = new RoundedBoxGeometry(0.8, 0.8, 0.05, 2, 0.025);
  const stickerMats = Object.fromEntries(Object.entries(FACE_COLORS)
    .map(([face, color]) => [face, new THREE.MeshStandardMaterial({ color, roughness: 0.32 })]));

  const cube = new THREE.Group();
  cube.rotation.set(0.5, -0.72, 0);
  scene.add(cube);
  const pivot = new THREE.Group();
  cube.add(pivot);

  const cubies = [];
  for (let x = -1; x <= 1; x++) for (let y = -1; y <= 1; y++) for (let z = -1; z <= 1; z++) {
    if (!x && !y && !z) continue;
    const cubie = new THREE.Group();
    cubie.add(new THREE.Mesh(bodyGeo, body));
    const addSticker = (face, rx, ry, px, py, pz) => {
      const sticker = new THREE.Mesh(stickerGeo, stickerMats[face]);
      sticker.rotation.set(rx, ry, 0);
      sticker.position.set(px, py, pz);
      cubie.add(sticker);
    };
    const out = 0.485;
    if (x === 1) addSticker('px', 0, Math.PI / 2, out, 0, 0);
    if (x === -1) addSticker('nx', 0, -Math.PI / 2, -out, 0, 0);
    if (y === 1) addSticker('py', -Math.PI / 2, 0, 0, out, 0);
    if (y === -1) addSticker('ny', Math.PI / 2, 0, 0, -out, 0);
    if (z === 1) addSticker('pz', 0, 0, 0, 0, out);
    if (z === -1) addSticker('nz', 0, Math.PI, 0, 0, -out);
    cubie.position.set(x, y, z);
    cube.add(cubie);
    cubies.push(cubie);
  }

  function resize() {
    const size = stage.clientWidth;
    renderer.setSize(size, size, false);
    camera.aspect = 1;
    camera.updateProjectionMatrix();
  }
  resize();
  new ResizeObserver(resize).observe(stage);

  // ----- Turning a layer -----
  const ease = t => (t < 0.5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const wait = ms => new Promise(r => setTimeout(r, ms));
  let visible = false;
  let resumeVisible = null;
  const whenVisible = () => (visible ? Promise.resolve() : new Promise(r => { resumeVisible = r; }));

  // Snap a cubie back onto the grid so tiny float errors never build up
  const snapped = new THREE.Matrix4();
  function snap(cubie) {
    cubie.updateMatrix();
    const e = cubie.matrix.elements;
    for (const i of [0, 1, 2, 4, 5, 6, 8, 9, 10]) e[i] = Math.round(e[i]);
    for (const i of [12, 13, 14]) e[i] = Math.round(e[i]);
    snapped.copy(cubie.matrix);
    snapped.decompose(cubie.position, cubie.quaternion, cubie.scale);
  }

  function turn({ axis, layer, dir }, duration) {
    const layerCubies = cubies.filter(c => Math.round(c.position[axis]) === layer);
    pivot.rotation.set(0, 0, 0);
    pivot.updateMatrixWorld();
    layerCubies.forEach(c => pivot.attach(c));
    const finish = () => {
      pivot.rotation[axis] = dir * Math.PI / 2;
      pivot.updateMatrixWorld();
      layerCubies.forEach(c => { cube.attach(c); snap(c); });
      pivot.rotation.set(0, 0, 0);
    };
    if (!duration) { finish(); return Promise.resolve(); }
    return new Promise(resolve => {
      const t0 = performance.now();
      const frame = now => {
        const t = Math.min((now - t0) / duration, 1);
        pivot.rotation[axis] = dir * (Math.PI / 2) * ease(t);
        if (t < 1) requestAnimationFrame(frame);
        else { finish(); resolve(); }
      };
      requestAnimationFrame(frame);
    });
  }

  function scramble(length) {
    const axes = ['x', 'y', 'z'];
    const moves = [];
    let lastAxis = null;
    while (moves.length < length) {
      const axis = axes[Math.floor(Math.random() * 3)];
      if (axis === lastAxis) continue;
      lastAxis = axis;
      moves.push({ axis, layer: [-1, 1][Math.floor(Math.random() * 2)], dir: Math.random() < 0.5 ? 1 : -1 });
    }
    return moves;
  }
  const undo = m => ({ ...m, dir: -m.dir });

  // ----- Drawing, gentle sway and drag to turn -----
  let userX = 0, userY = 0, drag = null, spin = 0;
  stage.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, ux: userX, uy: userY }; });
  window.addEventListener('pointermove', e => {
    if (!drag) return;
    userY = drag.uy + (e.clientX - drag.x) * 0.01;
    userX = Math.max(-0.8, Math.min(0.8, drag.ux + (e.clientY - drag.y) * 0.01));
  });
  window.addEventListener('pointerup', () => { drag = null; });
  window.addEventListener('pointercancel', () => { drag = null; });

  const render = now => {
    if (!drag) { userX *= 0.96; userY *= 0.96; }
    const sway = reduceMotion ? 0 : Math.sin(now / 1800) * 0.12;
    cube.rotation.set(0.5 + userX, -0.72 + sway + userY + spin, 0);
    renderer.render(scene, camera);
  };
  const loop = now => {
    requestAnimationFrame(loop);
    if (visible) render(now);
  };

  new IntersectionObserver(entries => {
    visible = entries[entries.length - 1].isIntersecting;
    if (visible && resumeVisible) { resumeVisible(); resumeVisible = null; }
  }).observe(stage);

  if (reduceMotion) {
    stage.classList.add('is-sorted');
    requestAnimationFrame(loop);
    return;
  }

  // ----- The show: a few moves to sort, a spin, and it stays sorted -----
  const moves = scramble(5);
  for (const m of moves) await turn(m, 0);
  requestAnimationFrame(loop);

  await whenVisible();
  await wait(500);
  const solution = moves.slice().reverse().map(undo);
  for (let i = 0; i < solution.length; i++) {
    await whenVisible();
    await turn(solution[i], 240);
  }
  stage.classList.add('is-sorted');
  const spinFrom = performance.now();
  const celebrate = now => {
    const t = Math.min((now - spinFrom) / 1300, 1);
    spin = ease(t) * Math.PI * 2;
    if (t < 1) requestAnimationFrame(celebrate);
    else spin = 0;
  };
  requestAnimationFrame(celebrate);
}

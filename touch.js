// Kontrol sentuh untuk HP dan tablet. Stik virtual di kiri bawah, geser layar untuk menoleh,
// tombol di kanan bawah. Hanya aktif pada perangkat dengan layar sentuh utama.

const Touch = (() => {
  const isTouch = window.matchMedia('(pointer: coarse)').matches || 'ontouchstart' in window;
  if (isTouch) document.body.classList.add('is-touch');

  const state = {
    enabled: isTouch,
    mx: 0, mz: 0,        // stik: mx ke kanan, mz ke bawah (sama dengan tombol S)
    lookX: 0, lookY: 0,  // geseran layar yang belum dipakai
    run: false,
    crouch: false,
    pending: []          // aksi sekali tekan: flash, uv, interact
  };

  const stick = document.getElementById('stick');
  const knob = document.getElementById('stick-knob');
  const R = 48;
  let stickId = null;
  let cx = 0, cy = 0;

  function moveKnob(dx, dy) {
    knob.style.transform = `translate(${dx}px, ${dy}px)`;
  }

  function stickFrom(e) {
    let dx = e.clientX - cx;
    let dy = e.clientY - cy;
    const d = Math.hypot(dx, dy);
    if (d > R) { dx = (dx / d) * R; dy = (dy / d) * R; }
    moveKnob(dx, dy);
    state.mx = dx / R;
    state.mz = dy / R;
  }

  stick.addEventListener('pointerdown', e => {
    e.preventDefault();
    stickId = e.pointerId;
    stick.setPointerCapture(e.pointerId);
    const r = stick.getBoundingClientRect();
    cx = r.left + r.width / 2;
    cy = r.top + r.height / 2;
    stickFrom(e);
  });
  stick.addEventListener('pointermove', e => {
    if (e.pointerId === stickId) stickFrom(e);
  });
  function endStick(e) {
    if (e.pointerId !== stickId) return;
    stickId = null;
    state.mx = 0;
    state.mz = 0;
    moveKnob(0, 0);
  }
  stick.addEventListener('pointerup', endStick);
  stick.addEventListener('pointercancel', endStick);

  // Geser di area layar untuk menoleh
  const view = document.getElementById('canvas-container');
  let lookId = null, lx = 0, ly = 0;
  view.addEventListener('pointerdown', e => {
    if (e.pointerType !== 'touch') return;
    lookId = e.pointerId;
    lx = e.clientX;
    ly = e.clientY;
  });
  view.addEventListener('pointermove', e => {
    if (e.pointerId !== lookId) return;
    state.lookX += e.clientX - lx;
    state.lookY += e.clientY - ly;
    lx = e.clientX;
    ly = e.clientY;
  });
  function endLook(e) {
    if (e.pointerId === lookId) lookId = null;
  }
  view.addEventListener('pointerup', endLook);
  view.addEventListener('pointercancel', endLook);

  // Tombol aksi
  document.querySelectorAll('#actions .tbtn[data-act]').forEach(btn => {
    const act = btn.dataset.act;
    btn.addEventListener('pointerdown', e => {
      e.preventDefault();
      if (act === 'run') {
        state.run = true;
      } else if (act === 'crouch') {
        state.crouch = !state.crouch;
      } else {
        state.pending.push(act);
      }
    });
    const release = () => { if (act === 'run') state.run = false; };
    btn.addEventListener('pointerup', release);
    btn.addEventListener('pointercancel', release);
    btn.addEventListener('pointerleave', release);
  });

  function take() {
    const list = state.pending;
    state.pending = [];
    return list;
  }

  function consumeLook() {
    const r = { x: state.lookX, y: state.lookY };
    state.lookX = 0;
    state.lookY = 0;
    return r;
  }

  // Menandai tombol sesuai keadaan permainan (senter nyala, mode UV, jongkok)
  function syncButtons(flashOn, uvOn) {
    const map = {
      crouch: state.crouch,
      flash: flashOn,
      uv: uvOn
    };
    document.querySelectorAll('#actions .tbtn[data-act]').forEach(btn => {
      const k = btn.dataset.act;
      if (k in map) btn.classList.toggle('on', !!map[k]);
    });
  }

  // Panduan putar layar untuk HP yang dipegang tegak
  const rotate = document.getElementById('rotate');
  rotate.style.zIndex = '40';
  let skipped = false;
  function checkOrientation() {
    const portrait = window.innerHeight > window.innerWidth;
    rotate.hidden = !(isTouch && portrait && !skipped);
  }
  document.getElementById('rotate-skip').addEventListener('click', () => {
    skipped = true;
    checkOrientation();
  });
  window.addEventListener('resize', checkOrientation);
  window.addEventListener('orientationchange', checkOrientation);
  checkOrientation();

  return { state, take, consumeLook, syncButtons };
})();

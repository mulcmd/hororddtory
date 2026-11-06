// Inti permainan: status pemain, input, interaksi, progres bab, HUD, radar, dan loop utama.

const _dir = new THREE.Vector3();

function freshState() {
  return {
    started: false, paused: false, over: false, ended: false,
    noLock: false, everLocked: false,
    hp: 100, battery: 100, stamina: 100,
    flashOn: true, uvOn: false, uvTick: 0, uvSnd: 0,

    moving: false, sprinting: false, crouch: false, bobT: 0, baseH: 1.6,
    hiding: false, saved: null,
    notes: new Set(), hasKey: false, unlocked: false, doorAnim: 1,
    ritualStarted: false, ritualDone: false,
    bedroomDone: false, foyerDone: false, ghostOn: false,
    lastHurt: 99, scareCD: 0, ambT: 10,
    target: null
  };
}

let G = freshState();
let ghost = null;
const keys = {};
let lastT = performance.now();

const $ = id => document.getElementById(id);
const els = {
  menu: $('menu'), hud: $('hud'), crosshair: $('crosshair'), prompt: $('prompt'),
  hpBar: $('hp-bar'), hpText: $('hp-text'), batBar: $('bat-bar'), batText: $('bat-text'),
  stamBar: $('stam-bar'), flashMode: $('flash-mode'), minimap: $('minimap'),
  pause: $('pause'), gameover: $('gameover'), gameoverText: $('gameover-text'),
  ending: $('ending'), endingText: $('ending-text'),
  dmg: $('damage-overlay'), scare: $('scare-overlay'), fade: $('fade'),
  guide: $('guide'), goalWrap: $('goal-arrow'), goalSvg: $('goal-svg'), goalDist: $('goal-dist')
};
const mctx = els.minimap.getContext('2d');

function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }

function setFade(v) { els.fade.style.opacity = String(v); }

function flickerLamps(sec) {
  World.lamps.forEach(l => { l.flicker = sec; });
}

// ---------- Tujuan dan progres bab ----------
function refreshObjective() {
  let ch, obj;
  if (!G.foyerDone) {
    ch = 'Bab 1 · Gerbang'; obj = 'Masuk ke rumah lewat pintu depan.';
  } else if (!G.notes.has('note1')) {
    ch = 'Bab 2 · Ruang Tamu'; obj = 'Cari Catatan Ayu #1 di ruang tamu.';
  } else if (!G.bedroomDone) {
    ch = 'Bab 2 · Ruang Tamu'; obj = 'Telusuri rumah dan cari jejak Ayu ke arah kamar tidur.';
  } else if (!(G.notes.has('note2') && G.hasKey)) {
    ch = 'Bab 3 · Kamar Tidur'; obj = 'Ambil Catatan #2 di ranjang dan Kunci Gudang di laci.';
  } else if (!G.unlocked) {
    ch = 'Bab 3 · Kamar Tidur'; obj = 'Buka pintu terkunci di sisi lorong.';
  } else if (!G.notes.has('note3')) {
    ch = 'Bab 4 · Ruang Ritual'; obj = 'Ambil Catatan #3 di dekat peti.';
  } else if (!G.ritualStarted) {
    ch = 'Bab 4 · Ruang Ritual'; obj = 'Periksa altar dan mulai ritual.';
  } else if (!G.ritualDone) {
    ch = 'Bab 4 · Ruang Ritual'; obj = 'Musnahkan Ratih dengan senter UV.';
  } else {
    ch = 'Epilog'; obj = 'Keluar dari rumah.';
  }
  Story.setChapter(ch);
  Story.setObjective(obj);
}

// Zona pemicu cerita (dicek tiap frame, hanya sekali per zona)
function checkZones() {
  const p = World.camera.position;
  if (!G.foyerDone && p.z < 5.2 && Math.abs(p.x) < 2) {
    G.foyerDone = true;
    Story.play('foyer', refreshObjective);
    flickerLamps(1.2);
    refreshObjective();
  }
  if (G.foyerDone && !G.bedroomDone && p.x < -2.4 && p.z < -2.4) {
    G.bedroomDone = true;
    audioSys.slam();
    flickerLamps(2);
    Story.play('bedroom', refreshObjective);
    refreshObjective();
  }
}

// ---------- Interaksi ----------
function labelFor(it) {
  switch (it.kind) {
    case 'note': return `Ambil ${it.title}`;
    case 'battery': return 'Ambil baterai';
    case 'key': return 'Ambil kunci';
    case 'photo': return 'Lihat foto keluarga';
  }
  return 'Ambil';
}

function findTarget() {
  const cam = World.camera;
  const p = cam.position;
  const yaw = cam.rotation.y;
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
  let best = null, bestD = Infinity;

  const consider = (x, z, range, label, action) => {
    const dx = x - p.x, dz = z - p.z;
    const d = Math.hypot(dx, dz);
    if (d > range) return;
    const facing = d < 0.01 ? 1 : (dx * fx + dz * fz) / d;
    if (facing < 0.55 && d > 1.1) return;
    if (d < bestD) { bestD = d; best = { label, action }; }
  };

  World.items.forEach(it => {
    if (!it.collected) consider(it.pos[0], it.pos[2], 2.2, labelFor(it), () => pickup(it));
  });
  if (!G.unlocked) {
    consider(2, -5, 2.6, G.hasKey ? 'Buka pintu terkunci' : 'Pintu terkunci', tryDoor);
  }
  if (World.hideSpot) {
    consider(World.hideSpot.x, World.hideSpot.z, 2.4,
      G.hiding ? 'Keluar dari lemari' : 'Sembunyi di lemari', toggleHide);
  }
  if (!G.ritualDone) {
    consider(5, -8.2, 2.4, G.ritualStarted ? 'Altar' : 'Periksa altar', altar);
  }
  return best;
}

function interact() {
  const t = findTarget();
  if (t) t.action();
}

function pickup(it) {
  if (it.collected) return;
  it.collected = true;
  it.mesh.visible = false;
  audioSys.chime();
  if (it.kind === 'battery') {
    G.battery = Math.min(100, G.battery + 40);
    Story.notice('Baterai senter +40%');
  } else if (it.id === 'key') {
    G.hasKey = true;
    Story.play('key', refreshObjective);
  } else if (it.kind === 'photo') {
    Story.play('photo', refreshObjective);
  } else if (it.kind === 'note') {
    G.notes.add(it.id);
    Story.play(it.id, () => {
      if (it.id === 'note1' && !G.ghostOn) {
        G.ghostOn = true;
        ghost.activate(0, -5);
        flickerLamps(2.5);
        audioSys.whisper(0);
      }
      refreshObjective();
    });
  }
  refreshObjective();
}

function tryDoor() {
  if (G.unlocked) return;
  if (!G.hasKey) {
    Story.play('locked');
    return;
  }
  G.unlocked = true;
  G.doorAnim = 0;
  World.colliders = World.colliders.filter(c => c !== World.doorCollider);
  audioSys.creak();
  Story.play('unlock', refreshObjective);
  refreshObjective();
}

function toggleHide() {
  const cam = World.camera;
  if (G.hiding) {
    G.hiding = false;
    cam.position.x = G.saved.x;
    cam.position.z = G.saved.z;
    cam.rotation.y = G.saved.yaw;
    setFade(0);
    return;
  }
  G.saved = { x: cam.position.x, z: cam.position.z, yaw: cam.rotation.y };
  G.hiding = true;
  cam.position.x = -5.6;
  cam.position.z = -4.2;
  cam.rotation.y = Math.PI / 2; // menghadap lemari
  setFade(0.82);
  Story.notice('Kau menahan napas di dalam lemari. Tekan E untuk keluar.');
}

function altar() {
  if (G.ritualDone) return;
  if (G.ritualStarted) {
    Story.say('Bima', 'Ratih masih di sana. Gunakan senter UV.');
    return;
  }
  if (G.notes.size < 3 || !G.hasKey || !G.unlocked) {
    Story.say('Bima', 'Aku belum punya semua catatan Ayu. Aku belum siap menghadapi apa pun yang ada di sini.');
    return;
  }
  G.ritualStarted = true;
  ghost.becomeBoss(6.5, -3.2);
  refreshObjective();
  Story.play('ritual', () => {
    flickerLamps(3);
    Story.play('ritualFight', refreshObjective);
    refreshObjective();
  });
}

// ---------- Senter dan mode UV ----------
function toggleFlash() {
  if (!G.flashOn && G.battery <= 0) {
    Story.notice('Baterai habis.');
    return;
  }
  G.flashOn = !G.flashOn;
  audioSys.click();
}

function toggleUV() {
  if (!G.uvOn && G.battery <= 0) {
    Story.notice('Baterai habis. Mode UV tidak bisa dipakai.');
    return;
  }
  G.uvOn = !G.uvOn;
  if (G.uvOn) G.flashOn = true;
  audioSys.click();
}

function updateFlashlight(dt) {
  const cam = World.camera;
  const f = World.flashlight;
  if (G.flashOn) {
    G.battery = Math.max(0, G.battery - (G.uvOn ? 2.2 : 0.9) * Settings.diff().drain * dt);
    if (G.battery <= 0) {
      G.flashOn = false;
      Story.notice('Baterai senter habis.');
    }
  }
  f.intensity = G.flashOn ? (G.uvOn ? 3.4 : 2.5) : 0;
  f.color.setHex(G.uvOn ? 0xa855f7 : 0xfff5e6);
  f.position.copy(cam.position);
  _dir.set(0, 0, -1).applyQuaternion(cam.quaternion);
  f.target.position.copy(cam.position).addScaledVector(_dir, 10);
  const showUV = G.uvOn && G.flashOn;
  World.sigils.forEach(s => { s.visible = showUV; });
}

// Sinar UV ke hantu. Di mode bos, sinar melukai. Di luar itu, sinar membuatnya mundur.
function updateUV(dt) {
  if (!ghost || !ghost.active || ghost.dead) return;
  if (!(G.uvOn && G.flashOn && G.battery > 0)) return;
  const cam = World.camera;
  _dir.set(0, 0, -1).applyQuaternion(cam.quaternion);
  const gx = ghost.x - cam.position.x;
  const gz = ghost.z - cam.position.z;
  const gy = 1.2 - cam.position.y;
  const dist = Math.hypot(gx, gy, gz);
  if (dist > 12 || dist < 0.01) return;
  const dot = (_dir.x * gx + _dir.y * gy + _dir.z * gz) / dist;
  if (dot < Math.cos(0.26)) return;

  G.uvSnd -= dt;
  if (G.uvSnd <= 0) { audioSys.uvBeam(); G.uvSnd = 0.2; }

  if (ghost.state === 'boss') {
    if (ghost.hurt(26 * dt, true)) onGhostDead();
  } else {
    G.uvTick -= dt;
    if (G.uvTick <= 0) {
      ghost.hurt(0, false);
      G.uvTick = 0.9;
    }
  }
}

function onGhostDead() {
  G.ritualDone = true;
  G.uvOn = false;
  audioSys.screech();
  refreshObjective();
  ghost.dissolve(() => {
    Story.play('ending', showEnding);
  });
}

// ---------- Pemain ----------
function updatePlayer(dt) {
  const cam = World.camera;
  const ts = Touch.state;
  const sx = Math.abs(ts.mx) < 0.15 ? 0 : ts.mx;   // zona mati stik
  const sz = Math.abs(ts.mz) < 0.15 ? 0 : ts.mz;
  const mx = clamp((keys.KeyD ? 1 : 0) - (keys.KeyA ? 1 : 0) + sx, -1, 1);
  const mz = clamp((keys.KeyS ? 1 : 0) - (keys.KeyW ? 1 : 0) + sz, -1, 1);
  G.crouch = !!(keys.ControlLeft || keys.ControlRight || ts.crouch);
  G.moving = Math.abs(mx) > 0.01 || Math.abs(mz) > 0.01;
  const wantSprint = !!(keys.ShiftLeft || keys.ShiftRight || ts.run) && G.moving && !G.crouch;
  G.sprinting = wantSprint && G.stamina > 0;
  if (G.sprinting) G.stamina = Math.max(0, G.stamina - 24 * dt);
  else G.stamina = Math.min(100, G.stamina + 14 * dt);

  const speed = G.crouch ? 1.7 : (G.sprinting ? 6.0 : 3.6);
  const yaw = cam.rotation.y;
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw);   // arah depan
  const rx = Math.cos(yaw), rz = -Math.sin(yaw);    // arah kanan
  let dx = rx * mx + fx * -mz;
  let dz = rz * mx + fz * -mz;
  const len = Math.hypot(dx, dz);
  if (len > 0) {
    dx /= len;
    dz /= len;
    const step = speed * dt;
    const nx = cam.position.x + dx * step;
    const nz = cam.position.z + dz * step;
    if (!blockedAt(nx, cam.position.z, World.colliders, 0.3)) cam.position.x = nx;
    if (!blockedAt(cam.position.x, nz, World.colliders, 0.3)) cam.position.z = nz;
    cam.position.x = clamp(cam.position.x, ARENA.x1, ARENA.x2);
    cam.position.z = clamp(cam.position.z, ARENA.z1, ARENA.z2);
  }

  // Goyangan kepala saat berjalan
  G.baseH = G.crouch ? 1.0 : 1.6;
  if (G.moving) G.bobT += dt * (G.sprinting ? 11 : 7.5);
  const bob = G.moving && !Settings.reduce() ? Math.sin(G.bobT) * (G.sprinting ? 0.06 : 0.035) : 0;
  cam.position.y += ((G.baseH + bob) - cam.position.y) * Math.min(1, dt * 10);

  // Cadangan jika mouse tidak bisa dikunci: panah kiri-kanan-atas-bawah
  if (G.noLock) {
    if (keys.ArrowLeft) cam.rotation.y += 1.8 * dt;
    if (keys.ArrowRight) cam.rotation.y -= 1.8 * dt;
    if (keys.ArrowUp) cam.rotation.x = clamp(cam.rotation.x + 1.2 * dt, -1.25, 1.25);
    if (keys.ArrowDown) cam.rotation.x = clamp(cam.rotation.x - 1.2 * dt, -1.25, 1.25);
  }
}

function hurtPlayer(dt) {
  G.hp = Math.max(0, G.hp - 26 * Settings.diff().damage * dt);
  G.lastHurt = 0;
  if (G.scareCD <= 0) {
    G.scareCD = 2.6;
    if (Settings.scare()) {
      els.scare.style.opacity = '1';
      setTimeout(() => { els.scare.style.opacity = '0'; }, 320);
      audioSys.sting();
    }
  }
  if (G.hp <= 0) {
    playerDies(ghost && ghost.state === 'boss'
      ? 'Ratih menyeretmu ke dalam altar. Lilin-lilin padam satu per satu.'
      : 'Ratih menangkapmu sebelum kau sempat keluar dari rumah ini.');
  }
}

function playerDies(text) {
  if (G.over) return;
  G.over = true;
  G.hp = 0;
  els.gameoverText.textContent = text;
  els.gameover.hidden = false;
  document.exitPointerLock();
}

function showEnding() {
  G.ended = true;
  G.uvOn = false;
  G.flashOn = false;
  document.exitPointerLock();
  els.endingText.textContent = 'Ratih lenyap. Di halaman, Ayu tertawa kecil di sebelahmu, tidak ingat apa yang terjadi malam ini. Kau juga belum sepenuhnya bisa melupakannya.';
  els.ending.hidden = false;
}

// ---------- Tujuan, panah penunjuk, kontrol sentuh, pause, dan menu ----------
function itemPos(id) {
  const it = World.items.find(i => i.id === id);
  return it && !it.collected ? { x: it.pos[0], z: it.pos[2] } : null;
}

// Tempat yang harus dituju saat ini, untuk panah penunjuk di HUD
function currentGoal() {
  if (!G.foyerDone) return { x: 0, z: 5 };
  if (!G.notes.has('note1')) return itemPos('note1');
  if (!G.bedroomDone) return { x: -5, z: -4 };
  if (!G.notes.has('note2')) return itemPos('note2');
  if (!G.hasKey) return itemPos('key');
  if (!G.unlocked) return { x: 2, z: -5 };
  if (!G.notes.has('note3')) return itemPos('note3');
  if (!G.ritualStarted) return { x: 5, z: -8.2 };
  if (!G.ritualDone && ghost) return { x: ghost.x, z: ghost.z };
  return null;
}

function updateGoal() {
  const goal = (G.hiding || G.ended || G.over) ? null : currentGoal();
  els.goalWrap.hidden = !goal;
  if (!goal) return;
  const cam = World.camera;
  const yaw = cam.rotation.y;
  const fx = -Math.sin(yaw), fz = -Math.cos(yaw);
  const rx = Math.cos(yaw), rz = -Math.sin(yaw);
  const dx = goal.x - cam.position.x;
  const dz = goal.z - cam.position.z;
  const fwd = dx * fx + dz * fz;
  const right = dx * rx + dz * rz;
  const ang = Math.atan2(right, fwd) * 180 / Math.PI;
  els.goalSvg.style.transform = `rotate(${ang.toFixed(1)}deg)`;
  els.goalDist.textContent = `${Math.round(Math.hypot(dx, dz))} m`;
}

// Geseran layar untuk menoleh di HP
function applyTouchLook(active) {
  const l = Touch.consumeLook();
  if (!active || (l.x === 0 && l.y === 0)) return;
  const cam = World.camera;
  const s = Settings.sensMul() * 0.0045;
  cam.rotation.y -= l.x * s;
  cam.rotation.x = clamp(cam.rotation.x - l.y * s, -1.25, 1.25);
}

function handleTouchAction(act) {
  if (act === 'interact') {
    if (Story.isOpen()) Story.advance();
    else if (!G.over && !G.ended) interact();
    return;
  }
  if (Story.isOpen() || G.over || G.ended) return;
  if (act === 'flash') toggleFlash();
  else if (act === 'uv') toggleUV();
}

function pauseGame() {
  if (!G.started || G.paused || G.over || G.ended) return;
  G.paused = true;
  els.pause.hidden = false;
  if (document.pointerLockElement === document.body) document.exitPointerLock();
  $('resume-btn').focus();
}

function resumeGame() {
  if (!G.paused) return;
  G.paused = false;
  els.pause.hidden = true;
  if (!G.noLock && !Touch.state.enabled) requestLock();
}

let guideReturn = null;
function openGuide(from) {
  guideReturn = from || null;
  els.guide.hidden = false;
  $('guide-close').focus();
}

function closeGuide() {
  els.guide.hidden = true;
  Settings.markGuideSeen();
  const cb = guideReturn;
  guideReturn = null;
  if (cb) cb();
}

// Kembali ke menu utama. Dunia dibangun ulang dan permainan berhenti.
function toMenu() {
  document.exitPointerLock();
  resetWorld();
  G.started = false;
  els.hud.hidden = true;
  els.crosshair.hidden = true;
  els.prompt.hidden = true;
  els.notice.hidden = true;
  els.pause.hidden = true;
  els.gameover.hidden = true;
  els.ending.hidden = true;
  els.menu.hidden = false;
  Story.reset();
}

// ---------- HUD dan radar ----------
function updateHUD() {
  const hp = Math.ceil(G.hp);
  const bat = Math.ceil(G.battery);
  els.hpBar.style.width = hp + '%';
  els.hpText.textContent = hp + '%';
  els.batBar.style.width = bat + '%';
  els.batText.textContent = bat + '%';
  els.stamBar.style.width = Math.ceil(G.stamina) + '%';
  const mode = G.uvOn ? 'Senter: mode UV [R]' : 'Senter: biasa [R]';
  els.flashMode.textContent = mode + (G.flashOn ? '' : ' · mati');
  els.flashMode.classList.toggle('uv', G.uvOn);
  if (Touch.state.enabled) Touch.syncButtons(G.flashOn, G.uvOn);
}

function drawMinimap() {
  const cam = World.camera;
  const px = cam.position.x, pz = cam.position.z, yaw = cam.rotation.y;
  const c = Math.cos(yaw), s = Math.sin(yaw);
  const S = 5.2, CX = 75, CY = 75;
  const P = (x, z) => [CX + ((x - px) * c - (z - pz) * s) * S, CY + ((x - px) * s + (z - pz) * c) * S];

  mctx.clearRect(0, 0, 150, 150);
  mctx.save();
  mctx.beginPath();
  mctx.arc(CX, CY, 73, 0, Math.PI * 2);
  mctx.clip();
  mctx.fillStyle = 'rgba(5, 5, 8, 0.9)';
  mctx.fillRect(0, 0, 150, 150);

  // Cincin jarak
  mctx.strokeStyle = 'rgba(200, 29, 29, 0.25)';
  mctx.lineWidth = 1;
  mctx.beginPath();
  mctx.arc(CX, CY, 30, 0, Math.PI * 2);
  mctx.arc(CX, CY, 60, 0, Math.PI * 2);
  mctx.stroke();

  // Dinding
  mctx.fillStyle = 'rgba(190, 40, 40, 0.8)';
  WALL_BOXES.forEach(([x1, x2, z1, z2]) => {
    const pts = [P(x1, z1), P(x2, z1), P(x2, z2), P(x1, z2)];
    mctx.beginPath();
    mctx.moveTo(pts[0][0], pts[0][1]);
    for (let i = 1; i < 4; i++) mctx.lineTo(pts[i][0], pts[i][1]);
    mctx.closePath();
    mctx.fill();
  });

  // Pintu terkunci
  if (!G.unlocked) {
    const a = P(2, -6), b = P(2, -4);
    mctx.strokeStyle = '#a855f7';
    mctx.lineWidth = 2;
    mctx.beginPath();
    mctx.moveTo(a[0], a[1]);
    mctx.lineTo(b[0], b[1]);
    mctx.stroke();
  }

  // Benda yang belum diambil
  const colors = { note: '#fbbf24', battery: '#86efac', key: '#e5e7eb', photo: '#a8a29e' };
  World.items.forEach(it => {
    if (it.collected) return;
    const d = Math.hypot(it.pos[0] - px, it.pos[2] - pz);
    if (d > 12) return;
    const [x, y] = P(it.pos[0], it.pos[2]);
    mctx.fillStyle = colors[it.kind] || '#fff';
    mctx.beginPath();
    mctx.arc(x, y, 2.5, 0, Math.PI * 2);
    mctx.fill();
  });

  // Hantu: hanya terlihat saat dekat atau sedang mengejar
  if (ghost && G.ghostOn && !ghost.dead && ghost.group.visible) {
    const d = Math.hypot(ghost.x - px, ghost.z - pz);
    const chasing = ghost.state === 'chase' || ghost.state === 'boss';
    if (chasing || d < 10) {
      const [x, y] = P(ghost.x, ghost.z);
      mctx.fillStyle = `rgba(239, 68, 68, ${0.6 + Math.sin(performance.now() * 0.01) * 0.4})`;
      mctx.beginPath();
      mctx.arc(x, y, 4.5, 0, Math.PI * 2);
      mctx.fill();
    }
  }
  mctx.restore();

  // Panah pemain di tengah
  mctx.fillStyle = '#34d399';
  mctx.beginPath();
  mctx.moveTo(CX, CY - 7);
  mctx.lineTo(CX + 5, CY + 5);
  mctx.lineTo(CX - 5, CY + 5);
  mctx.closePath();
  mctx.fill();
}

// ---------- Lampu, pintu, dan loop utama ----------
function updateLamps(dt) {
  const t = performance.now() * 0.002;
  World.lamps.forEach(l => {
    if (l.flicker > 0) l.flicker -= dt;
    if (l.flicker > 0 && !Settings.reduce()) {
      l.light.intensity = Math.random() < 0.4 ? 0.05 : l.base * (0.5 + Math.random() * 0.7);
    } else {
      l.light.intensity = l.base * (0.96 + Math.sin(t + l.light.position.x) * 0.04);
    }
  });
}

function updateDoor(dt) {
  if (G.doorAnim >= 1 || !World.doorPivot) return;
  G.doorAnim = Math.min(1, G.doorAnim + dt / 1.6);
  const k = 1 - Math.pow(1 - G.doorAnim, 3);
  World.doorPivot.rotation.y = -k * Math.PI * 0.5;
}

function tick(dt) {
  const story = Story.isOpen();
  Story.update(dt);
  const active = !story && !G.over && !G.ended;
  GHOST.mult = Settings.diff().speed;
  applyTouchLook(active);
  Touch.take().forEach(handleTouchAction);

  G.lastHurt += dt;
  G.scareCD -= dt;
  if (G.hp > 0 && G.hp < 100 && G.lastHurt > 5) G.hp = Math.min(100, G.hp + 6 * dt);

  if (active) {
    if (!G.hiding) updatePlayer(dt);
    updateDoor(dt);
    checkZones();
  }
  updateFlashlight(dt);
  updateGoal();

  const cam = World.camera;
  if (ghost) {
    const pl = {
      x: cam.position.x, z: cam.position.z,
      hidden: G.hiding, moving: G.moving && !G.hiding, sprinting: G.sprinting
    };
    const out = ghost.update(dt, pl, World.colliders, !active);
    if (active && out.spotted) audioSys.screech();
    if (active) {
      updateUV(dt);
      if (out.attacking) hurtPlayer(dt);
    }
  }

  // Detak jantung mengikuti jarak hantu
  let bpm = 0;
  if (ghost && G.ghostOn && !ghost.dead) {
    const d = Math.hypot(ghost.x - cam.position.x, ghost.z - cam.position.z);
    if (d < 16) bpm = 62 + ((16 - d) / 16) * 80;
    if (ghost.state === 'chase' || ghost.state === 'boss') bpm = Math.max(bpm, 125);
  }
  if (G.hp > 0 && G.hp < 35) bpm = Math.max(bpm, 105);
  if (G.over || G.ended) bpm = 0;
  audioSys.update(dt, bpm);

  // Bisikan dan suara acak saat sudah masuk rumah
  if (active && G.foyerDone) {
    G.ambT -= dt;
    if (G.ambT <= 0) {
      G.ambT = 9 + Math.random() * 10;
      const r = Math.random();
      if (r < 0.45) audioSys.whisper(rnd(-0.7, 0.7));
      else if (r < 0.8) audioSys.creak();
      else flickerLamps(0.8);
    }
  }

  // Overlay merah saat diserang atau darah rendah
  const low = Math.max(0, (40 - G.hp) / 40) * 0.6;
  els.dmg.style.opacity = G.lastHurt < 0.25 ? '1' : String(low);

  // Prompt interaksi
  const target = active ? findTarget() : null;
  G.target = target;
  if (target) {
    els.prompt.innerHTML = `<kbd>${Touch.state.enabled ? 'Pakai' : 'E'}</kbd> ${target.label}`;
    els.prompt.hidden = false;
  } else {
    els.prompt.hidden = true;
  }

  updateHUD();
}

function frame(now) {
  requestAnimationFrame(frame);
  const dt = Math.min(0.05, (now - lastT) / 1000);
  lastT = now;
  if (!G.started) {
    World.camera.rotation.y += dt * 0.05; // kamera pelan di menu
  } else if (!G.paused) {
    tick(dt);
    drawMinimap();
  }
  updateLamps(dt);
  World.renderer.render(World.scene, World.camera);
}

// ---------- Mulai, ulang, dan pengaturan layar ----------
function resetWorld() {
  if (World.group) World.scene.remove(World.group);
  if (ghost) World.scene.remove(ghost.group);
  buildWorld();
  ghost = new Ghost(World.scene);
  const prev = G;
  G = freshState();
  G.started = prev.started;
  G.noLock = prev.noLock;
  G.everLocked = prev.everLocked;
  World.camera.position.set(0, 1.6, 12);
  World.camera.rotation.set(0, 0, 0);
  Story.reset();
  els.gameover.hidden = true;
  els.ending.hidden = true;
  els.pause.hidden = true;
  els.dmg.style.opacity = '0';
  els.scare.style.opacity = '0';
  refreshObjective();
}

function requestLock() {
  try {
    const p = document.body.requestPointerLock();
    if (p && typeof p.catch === 'function') {
      p.catch(() => { if (!G.everLocked) G.noLock = true; });
    }
  } catch (e) {
    if (!G.everLocked) G.noLock = true;
  }
}

function startGame() {
  audioSys.init();
  els.menu.hidden = true;
  els.hud.hidden = false;
  els.crosshair.hidden = false;
  G.started = true;
  if (Touch.state.enabled) G.noLock = true;   // layar sentuh tidak memakai pointer lock
  else requestLock();
  refreshObjective();
  Story.play('intro', () => {
    Story.notice('WASD gerak · Shift lari · Ctrl jongkok · F senter · R mode UV · E interaksi');
  });
}

function restartGame() {
  requestLock();
  setFade(1);
  setTimeout(() => {
    resetWorld();
    Story.notice('Kau kembali ke gerbang rumah.');
    setFade(0);
  }, 900);
}

$('start-btn').addEventListener('click', startGame);
$('menu-guide-btn').addEventListener('click', () => openGuide(null));
$('menu-settings-btn').addEventListener('click', () => Settings.open(null));
$('guide-close').addEventListener('click', closeGuide);
$('pause-btn').addEventListener('click', pauseGame);
$('resume-btn').addEventListener('click', resumeGame);
$('pause-guide-btn').addEventListener('click', () => openGuide(null));
$('pause-settings-btn').addEventListener('click', () => Settings.open(null));
$('menu-btn').addEventListener('click', toMenu);
$('gameover-menu-btn').addEventListener('click', toMenu);
$('retry-btn').addEventListener('click', restartGame);
$('ending-btn').addEventListener('click', restartGame);
document.addEventListener('visibilitychange', () => { if (document.hidden) pauseGame(); });

document.addEventListener('pointerlockchange', () => {
  const locked = document.pointerLockElement === document.body;
  if (locked) {
    G.everLocked = true;
    G.noLock = false;
    G.paused = false;
    els.pause.hidden = true;
    return;
  }
  if (G.started && !G.over && !G.ended && !G.noLock) {
    G.paused = true;
    els.pause.hidden = false;
  }
});

document.addEventListener('mousemove', e => {
  if (document.pointerLockElement !== document.body) return;
  const cam = World.camera;
  const s = Settings.sensMul() * 0.0022;
  cam.rotation.y -= e.movementX * s;
  cam.rotation.x = clamp(cam.rotation.x - e.movementY * s, -1.25, 1.25);
});

document.addEventListener('keydown', e => {
  if (e.code === 'Space' || e.code.indexOf('Arrow') === 0) e.preventDefault();
  if (e.code === 'Escape') {
    const modal = !els.guide.hidden || !$('settings').hidden;
    if (!G.started || G.over || G.ended || modal) return;
    if (G.paused) resumeGame();
    else if (G.noLock || Touch.state.enabled) pauseGame();
    return;
  }
  if (!G.started || G.paused || G.over || G.ended) return;
  keys[e.code] = true;
  if (e.repeat) return;
  if (Story.isOpen()) {
    if (e.code === 'KeyE' || e.code === 'Enter' || e.code === 'Space') Story.advance();
    return;
  }
  switch (e.code) {
    case 'KeyE': interact(); break;
    case 'KeyF': toggleFlash(); break;
    case 'KeyR': toggleUV(); break;
  }
});

document.addEventListener('keyup', e => { keys[e.code] = false; });
window.addEventListener('blur', () => { for (const k in keys) keys[k] = false; });

window.addEventListener('resize', () => {
  World.camera.aspect = window.innerWidth / window.innerHeight;
  World.camera.updateProjectionMatrix();
  World.renderer.setSize(window.innerWidth, window.innerHeight);
});

// Boot: bangun dunia dan mulai loop. Kamera di menu berputar pelan di halaman.
createRenderer(document.getElementById('canvas-container'));
resetWorld();
requestAnimationFrame(frame);
if (!Settings.seenGuide()) openGuide(null); // tampilkan cara bermain untuk pemain baru

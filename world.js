// Denah rumah, dunia 3D, dan benda-benda di dalamnya (Three.js r128).

const WALL_H = 3.4;
const WALL_T = 0.3;

// Batas area yang bisa dijelajahi (halaman + rumah)
const ARENA = { x1: -12.5, x2: 12.5, z1: -11.5, z2: 14.5 };

// Dinding sebagai kotak [x1, x2, z1, z2] (denah atas, sumbu x = kiri-kanan, z = depan-belakang).
// Rumah: Foyer di tengah, Ruang Tamu di kiri, Dapur di kanan, Kamar Tidur di kiri belakang,
// Lorong di tengah belakang, dan Ruang Ritual di kanan belakang (terkunci).
const WALL_BOXES = [
  // Dinding luar, celah di tengah = pintu depan
  [-8.15, -1, 5.85, 6.15], [1, 8.15, 5.85, 6.15],
  [-8.15, 8.15, -10.15, -9.85],
  [-8.15, -7.85, -10, 6],
  [7.85, 8.15, -10, 6],
  // Sekat x = -2 (Ruang Tamu | Foyer, Kamar | Lorong)
  [-2.15, -1.85, -2, 2], [-2.15, -1.85, 3.5, 6], [-2.15, -1.85, -10, -2],
  // Sekat x = 2 (Foyer | Dapur, Lorong | Ruang Ritual). Pintu Ruang Ritual ada di z -6..-4
  [1.85, 2.15, -2, 2], [1.85, 2.15, 3.5, 6], [1.85, 2.15, -10, -6], [1.85, 2.15, -4, -2],
  // Sekat z = -2 (celah ke Kamar Tidur dan ke Lorong)
  [-8.15, -6, -2.15, -1.85], [-4, -2, -2.15, -1.85],
  [-2, -1, -2.15, -1.85], [1, 2, -2.15, -1.85],
  [2, 8.15, -2.15, -1.85]
];

// Pintu terkunci ke Ruang Ritual (butuh Kunci Gudang)
const LOCKED_DOOR = { x1: 1.85, x2: 2.15, z1: -6, z2: -4 };

// Perabot: kotak tabrakan sekaligus bentuk visual
const FURNITURE = [
  { name: 'sofa', x1: -7.4, x2: -5.4, z1: 2.6, z2: 4.2, h: 0.8, color: 0x2a1a1f },
  { name: 'meja tamu', x1: -6.4, x2: -5.0, z1: -0.6, z2: 0.6, h: 0.45, color: 0x3b2a1e },
  { name: 'rak buku', x1: -7.8, x2: -7.3, z1: -1.6, z2: 0.6, h: 2.2, color: 0x2b1f16 },
  { name: 'meja kecil', x1: -3.6, x2: -2.9, z1: 3.6, z2: 4.3, h: 0.9, color: 0x3b2a1e },
  { name: 'meja makan', x1: 4.4, x2: 6.4, z1: 1.2, z2: 2.6, h: 0.9, color: 0x4a3322 },
  { name: 'kulkas', x1: 6.6, x2: 7.6, z1: 4.2, z2: 5.4, h: 1.9, color: 0x6b7280 },
  { name: 'rak piring', x1: 6.8, x2: 7.7, z1: -1.6, z2: 0.6, h: 1.6, color: 0x2b1f16 },
  { name: 'ranjang', x1: -7.5, x2: -5.3, z1: -9.4, z2: -7.2, h: 0.7, color: 0x3f2a2a },
  { name: 'lemari', x1: -7.8, x2: -6.4, z1: -5.0, z2: -3.4, h: 2.2, color: 0x2a1d14, hide: true },
  { name: 'laci', x1: -4.2, x2: -3.0, z1: -9.4, z2: -8.8, h: 0.9, color: 0x2b1f16 },
  { name: 'jam dinding', x1: -1.8, x2: -1.0, z1: -9.8, z2: -9.2, h: 2.4, color: 0x2b1f16 },
  { name: 'altar', x1: 4.2, x2: 5.8, z1: -8.8, z2: -7.6, h: 1.0, color: 0x1c1417 },
  { name: 'peti', x1: 6.2, x2: 7.6, z1: -9.2, z2: -8.2, h: 0.6, color: 0x3a1d14 }
];

// Lampu minyak di tiap ruangan (cahaya hangat yang bisa berkedip)
const LAMP_SPECS = [
  { x: 0, z: 1.5 }, { x: -5, z: 1.5 }, { x: 5, z: 1.5 },
  { x: -5, z: -6 }, { x: 0, z: -6 }, { x: 5, z: -6 }
];

// Benda yang bisa diambil. Catatan dan kunci mendorong cerita ke depan.
const ITEM_SPECS = [
  { id: 'note1', kind: 'note', title: 'Catatan Ayu #1', pos: [-6.4, 0.85, 3.4] },
  { id: 'bat1', kind: 'battery', pos: [7.2, 1.72, -0.5] },
  { id: 'photo', kind: 'photo', pos: [-3.25, 0.95, 3.95] },
  { id: 'bat2', kind: 'battery', pos: [1.2, 0.05, -4.5] },
  { id: 'bat3', kind: 'battery', pos: [-0.5, 0.05, 4.8] },
  { id: 'note2', kind: 'note', title: 'Catatan Ayu #2', pos: [-6.4, 0.75, -8.3] },
  { id: 'key', kind: 'key', pos: [-3.6, 0.95, -9.1] },
  { id: 'note3', kind: 'note', title: 'Catatan Ayu #3', pos: [6.6, 0.65, -8.2] }
];

const World = {
  scene: null, camera: null, renderer: null, flashlight: null,
  group: null,
  colliders: [],     // kotak tabrakan { x1, x2, z1, z2 }
  lamps: [],         // { light, base, flicker }
  items: [],         // { id, kind, title, pos, mesh, collected }
  sigils: [],        // gambar UV di dinding Ruang Ritual
  doorPivot: null,   // pintu terkunci (pivot untuk animasi buka)
  doorCollider: null,
  hideSpot: null     // posisi lemari untuk bersembunyi
};

function makeCanvasTexture(w, h, draw, rx, ry) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(rx, ry);
  return t;
}

function rnd(a, b) { return a + Math.random() * (b - a); }

const floorTex = makeCanvasTexture(256, 256, (g, w, h) => {
  g.fillStyle = '#171c27';
  g.fillRect(0, 0, w, h);
  for (let x = 0; x < w; x += 32) {
    g.fillStyle = `rgba(${rnd(24, 38) | 0}, ${rnd(28, 38) | 0}, ${rnd(40, 52) | 0}, 1)`;
    g.fillRect(x, 0, 32, h);
    g.fillStyle = 'rgba(0,0,0,0.6)';
    g.fillRect(x, 0, 2, h);
  }
  for (let i = 0; i < 900; i++) {
    g.fillStyle = `rgba(0,0,0,${rnd(0.05, 0.25)})`;
    g.fillRect(rnd(0, w), rnd(0, h), rnd(1, 3), rnd(1, 6));
  }
}, 4, 4);

const wallTex = makeCanvasTexture(256, 256, (g, w, h) => {
  g.fillStyle = '#1a2130';
  g.fillRect(0, 0, w, h);
  for (let x = 0; x < w; x += 16) {
    g.fillStyle = 'rgba(150, 170, 200, 0.05)';
    g.fillRect(x, 0, 6, h);
  }
  for (let i = 0; i < 26; i++) { // noda kelembapan
    const x = rnd(0, w), y = rnd(0, h), r = rnd(10, 40);
    const grd = g.createRadialGradient(x, y, 0, x, y, r);
    grd.addColorStop(0, 'rgba(0,0,0,0.45)');
    grd.addColorStop(1, 'rgba(0,0,0,0)');
    g.fillStyle = grd;
    g.fillRect(x - r, y - r, r * 2, r * 2);
  }
}, 2, 1);

const grassTex = makeCanvasTexture(128, 128, (g, w, h) => {
  g.fillStyle = '#0d1419';
  g.fillRect(0, 0, w, h);
  for (let i = 0; i < 1400; i++) {
    g.fillStyle = `rgba(${rnd(14, 30) | 0}, ${rnd(34, 56) | 0}, ${rnd(40, 60) | 0}, 0.7)`;
    g.fillRect(rnd(0, w), rnd(0, h), 1, rnd(2, 5));
  }
}, 30, 30);

const sigilTex = makeCanvasTexture(256, 256, (g) => {
  g.clearRect(0, 0, 256, 256);
  g.strokeStyle = '#e9d5ff';
  g.lineWidth = 4;
  g.beginPath(); g.arc(128, 128, 110, 0, Math.PI * 2); g.stroke();
  g.beginPath(); g.arc(128, 128, 80, 0, Math.PI * 2); g.stroke();
  g.beginPath();
  for (let i = 0; i < 5; i++) {
    const a = -Math.PI / 2 + (i * 2 * Math.PI) / 5;
    const b = -Math.PI / 2 + ((i + 2) * 2 * Math.PI) / 5;
    g.moveTo(128 + 110 * Math.cos(a), 128 + 110 * Math.sin(a));
    g.lineTo(128 + 110 * Math.cos(b), 128 + 110 * Math.sin(b));
  }
  g.stroke();
}, 1, 1);

function addBox(parent, x1, x2, y1, y2, z1, z2, mat, shadow = true) {
  const geo = new THREE.BoxGeometry(x2 - x1, y2 - y1, z2 - z1);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.set((x1 + x2) / 2, (y1 + y2) / 2, (z1 + z2) / 2);
  mesh.castShadow = shadow;
  mesh.receiveShadow = true;
  parent.add(mesh);
  return mesh;
}

function addTree(parent, x, z, s) {
  const trunk = new THREE.Mesh(
    new THREE.CylinderGeometry(0.22 * s, 0.3 * s, 3.5 * s, 8),
    new THREE.MeshStandardMaterial({ color: 0x1d140e, roughness: 1 })
  );
  trunk.position.set(x, 1.75 * s, z);
  trunk.castShadow = true;
  parent.add(trunk);
  const crown = new THREE.Mesh(
    new THREE.ConeGeometry(1.8 * s, 3.8 * s, 8),
    new THREE.MeshStandardMaterial({ color: 0x0b1a0d, roughness: 1 })
  );
  crown.position.set(x, 4.6 * s, z);
  crown.castShadow = true;
  parent.add(crown);
  World.colliders.push({ x1: x - 0.35, x2: x + 0.35, z1: z - 0.35, z2: z + 0.35 });
}

function makeItemMesh(kind) {
  const g = new THREE.Group();
  if (kind === 'note') {
    const m = new THREE.Mesh(
      new THREE.PlaneGeometry(0.22, 0.3),
      new THREE.MeshStandardMaterial({ color: 0xe9dcc0, emissive: 0x3a2f20, emissiveIntensity: 0.6, roughness: 0.9, side: THREE.DoubleSide })
    );
    m.rotation.x = -Math.PI / 2;
    m.position.y = 0.01;
    g.add(m);
  } else if (kind === 'battery') {
    const m = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 0.14, 10),
      new THREE.MeshStandardMaterial({ color: 0x9bd47a, emissive: 0x2f5a1c, emissiveIntensity: 0.8, roughness: 0.4 })
    );
    m.rotation.z = Math.PI / 2;
    g.add(m);
  } else if (kind === 'key') {
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.06, 0.016, 8, 16),
      new THREE.MeshStandardMaterial({ color: 0xc9a227, metalness: 0.8, roughness: 0.3 })
    );
    ring.rotation.x = Math.PI / 2;
    g.add(ring);
    const bar = new THREE.Mesh(
      new THREE.BoxGeometry(0.02, 0.02, 0.12),
      new THREE.MeshStandardMaterial({ color: 0xc9a227, metalness: 0.8, roughness: 0.3 })
    );
    bar.position.set(0, 0, 0.09);
    g.add(bar);
  } else if (kind === 'photo') {
    const frame = new THREE.Mesh(
      new THREE.BoxGeometry(0.3, 0.38, 0.03),
      new THREE.MeshStandardMaterial({ color: 0x3f2a14, roughness: 0.6 })
    );
    g.add(frame);
    const pic = new THREE.Mesh(
      new THREE.PlaneGeometry(0.22, 0.3),
      new THREE.MeshStandardMaterial({ color: 0x8f8778, emissive: 0x221c16, emissiveIntensity: 0.5 })
    );
    pic.position.z = 0.02;
    g.add(pic);
  }
  g.traverse(o => { if (o.isMesh) o.castShadow = false; });
  return g;
}

function buildWorld() {
  const s = World.scene;
  World.group = new THREE.Group();
  s.add(World.group);
  const g = World.group;
  World.colliders = [];
  World.lamps = [];
  World.items = [];
  World.sigils = [];

  // Tanah halaman
  const ground = new THREE.Mesh(
    new THREE.PlaneGeometry(90, 90),
    new THREE.MeshStandardMaterial({ map: grassTex, roughness: 1 })
  );
  ground.rotation.x = -Math.PI / 2;
  ground.receiveShadow = true;
  g.add(ground);

  // Lantai rumah dan langit-langit
  const floor = new THREE.Mesh(
    new THREE.PlaneGeometry(16.3, 16.3),
    new THREE.MeshStandardMaterial({ map: floorTex, roughness: 0.85, metalness: 0.05 })
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.set(0, 0.01, -2);
  floor.receiveShadow = true;
  g.add(floor);

  const ceiling = new THREE.Mesh(
    new THREE.PlaneGeometry(16.3, 16.3),
    new THREE.MeshStandardMaterial({ color: 0x0b0a0d, roughness: 1, side: THREE.DoubleSide })
  );
  ceiling.rotation.x = Math.PI / 2;
  ceiling.position.set(0, WALL_H, -2);
  g.add(ceiling);

  // Dinding
  const wallMat = new THREE.MeshStandardMaterial({ map: wallTex, roughness: 1 });
  WALL_BOXES.forEach(([x1, x2, z1, z2]) => {
    addBox(g, x1, x2, 0, WALL_H, z1, z2, wallMat);
    World.colliders.push({ x1, x2, z1, z2 });
  });

  // Pintu terkunci (pivot di engsel, sisi x = 2, z = -6)
  const doorMat = new THREE.MeshStandardMaterial({ color: 0x2a1a10, roughness: 0.8 });
  const pivot = new THREE.Group();
  pivot.position.set(2, 0, -6);
  const doorMesh = new THREE.Mesh(new THREE.BoxGeometry(0.12, 3.2, 2), doorMat);
  doorMesh.position.set(0, 1.6, 1);
  doorMesh.castShadow = true;
  pivot.add(doorMesh);
  g.add(pivot);
  World.doorPivot = pivot;
  World.doorCollider = { x1: LOCKED_DOOR.x1, x2: LOCKED_DOOR.x2, z1: LOCKED_DOOR.z1, z2: LOCKED_DOOR.z2 };
  World.colliders.push(World.doorCollider);

  // Perabot
  FURNITURE.forEach(f => {
    addBox(g, f.x1, f.x2, 0, f.h, f.z1, f.z2, new THREE.MeshStandardMaterial({ color: f.color, roughness: 0.9 }));
    World.colliders.push({ x1: f.x1, x2: f.x2, z1: f.z1, z2: f.z2 });
    if (f.hide) World.hideSpot = { x: (f.x1 + f.x2) / 2, z: (f.z1 + f.z2) / 2, facing: 0 };
  });

  // Gambar UV di dinding Ruang Ritual (hanya terlihat dalam mode UV)
  [[3.2, -9.8], [5.6, -9.8], [7.2, -9.8]].forEach(([x, z]) => {
    const mat = new THREE.MeshBasicMaterial({
      map: sigilTex, color: 0xa855f7, transparent: true, opacity: 0.9,
      depthWrite: false, blending: THREE.AdditiveBlending
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(0.9, 0.9), mat);
    m.position.set(x, 1.8, z + 0.02);
    m.visible = false;
    g.add(m);
    World.sigils.push(m);
  });

  // Lampu minyak
  LAMP_SPECS.forEach(spec => {
    const light = new THREE.PointLight(0xffa64d, 0.9, 9, 2);
    light.position.set(spec.x, 2.7, spec.z);
    g.add(light);
    const bulb = new THREE.Mesh(
      new THREE.SphereGeometry(0.07, 8, 8),
      new THREE.MeshBasicMaterial({ color: 0xffc770 })
    );
    bulb.position.copy(light.position);
    g.add(bulb);
    World.lamps.push({ light, bulb, base: 0.9, flicker: 0 });
  });

  // Pohon di halaman
  [[-9.5, 8.5, 1.1], [9.8, 9.5, 1.2], [-10.5, 12.5, 1.0], [8.5, 13.2, 0.9], [-4.6, 12.8, 1.3], [3.5, 13.8, 1.0]]
    .forEach(([x, z, s]) => addTree(g, x, z, s));

  // Benda yang bisa diambil
  ITEM_SPECS.forEach(spec => {
    const mesh = makeItemMesh(spec.kind);
    mesh.position.set(spec.pos[0], spec.pos[1], spec.pos[2]);
    g.add(mesh);
    World.items.push({ id: spec.id, kind: spec.kind, title: spec.title, pos: spec.pos, mesh, collected: false, t: Math.random() * 6 });
  });
}

function createRenderer(container) {
  World.scene = new THREE.Scene();
  World.scene.background = new THREE.Color(0x070b14);
  World.scene.fog = new THREE.FogExp2(0x0a1020, 0.065);

  World.camera = new THREE.PerspectiveCamera(72, window.innerWidth / window.innerHeight, 0.05, 120);
  World.camera.rotation.order = 'YXZ';
  World.camera.position.set(0, 1.6, 12);
  World.camera.rotation.y = 0; // kamera default menghadap -z, yaitu ke arah rumah

  World.renderer = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  World.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  World.renderer.setSize(window.innerWidth, window.innerHeight);
  World.renderer.shadowMap.enabled = true;
  World.renderer.shadowMap.type = THREE.PCFSoftShadowMap;
  container.appendChild(World.renderer.domElement);

  World.scene.add(new THREE.AmbientLight(0x1a2640, 0.6)); // cahaya bulan biru pucat

  World.flashlight = new THREE.SpotLight(0xfff5e6, 2.5, 22, Math.PI / 7, 0.5, 1.2);
  World.flashlight.castShadow = true;
  World.flashlight.shadow.mapSize.set(1024, 1024);
  World.flashlight.shadow.camera.near = 0.2;
  World.scene.add(World.flashlight);
  World.scene.add(World.flashlight.target);
}

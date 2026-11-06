// Kuntilanak (Ratih): patroli, mendengar, melihat, mengejar, mencari, dan mode bos di ruang ritual.

const GHOST = {
  RADIUS: 0.35,
  PATROL: 1.5,
  SEARCH: 2.0,
  CHASE: 2.7,
  BOSS: 2.5,
  SIGHT: 9,
  HEAR_WALK: 4,
  HEAR_SPRINT: 12,
  LOSE_TIME: 5,
  ATTACK_DIST: 1.25,
  STAGGER: 0.45,
  mult: 1 // pengali kecepatan dari tingkat kesulitan
};

// Rute patroli. Setiap langkah melewati celah dinding (lihat WALL_BOXES).
const GHOST_ROUTE = [
  { x: 0, z: 3 }, { x: -4, z: 2.8 }, { x: -4.6, z: -1 }, { x: -4.6, z: -5 },
  { x: -4.6, z: -1 }, { x: -4, z: 2.8 }, { x: 0, z: 2.8 }, { x: 0, z: -1 },
  { x: 0, z: -5 }, { x: 0, z: -1 }, { x: 0, z: 2.8 }, { x: 4, z: 2.8 }
];

function blockedAt(x, z, cols, r) {
  for (let i = 0; i < cols.length; i++) {
    const c = cols[i];
    if (x > c.x1 - r && x < c.x2 + r && z > c.z1 - r && z < c.z2 + r) return true;
  }
  return false;
}

class Ghost {
  constructor(scene) {
    this.group = new THREE.Group();
    this.x = 0;
    this.z = -5;
    this.state = 'dormant';   // dormant | patrol | chase | search | boss
    this.active = false;
    this.dead = false;
    this.hp = 100;
    this.t = 0;
    this.stagger = 0;
    this.lose = 0;
    this.searchT = 0;
    this.wp = 0;
    this.waitT = 0;
    this.stuckT = 0;
    this.lastSeen = { x: 0, z: 0 };
    this.lastX = 0;
    this.lastZ = 0;
    this.yaw = 0;
    this.eyeMats = [];
    this._build();
    this.group.visible = false;
    scene.add(this.group);
  }

  _build() {
    const g = this.group;
    const dress = new THREE.Mesh(
      new THREE.CylinderGeometry(0.12, 0.42, 1.55, 10),
      new THREE.MeshStandardMaterial({ color: 0xb9b6b0, roughness: 1, transparent: true, opacity: 0.92 })
    );
    dress.position.y = 0.85;
    g.add(dress);

    const head = new THREE.Mesh(
      new THREE.SphereGeometry(0.21, 14, 14),
      new THREE.MeshStandardMaterial({ color: 0xaeaaa3, roughness: 0.9 })
    );
    head.position.y = 1.72;
    g.add(head);

    const hairMat = new THREE.MeshBasicMaterial({ color: 0x030303 });
    const hairBack = new THREE.Mesh(new THREE.BoxGeometry(0.46, 1.9, 0.12), hairMat);
    hairBack.position.set(0, 1.0, -0.14);
    g.add(hairBack);
    const hairTop = new THREE.Mesh(new THREE.BoxGeometry(0.46, 0.22, 0.46), hairMat);
    hairTop.position.set(0, 1.9, 0);
    g.add(hairTop);
    [-0.2, 0.2].forEach(x => {
      const side = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1.2, 0.2), hairMat);
      side.position.set(x * 1.05, 1.4, 0.02);
      g.add(side);
    });

    const eyeMat = new THREE.MeshBasicMaterial({ color: 0xff2020, transparent: true, opacity: 0.0 });
    this.eyeMats.push(eyeMat);
    [-0.08, 0.08].forEach(x => {
      const eye = new THREE.Mesh(new THREE.SphereGeometry(0.03, 6, 6), eyeMat);
      eye.position.set(x, 1.7, 0.2);
      g.add(eye);
    });

    this.arms = [];
    [-0.3, 0.3].forEach(x => {
      const arm = new THREE.Mesh(
        new THREE.CylinderGeometry(0.035, 0.025, 1.0, 6),
        new THREE.MeshStandardMaterial({ color: 0xa8a49d, roughness: 1 })
      );
      arm.position.set(x, 1.25, 0.1);
      arm.rotation.x = -0.5;
      g.add(arm);
      this.arms.push(arm);
    });

    this.light = new THREE.PointLight(0x9ec5ff, 0.5, 4, 2);
    this.light.position.set(0, 1.4, 0.4);
    g.add(this.light);

    g.traverse(o => { if (o.isMesh) o.castShadow = false; });
  }

  // Aktifkan hantu di posisi tertentu. Ia mulai berpatroli.
  activate(x, z) {
    this.x = x;
    this.z = z;
    this.active = true;
    this.state = 'patrol';
    this.wp = 0;
    this.group.visible = true;
  }

  // Mode bos: selalu mengejar dan tidak bisa kehilangan jejak
  becomeBoss(x, z) {
    this.hp = 100;
    this.x = x;
    this.z = z;
    this.state = 'boss';
    this.active = true;
    this.group.visible = true;
  }

  setVisible(v) { this.group.visible = v; }

  // Cahaya UV atau serangan lain. Di mode bos, hantu benar-benar terluka.
  hurt(amount, dmgReal) {
    if (this.dead) return false;
    this.stagger = GHOST.STAGGER;
    if (dmgReal) this.hp -= amount;
    if (this.hp <= 0) {
      this.dead = true;
      return true;
    }
    return false;
  }

  // Hantu menghilang perlahan
  dissolve(onDone) {
    this.dead = true;
    this._dissolveT = 0;
    this._onDissolve = onDone;
  }

  _hasLOS(tx, tz, cols) {
    const dx = tx - this.x, dz = tz - this.z;
    const d = Math.hypot(dx, dz);
    const steps = Math.ceil(d / 0.2);
    for (let i = 1; i < steps; i++) {
      const px = this.x + dx * (i / steps);
      const pz = this.z + dz * (i / steps);
      for (let j = 0; j < cols.length; j++) {
        const c = cols[j];
        if (px > c.x1 && px < c.x2 && pz > c.z1 && pz < c.z2) return false;
      }
    }
    return true;
  }

  _moveTo(tx, tz, step, cols) {
    const dx = tx - this.x, dz = tz - this.z;
    const d = Math.hypot(dx, dz);
    if (d < 1e-4) return;
    const s = Math.min(step, d);
    const nx = this.x + (dx / d) * s;
    const nz = this.z + (dz / d) * s;
    // Geser per sumbu supaya hantu tidak macet di sudut dinding
    if (!blockedAt(nx, this.z, cols, GHOST.RADIUS)) this.x = nx;
    if (!blockedAt(this.x, nz, cols, GHOST.RADIUS)) this.z = nz;
    this.x = Math.max(ARENA.x1, Math.min(ARENA.x2, this.x));
    this.z = Math.max(ARENA.z1, Math.min(ARENA.z2, this.z));
  }

  // Dipanggil tiap frame. pl = { x, z, hidden, moving, sprinting }.
  // frozen = true saat cerita berjalan: animasi tetap jalan, AI berhenti.
  // Mengembalikan { spotted, attacking, state }.
  update(dt, pl, cols, frozen = false) {
    const out = { spotted: false, attacking: false, state: this.state };
    if (this.dead) {
      if (this._dissolveT !== undefined) {
        this._dissolveT += dt;
        const k = Math.max(0, 1 - this._dissolveT / 1.4);
        this.group.scale.setScalar(k);
        this.eyeMats.forEach(m => { m.opacity = k * 0.8; });
        if (this._dissolveT >= 1.4) {
          this.group.visible = false;
          const cb = this._onDissolve;
          this._onDissolve = null;
          if (cb) cb();
        }
      }
      return out;
    }
    if (!this.active) return out;
    if (frozen) return out;

    this.t += dt;
    this.group.position.set(this.x, 0.05 + Math.sin(this.t * 2) * 0.07, this.z);
    this.arms.forEach((a, i) => { a.rotation.x = -0.5 + Math.sin(this.t * 1.7 + i) * 0.12; });
    this.light.intensity = 0.4 + Math.sin(this.t * 9) * 0.08;

    const pdx = pl.x - this.x, pdz = pl.z - this.z;
    const dist = Math.hypot(pdx, pdz);
    const isChasing = this.state === 'chase' || this.state === 'boss';

    // Warna mata menyala saat mengejar
    const eyeTarget = isChasing ? 0.9 : 0.0;
    this.eyeMats.forEach(m => { m.opacity += (eyeTarget - m.opacity) * Math.min(1, dt * 6); });

    if (this.stagger > 0) {
      this.stagger -= dt;
      return out;
    }

    if (this.state !== 'boss') {
      const seen = !pl.hidden && dist < GHOST.SIGHT && this._hasLOS(pl.x, pl.z, cols);
      const heard = !pl.hidden && pl.moving && (dist < GHOST.HEAR_WALK || (pl.sprinting && dist < GHOST.HEAR_SPRINT));
      if (seen || heard) {
        if (this.state !== 'chase' && seen) out.spotted = true;
        this.state = 'chase';
        this.lastSeen = { x: pl.x, z: pl.z };
        this.lose = GHOST.LOSE_TIME;
      } else if (this.state === 'chase') {
        this.lose -= dt;
        if (this.lose <= 0) { this.state = 'search'; this.searchT = 6; }
      } else if (this.state === 'search') {
        this.searchT -= dt;
        if (this.searchT <= 0) this.state = 'patrol';
      }
    }

    let tx = null, tz = null, speed = GHOST.PATROL;
    if (this.state === 'boss') {
      tx = pl.x; tz = pl.z; speed = GHOST.BOSS;
    } else if (this.state === 'chase') {
      tx = pl.x; tz = pl.z; speed = GHOST.CHASE;
    } else if (this.state === 'search') {
      tx = this.lastSeen.x; tz = this.lastSeen.z; speed = GHOST.SEARCH;
    } else {
      // Patroli: berjalan ke titik rute, berhenti sebentar di setiap titik
      const w = GHOST_ROUTE[this.wp];
      if (this.waitT > 0) {
        this.waitT -= dt;
      } else {
        const wd = Math.hypot(w.x - this.x, w.z - this.z);
        if (wd < 0.3) {
          this.wp = (this.wp + 1) % GHOST_ROUTE.length;
          this.waitT = 1.6;
          this.stuckT = 0;
        } else {
          tx = w.x; tz = w.z;
          // Lewati titik jika macet terlalu lama
          const moved = Math.hypot(this.x - this.lastX, this.z - this.lastZ);
          this.stuckT = moved < 0.01 ? this.stuckT + dt : 0;
          if (this.stuckT > 1.5) { this.wp = (this.wp + 1) % GHOST_ROUTE.length; this.stuckT = 0; }
        }
      }
    }

    this.lastX = this.x;
    this.lastZ = this.z;
    if (tx !== null) {
      this._moveTo(tx, tz, speed * GHOST.mult * dt, cols);
      const mdx = tx - this.x, mdz = tz - this.z;
      if (Math.hypot(mdx, mdz) > 0.05) {
        const targetYaw = Math.atan2(mdx, mdz);
        let diff = targetYaw - this.yaw;
        diff = Math.atan2(Math.sin(diff), Math.cos(diff));
        this.yaw += diff * Math.min(1, dt * 5);
        this.group.rotation.y = this.yaw;
      }
    }

    out.state = this.state;
    out.attacking = (this.state === 'chase' || this.state === 'boss') && dist < GHOST.ATTACK_DIST && !pl.hidden;
    return out;
  }
}

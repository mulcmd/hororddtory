// Audio sintetis (Web Audio API). Tidak ada file suara, semua dibuat dari osilator dan noise.
class SoundEngine {
  constructor() {
    this.ctx = null;
    this.master = null;
    this.noiseBuf = null;
    this.droneGain = null;
    this.heartRate = 0;      // BPM; 0 = jantung diam
    this.heartTimer = 0;
    this.muted = false;
  }

  init() {
    if (this.ctx) {
      if (this.ctx.state === 'suspended') this.ctx.resume();
      return;
    }
    try {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      this.ctx = new AC();
      this.master = this.ctx.createGain();
      this.master.gain.value = 0.8;
      this.master.connect(this.ctx.destination);
      this._makeNoise();
      this._startDrone();
    } catch (e) {
      this.ctx = null; // Tanpa audio pun game tetap bisa dimainkan
    }
  }

  _makeNoise() {
    const len = this.ctx.sampleRate * 2;
    const buf = this.ctx.createBuffer(1, len, this.ctx.sampleRate);
    const data = buf.getChannelData(0);
    for (let i = 0; i < len; i++) data[i] = Math.random() * 2 - 1;
    this.noiseBuf = buf;
  }

  // Dengung rendah yang bergeser pelan, membuat udara terasa berat
  _startDrone() {
    const c = this.ctx;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 180;
    this.droneGain = c.createGain();
    this.droneGain.gain.value = 0.12;
    lp.connect(this.droneGain);
    this.droneGain.connect(this.master);

    [41, 41.6, 62].forEach((f, i) => {
      const o = c.createOscillator();
      o.type = i === 2 ? 'triangle' : 'sine';
      o.frequency.value = f;
      o.connect(lp);
      o.start();
    });

    // LFO pelan untuk filter, supaya dengungnya seperti bernapas
    const lfo = c.createOscillator();
    const lfoGain = c.createGain();
    lfo.frequency.value = 0.07;
    lfoGain.gain.value = 70;
    lfo.connect(lfoGain);
    lfoGain.connect(lp.frequency);
    lfo.start();
  }

  // Dipanggil tiap frame. bpm > 0 membuat detak jantung, 0 mematikannya.
  update(dt, bpm) {
    if (!this.ctx) return;
    this.heartRate = bpm;
    if (bpm <= 0) return;
    this.heartTimer -= dt;
    if (this.heartTimer <= 0) {
      this._thump(0);
      this._thump(0.18); // dua ketukan seperti jantung sungguhan
      this.heartTimer = 60 / bpm;
    }
  }

  _thump(delay) {
    const c = this.ctx;
    const t = c.currentTime + delay;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sine';
    o.frequency.setValueAtTime(90, t);
    o.frequency.exponentialRampToValueAtTime(40, t + 0.15);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.5, t + 0.02);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.25);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + 0.3);
  }

  // Bisikan: noise yang difilter band-pass dengan amplitudo naik-turun
  whisper(pan = 0) {
    if (!this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    const bp = c.createBiquadFilter();
    bp.type = 'bandpass';
    bp.frequency.setValueAtTime(900 + Math.random() * 900, t);
    bp.frequency.linearRampToValueAtTime(500 + Math.random() * 400, t + 1.8);
    bp.Q.value = 6;
    const g = c.createGain();
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.18, t + 0.5);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 1.8);
    src.connect(bp);
    bp.connect(g);
    this._out(g, pan);
    src.start(t, Math.random());
    src.stop(t + 1.9);
  }

  // Pintu berderit
  creak() {
    if (!this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(140, t);
    o.frequency.linearRampToValueAtTime(260, t + 1.2);
    o.frequency.linearRampToValueAtTime(120, t + 2.0);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.07, t + 0.3);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 2.0);
    o.connect(g);
    this._out(g, 0);
    o.start(t);
    o.stop(t + 2.1);
  }

  // Pintu dibanting
  slam() {
    if (!this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime;
    const src = c.createBufferSource();
    src.buffer = this.noiseBuf;
    const lp = c.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.setValueAtTime(900, t);
    lp.frequency.exponentialRampToValueAtTime(80, t + 0.4);
    const g = c.createGain();
    g.gain.setValueAtTime(0.9, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.5);
    src.connect(lp);
    lp.connect(g);
    g.connect(this.master);
    src.start(t);
    src.stop(t + 0.6);
  }

  // Jeritan melengking saat hantu melihatmu
  screech() {
    if (!this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime;
    const o = c.createOscillator();
    const lfo = c.createOscillator();
    const lfoG = c.createGain();
    const g = c.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(600, t);
    o.frequency.exponentialRampToValueAtTime(1400, t + 0.6);
    lfo.frequency.value = 9;
    lfoG.gain.value = 60;
    lfo.connect(lfoG);
    lfoG.connect(o.frequency);
    g.gain.setValueAtTime(0.0001, t);
    g.gain.exponentialRampToValueAtTime(0.16, t + 0.08);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.9);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    lfo.start(t);
    o.stop(t + 1.0);
    lfo.stop(t + 1.0);
  }

  // Sengatan keras untuk jumpscare
  sting() {
    if (!this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'sawtooth';
    o.frequency.setValueAtTime(300, t);
    o.frequency.exponentialRampToValueAtTime(1200, t + 0.3);
    g.gain.setValueAtTime(0.35, t);
    g.gain.exponentialRampToValueAtTime(0.01, t + 0.3);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + 0.32);
    this.slam();
  }

  // Sinar UV menyentuh hantu
  uvBeam() {
    if (!this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'square';
    o.frequency.setValueAtTime(800, t);
    o.frequency.linearRampToValueAtTime(150, t + 0.15);
    g.gain.setValueAtTime(0.05, t);
    g.gain.exponentialRampToValueAtTime(0.01, t + 0.15);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + 0.16);
  }

  // Nada kecil untuk ambil barang / catatan
  chime() {
    if (!this.ctx) return;
    const c = this.ctx;
    [660, 880, 990].forEach((f, i) => {
      const t = c.currentTime + i * 0.09;
      const o = c.createOscillator();
      const g = c.createGain();
      o.type = 'sine';
      o.frequency.value = f;
      g.gain.setValueAtTime(0.0001, t);
      g.gain.exponentialRampToValueAtTime(0.12, t + 0.02);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.6);
      o.connect(g);
      g.connect(this.master);
      o.start(t);
      o.stop(t + 0.65);
    });
  }

  // Klik pelan saat senter dinyalakan/dimatikan
  click() {
    if (!this.ctx) return;
    const c = this.ctx;
    const t = c.currentTime;
    const o = c.createOscillator();
    const g = c.createGain();
    o.type = 'square';
    o.frequency.value = 1800;
    g.gain.setValueAtTime(0.03, t);
    g.gain.exponentialRampToValueAtTime(0.0001, t + 0.03);
    o.connect(g);
    g.connect(this.master);
    o.start(t);
    o.stop(t + 0.04);
  }

  _out(node, pan) {
    const c = this.ctx;
    if (c.createStereoPanner) {
      const p = c.createStereoPanner();
      p.pan.value = Math.max(-1, Math.min(1, pan));
      node.connect(p);
      p.connect(this.master);
    } else {
      node.connect(this.master);
    }
  }
}

const audioSys = new SoundEngine();

import { rainParams } from './settings.js';
// Процедурный звук: шум дождя (две полосы) + редкие капли и тихий городской гул. Уровни низкие.
export class Ambience {
  constructor() { this.ctx = null; this.vol = 0.5; this.rain = 0.5; }
  start() {
    if (this.ctx) { if (this.ctx.state !== 'running') this.ctx.resume(); return; }
    const ctx = (this.ctx = new (window.AudioContext || window.webkitAudioContext)());
    this.master = ctx.createGain(); const lim = ctx.createDynamicsCompressor(); lim.threshold.value = -12; lim.ratio.value = 8;
    this.master.connect(lim).connect(ctx.destination);
    const noise = (this.noise = this.buf((d) => { for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1; }));
    const brown = this.buf((d) => { let l = 0; for (let i = 0; i < d.length; i++) { l = (l + 0.02 * (Math.random() * 2 - 1)) / 1.02; d[i] = l * 3.5; } });
    const src = (b) => { const s = ctx.createBufferSource(); s.buffer = b; s.loop = true; s.start(); return s; };
    const hp = ctx.createBiquadFilter(); hp.type = 'highpass'; hp.frequency.value = 900;
    this.lp = ctx.createBiquadFilter(); this.lp.type = 'lowpass'; this.lp.frequency.value = 5000;
    this.hi = ctx.createGain(); this.hi.gain.value = 0; src(noise).connect(hp).connect(this.lp).connect(this.hi).connect(this.master);
    const bp = ctx.createBiquadFilter(); bp.type = 'bandpass'; bp.frequency.value = 420; bp.Q.value = 0.6;
    this.lo = ctx.createGain(); this.lo.gain.value = 0; src(brown).connect(bp).connect(this.lo).connect(this.master);
    const hlp = ctx.createBiquadFilter(); hlp.type = 'lowpass'; hlp.frequency.value = 140;
    this.hum = ctx.createGain(); this.hum.gain.value = 0.012; src(brown).connect(hlp).connect(this.hum).connect(this.master);
    this.apply(); this.next = ctx.currentTime; this.timer = setInterval(() => this.schedule(), 100);
  }
  click() { if (!this.ctx) return; const ctx = this.ctx, t = ctx.currentTime, s = ctx.createBufferSource(); s.buffer = this.noise;
    const f = ctx.createBiquadFilter(); f.type = 'highpass'; f.frequency.value = 2500; const g = ctx.createGain();
    g.gain.setValueAtTime(0.08, t); g.gain.exponentialRampToValueAtTime(0.001, t + 0.025); s.connect(f).connect(g).connect(this.master); s.start(t, Math.random() * 3, 0.03); }
  buf(fill) { const b = this.ctx.createBuffer(1, this.ctx.sampleRate * 4, this.ctx.sampleRate); fill(b.getChannelData(0)); return b; }
  set(vol, rain) { this.vol = vol; this.rain = rain; this.apply(); }
  apply() {
    if (!this.ctx) return; const t = this.ctx.currentTime, R = rainParams(this.rain);
    this.master.gain.setTargetAtTime(this.vol * 1.2, t, 0.15);
    this.hi.gain.setTargetAtTime(R.soundGain, t, 1); this.lo.gain.setTargetAtTime(R.soundGain * 0.6, t, 1); this.lp.frequency.setTargetAtTime(R.soundCutoff, t, 1);
  }
  schedule() {
    const ctx = this.ctx, t = ctx.currentTime; if (this.rain < 0.02) { this.next = t; return; }
    while (this.next < t + 0.2) {
      const s = ctx.createBufferSource(); s.buffer = this.noise; const f = ctx.createBiquadFilter(); f.type = 'bandpass'; f.frequency.value = 1800 + Math.random() * 3000; f.Q.value = 5;
      const g = ctx.createGain(); g.gain.setValueAtTime(0.015 + Math.random() * 0.03, this.next); g.gain.exponentialRampToValueAtTime(0.0001, this.next + 0.025);
      s.connect(f).connect(g).connect(this.master); s.start(Math.max(this.next, t), Math.random() * 3, 0.03);
      this.next += -Math.log(1 - Math.random()) * (0.4 - 0.34 * this.rain);
    }
  }
}

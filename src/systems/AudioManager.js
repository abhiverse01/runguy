export class AudioManager {
  constructor(){
    this.ctx = null;
    this.muted = false;
  }

  ensure(){ if (!this.ctx) this.ctx = new (window.AudioContext || window.webkitAudioContext)(); }

  toggleMute(){ this.muted = !this.muted; return this.muted; }

  tone(freq, dur, type = 'sine', gainStart = 0.16, glideTo = null){
    if (this.muted) return;
    this.ensure();
    const ctx = this.ctx;
    const o = ctx.createOscillator(), g = ctx.createGain();
    o.type = type; o.frequency.setValueAtTime(freq, ctx.currentTime);
    if (glideTo) o.frequency.exponentialRampToValueAtTime(glideTo, ctx.currentTime + dur);
    g.gain.setValueAtTime(gainStart, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    o.connect(g); g.connect(ctx.destination);
    o.start(); o.stop(ctx.currentTime + dur);
  }

  noiseBurst(dur = 0.12, gainStart = 0.1){
    if (this.muted) return;
    this.ensure();
    const ctx = this.ctx;
    const bufferSize = ctx.sampleRate * dur;
    const buffer = ctx.createBuffer(1, bufferSize, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) data[i] = (Math.random() * 2 - 1) * (1 - i / bufferSize);
    const src = ctx.createBufferSource(); src.buffer = buffer;
    const g = ctx.createGain(); g.gain.setValueAtTime(gainStart, ctx.currentTime);
    g.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + dur);
    src.connect(g); g.connect(ctx.destination);
    src.start();
  }

  footstep(){ this.noiseBurst(0.06, 0.035); }
  splash(){ this.noiseBurst(0.18, 0.09); this.tone(220, 0.15, 'sine', 0.05, 140); }
  jump(){ this.tone(340, 0.14, 'triangle', 0.08, 520); }
  land(strength = 1){ this.noiseBurst(0.08, 0.05 * Math.min(Math.max(strength, 0.3), 1.8)); }
  orb(){ this.tone(660, 0.12, 'sine', 0.1, 990); this.tone(990, 0.16, 'sine', 0.07, 1320); }
  quest(){ this.tone(392, 0.14, 'triangle', 0.09, 523); setTimeout(() => this.tone(523, 0.18, 'triangle', 0.09, 659), 120); }
  finale(){ [523, 659, 784, 1047].forEach((f, i) => setTimeout(() => this.tone(f, 0.28, 'triangle', 0.1, f * 1.25), i * 130)); }
  dash(){ this.noiseBurst(0.1, 0.06); this.tone(180, 0.12, 'sawtooth', 0.07, 60); }
  doubleJump(){ this.tone(460, 0.1, 'triangle', 0.09, 720); this.tone(720, 0.12, 'sine', 0.06, 980); }
  slamCharge(){ this.tone(220, 0.08, 'square', 0.05, 90); }
  slamImpact(){ this.noiseBurst(0.22, 0.14); this.tone(90, 0.22, 'sine', 0.1, 45); }
}

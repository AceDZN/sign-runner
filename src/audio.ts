// Procedural synthwave beat and sound effects (WebAudio, no files). The music is
// scheduled from the simulation clock so gates land on the beat.

const NOTE = (n: number) => 440 * Math.pow(2, (n - 69) / 12);
// A minor → F → C → G, one chord per bar (root MIDI notes)
const PROG = [45, 41, 48, 43];
const CHORD = [0, 3, 7];
const CHORD_MAJ = [0, 4, 7];

export class Audio {
  private ctx: AudioContext | null = null;
  private master!: GainNode;
  private music!: GainNode;
  private sfx!: GainNode;
  private filter!: BiquadFilterNode;
  private noise!: AudioBuffer;
  private nextStep = 0;
  muted = false;
  private duck = 1;

  /** Must be called from a user gesture. */
  unlock(): void {
    if (this.ctx) { if (this.ctx.state === 'suspended') void this.ctx.resume(); return; }
    const Ctx = window.AudioContext || (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
    if (!Ctx) return;
    const ctx = new Ctx();
    this.ctx = ctx;
    this.master = ctx.createGain();
    this.master.gain.value = this.muted ? 0 : 0.8;
    this.filter = ctx.createBiquadFilter();
    this.filter.type = 'lowpass';
    this.filter.frequency.value = 18000;
    this.filter.Q.value = 0.8;
    this.music = ctx.createGain();
    this.music.gain.value = 0.55;
    this.sfx = ctx.createGain();
    this.sfx.gain.value = 0.8;
    this.music.connect(this.filter);
    this.sfx.connect(this.filter);
    this.filter.connect(this.master);
    this.master.connect(ctx.destination);
    const len = ctx.sampleRate;
    this.noise = ctx.createBuffer(1, len, ctx.sampleRate);
    const d = this.noise.getChannelData(0);
    for (let i = 0; i < len; i++) d[i] = Math.random() * 2 - 1;
  }

  setMuted(m: boolean): void {
    this.muted = m;
    if (this.ctx) this.master.gain.setTargetAtTime(m ? 0 : 0.8, this.ctx.currentTime, 0.05);
  }

  suspend(): void { if (this.ctx && this.ctx.state === 'running') void this.ctx.suspend(); }
  resume(): void { if (this.ctx && this.ctx.state === 'suspended') void this.ctx.resume(); }

  /** 0 = in the air, 1 = deep underwater: muffles everything. */
  setUnder(k: number, ice = false): void {
    if (!this.ctx) return;
    const f = ice ? 18000 - k * 15000 : 18000 * Math.pow(700 / 18000, k);
    this.filter.frequency.setTargetAtTime(f, this.ctx.currentTime, 0.08);
  }

  resetMusic(beat: number): void { this.nextStep = Math.ceil(beat * 2); }

  /**
   * Called every frame with the current beat position from the sim clock.
   * Schedules 8th-note steps slightly ahead.
   */
  tickMusic(beat: number, beatSec: number, intensity: number): void {
    const ctx = this.ctx;
    if (!ctx || ctx.state !== 'running') return;
    if (this.nextStep < beat * 2 - 4) this.nextStep = Math.ceil(beat * 2); // after a pause or jump
    const ahead = 0.12 / beatSec; // in beats
    while (this.nextStep / 2 <= beat + ahead) {
      const s = this.nextStep;
      const when = ctx.currentTime + Math.max(0, (s / 2 - beat) * beatSec);
      this.step(s, when, beatSec, intensity);
      this.nextStep++;
    }
  }

  private step(s: number, when: number, beatSec: number, intensity: number): void {
    const bar = Math.floor(s / 8);
    const inBar = s % 8;
    const root = PROG[bar % 4];
    const chord = bar % 4 === 0 ? CHORD : CHORD_MAJ;
    if (inBar % 2 === 0) this.kick(when);
    if (inBar === 2 || inBar === 6) this.clap(when);
    this.hat(when, inBar % 2 === 1 ? 0.12 : 0.06);
    // bass: root on the beat, octave on the off-beat
    this.bass(NOTE(root + (inBar % 2 ? 12 : 0)), when, beatSec * 0.45);
    // arpeggio comes in with the combo
    if (intensity > 0) {
      const n = root + 24 + chord[inBar % 3] + (inBar >= 6 ? 12 : 0);
      this.pluck(NOTE(n), when, beatSec * 0.4, 0.05 + intensity * 0.04);
    }
    if (inBar === 0) this.pad(root, chord, when, beatSec * 4);
  }

  private env(g: GainNode, when: number, peak: number, attack: number, decay: number): void {
    g.gain.setValueAtTime(0.0001, when);
    g.gain.exponentialRampToValueAtTime(peak, when + attack);
    g.gain.exponentialRampToValueAtTime(0.0001, when + attack + decay);
  }

  private kick(when: number): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    const g = ctx.createGain();
    o.frequency.setValueAtTime(150, when);
    o.frequency.exponentialRampToValueAtTime(42, when + 0.12);
    this.env(g, when, 0.9 * this.duck, 0.003, 0.28);
    o.connect(g).connect(this.music);
    o.start(when);
    o.stop(when + 0.35);
  }

  private noiseHit(when: number, type: BiquadFilterType, freq: number, peak: number, decay: number, dest: AudioNode): void {
    const ctx = this.ctx!;
    const src = ctx.createBufferSource();
    src.buffer = this.noise;
    const f = ctx.createBiquadFilter();
    f.type = type;
    f.frequency.value = freq;
    const g = ctx.createGain();
    this.env(g, when, peak, 0.002, decay);
    src.connect(f).connect(g).connect(dest);
    src.start(when, Math.random() * 0.5);
    src.stop(when + decay + 0.05);
  }

  private clap(when: number): void { this.noiseHit(when, 'bandpass', 1600, 0.35, 0.16, this.music); }
  private hat(when: number, peak: number): void { this.noiseHit(when, 'highpass', 8000, peak, 0.04, this.music); }

  private bass(freq: number, when: number, dur: number): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = 'sawtooth';
    o.frequency.value = freq;
    const f = ctx.createBiquadFilter();
    f.type = 'lowpass';
    f.frequency.setValueAtTime(900, when);
    f.frequency.exponentialRampToValueAtTime(220, when + dur);
    const g = ctx.createGain();
    this.env(g, when, 0.28, 0.01, dur);
    o.connect(f).connect(g).connect(this.music);
    o.start(when);
    o.stop(when + dur + 0.05);
  }

  private pluck(freq: number, when: number, dur: number, peak: number): void {
    const ctx = this.ctx!;
    const o = ctx.createOscillator();
    o.type = 'square';
    o.frequency.value = freq;
    const g = ctx.createGain();
    this.env(g, when, peak, 0.005, dur);
    o.connect(g).connect(this.music);
    o.start(when);
    o.stop(when + dur + 0.05);
  }

  private pad(root: number, chord: number[], when: number, dur: number): void {
    const ctx = this.ctx!;
    for (const iv of chord) {
      for (const det of [-7, 7]) {
        const o = ctx.createOscillator();
        o.type = 'sawtooth';
        o.frequency.value = NOTE(root + 12 + iv);
        o.detune.value = det;
        const f = ctx.createBiquadFilter();
        f.type = 'lowpass';
        f.frequency.value = 1100;
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, when);
        g.gain.linearRampToValueAtTime(0.022, when + dur * 0.3);
        g.gain.linearRampToValueAtTime(0.0001, when + dur);
        o.connect(f).connect(g).connect(this.music);
        o.start(when);
        o.stop(when + dur + 0.05);
      }
    }
  }

  // ---------------------------------------------------------------- sfx
  private now(): number { return this.ctx ? this.ctx.currentTime : 0; }

  private tone(freq: number, to: number, dur: number, type: OscillatorType, peak: number, delay = 0): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const when = this.now() + delay;
    const o = ctx.createOscillator();
    o.type = type;
    o.frequency.setValueAtTime(freq, when);
    o.frequency.exponentialRampToValueAtTime(Math.max(20, to), when + dur);
    const g = ctx.createGain();
    this.env(g, when, peak, 0.005, dur);
    o.connect(g).connect(this.sfx);
    o.start(when);
    o.stop(when + dur + 0.05);
  }

  lane(): void { this.tone(900, 1200, 0.05, 'triangle', 0.06); }

  /** Pitch follows the new altitude: up when you rise, down when you sink. */
  gate(from: number, to: number): void {
    const base = 520 * Math.pow(2, Math.max(-24, Math.min(24, to)) / 24);
    const start = 520 * Math.pow(2, Math.max(-24, Math.min(24, from)) / 24);
    this.tone(start, base, 0.18, 'square', 0.12);
    this.tone(base * 1.5, base * 1.5, 0.12, 'sine', 0.08, 0.06);
  }

  pass(combo: number): void {
    if (!this.ctx) return;
    this.noiseHit(this.now(), 'bandpass', 2400, 0.25, 0.35, this.sfx);
    const root = 72 + Math.min(12, combo);
    [0, 4, 7, 12].forEach((iv, i) => this.tone(NOTE(root + iv), NOTE(root + iv), 0.22, 'triangle', 0.09, i * 0.035));
  }

  crash(): void {
    if (!this.ctx) return;
    const t = this.now();
    this.noiseHit(t, 'lowpass', 3000, 0.9, 0.6, this.sfx);
    this.noiseHit(t + 0.02, 'highpass', 5000, 0.4, 0.35, this.sfx);
    this.tone(160, 40, 0.5, 'sawtooth', 0.4);
    // record-scratch slowdown on the music
    this.music.gain.cancelScheduledValues(t);
    this.music.gain.setValueAtTime(0.55, t);
    this.music.gain.linearRampToValueAtTime(0.12, t + 0.3);
    this.music.gain.linearRampToValueAtTime(0.55, t + 1.6);
  }

  respawn(): void { this.tone(300, 1200, 0.25, 'sine', 0.15); }
  hint(): void { [0, 7, 12].forEach((iv, i) => this.tone(NOTE(84 + iv), NOTE(84 + iv), 0.3, 'sine', 0.05, i * 0.05)); }
  splash(): void { if (this.ctx) this.noiseHit(this.now(), 'bandpass', 900, 0.4, 0.5, this.sfx); }

  fanfare(): void {
    [60, 64, 67, 72, 76, 79, 84].forEach((n, i) => this.tone(NOTE(n), NOTE(n), 0.35, 'square', 0.08, i * 0.08));
  }
}

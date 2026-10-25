// DOM HUD over the canvas. Hebrew RTL layout; every number is in an LTR span.
import { signed, expression, ruleHe, num, Op } from './rules';
import type { Explanation } from './sim';

const $ = <T extends HTMLElement = HTMLElement>(id: string) => document.getElementById(id) as T;
const SVGNS = 'http://www.w3.org/2000/svg';

function el<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Record<string, string | number>, parent?: Element): SVGElementTagNameMap[K] {
  const e = document.createElementNS(SVGNS, tag);
  for (const [k, v] of Object.entries(attrs)) e.setAttribute(k, String(v));
  parent?.appendChild(e);
  return e;
}

const RULER_H = 560;
const COL_X = 22;
const COL_W = 108;
const RANGE = 40;

export class Hud {
  private ruler = $('ruler') as unknown as SVGSVGElement;
  private ticks!: SVGGElement;
  private marker!: SVGGElement;
  private target!: SVGGElement;
  private targetVal!: SVGTextElement;
  private targetWord!: SVGTextElement;
  private trail!: SVGPolylineElement;
  private mercury!: SVGRectElement;
  private unitLabel!: SVGTextElement;
  private center = 0;
  private span = 15;
  private history: number[] = [];
  private ice = false;
  private readout = $('readout');
  private lastValue = NaN;
  private lastScore = -1;
  private lastCombo = -1;

  constructor() {
    this.ruler.setAttribute('viewBox', `0 0 330 ${RULER_H}`);
    this.buildRuler();
  }

  private buildRuler(): void {
    const r = this.ruler;
    r.innerHTML = '';
    const defs = el('defs', {}, r);
    const clip = el('clipPath', { id: 'rclip' }, defs);
    el('rect', { x: 0, y: 6, width: 330, height: RULER_H - 12 }, clip);
    const grad = el('linearGradient', { id: 'pillar', x1: 0, x2: 1, y1: 0, y2: 0 }, defs);
    el('stop', { offset: 0, 'stop-color': '#1a0b3a' }, grad);
    el('stop', { offset: 0.5, 'stop-color': '#2b1660' }, grad);
    el('stop', { offset: 1, 'stop-color': '#12062a' }, grad);
    el('rect', { x: COL_X, y: 4, width: COL_W, height: RULER_H - 8, rx: 16, fill: 'url(#pillar)', stroke: '#ff2fb3', 'stroke-width': 3, opacity: 0.92 }, r);
    this.mercury = el('rect', { x: COL_X + 12, y: 0, width: 12, height: 0, rx: 6, fill: '#ff3355', opacity: 0 }, r);
    this.unitLabel = el('text', { x: COL_X + COL_W / 2, y: 34, 'font-size': 28, fill: '#fff', 'text-anchor': 'middle', opacity: 0 }, r);
    this.unitLabel.textContent = '°C';
    const g = el('g', { 'clip-path': 'url(#rclip)' }, r);
    this.ticks = el('g', {}, g);
    for (let v = -RANGE; v <= RANGE; v++) {
      const t = el('g', { 'data-v': v }, this.ticks);
      const major = v === 0;
      el('line', { x1: COL_X + 16, x2: COL_X + (major ? 58 : 42), y1: 0, y2: 0, stroke: major ? '#3cf2ff' : '#fff', 'stroke-width': major ? 6 : 4, 'stroke-linecap': 'round' }, t);
      const label = el('text', { x: COL_X + COL_W - 8, y: 0, 'font-size': major ? 34 : 27, fill: major ? '#3cf2ff' : '#fff', 'text-anchor': 'end', 'dominant-baseline': 'central' }, t);
      label.textContent = signed(v);
    }
    this.trail = el('polyline', { fill: 'none', stroke: '#9ff6ff', 'stroke-width': 3, 'stroke-dasharray': '2 0', opacity: 0.85, 'clip-path': 'url(#rclip)' }, r);
    this.target = el('g', {}, r);
    el('rect', { x: COL_X + 4, y: -22, width: COL_W - 8, height: 44, rx: 10, fill: 'none', stroke: '#ff2fb3', 'stroke-width': 5 }, this.target);
    el('path', { d: `M ${COL_X + COL_W} 0 L ${COL_X + COL_W + 18} -10 L ${COL_X + COL_W + 18} 10 Z`, fill: '#ff2fb3' }, this.target);
    el('rect', { x: COL_X + COL_W + 18, y: -24, width: 168, height: 48, rx: 14, fill: 'rgba(18,5,38,0.85)', stroke: '#ff2fb3', 'stroke-width': 3 }, this.target);
    this.targetWord = el('text', { x: COL_X + COL_W + 176, y: 1, 'font-size': 24, fill: '#fff', 'text-anchor': 'end', 'dominant-baseline': 'central', 'font-weight': 700 }, this.target);
    this.targetWord.textContent = 'מנהרה:';
    this.targetVal = el('text', { x: COL_X + COL_W + 30, y: 1, 'font-size': 27, fill: '#ffd6f5', 'text-anchor': 'start', 'dominant-baseline': 'central' }, this.target);
    this.marker = el('g', {}, r);
    el('path', { d: `M ${COL_X - 18} -12 L ${COL_X + 10} -12 L ${COL_X + 10} -20 L ${COL_X + 28} 0 L ${COL_X + 10} 20 L ${COL_X + 10} 12 L ${COL_X - 18} 12 Z`, fill: '#3cf2ff', stroke: '#fff', 'stroke-width': 2 }, this.marker);
  }

  setTheme(ice: boolean): void {
    this.ice = ice;
    document.body.classList.toggle('ice', ice);
    this.mercury.setAttribute('opacity', ice ? '0.95' : '0');
    this.unitLabel.setAttribute('opacity', ice ? '1' : '0');
    for (const t of Array.from(this.ticks.children)) {
      const v = Number(t.getAttribute('data-v'));
      const label = t.querySelector('text')!;
      label.textContent = ice ? `${signed(v)}°` : signed(v);
    }
    const pillar = this.ruler.querySelector('rect[fill="url(#pillar)"]');
    pillar?.setAttribute('stroke', ice ? '#8fd8ff' : '#ff2fb3');
  }

  resetTrail(v: number): void { this.history = [v]; this.center = v; }
  pushTrail(v: number): void { this.history.push(v); if (this.history.length > 9) this.history.shift(); }

  private yOf(v: number): number { return RULER_H / 2 - (v - this.center) * (RULER_H - 60) / this.span; }

  /** Per frame: scroll the ruler so both you and the tunnel are on it. */
  updateRuler(value: number, tunnel: number, dt: number): void {
    const lo = Math.min(value, tunnel) - 2;
    const hi = Math.max(value, tunnel) + 2;
    const wantSpan = Math.max(14, hi - lo);
    const wantCenter = (lo + hi) / 2;
    const k = Math.min(1, dt * 4);
    this.span += (wantSpan - this.span) * k;
    this.center += (wantCenter - this.center) * k;
    const scale = (RULER_H - 60) / this.span;
    for (const t of Array.from(this.ticks.children) as SVGGElement[]) {
      const v = Number(t.getAttribute('data-v'));
      const y = this.yOf(v);
      const inView = y > -20 && y < RULER_H + 20;
      t.style.display = inView ? '' : 'none';
      if (!inView) continue;
      // thin the labels when zoomed out
      const step = scale < 16 ? 5 : scale < 28 ? 2 : 1;
      (t.querySelector('text') as SVGTextElement).style.display = v % step === 0 ? '' : 'none';
      t.setAttribute('transform', `translate(0 ${y.toFixed(1)})`);
    }
    this.marker.setAttribute('transform', `translate(0 ${this.yOf(value).toFixed(1)})`);
    this.target.setAttribute('transform', `translate(0 ${this.yOf(tunnel).toFixed(1)})`);
    this.targetVal.textContent = this.ice ? `${signed(tunnel)}°C` : signed(tunnel);
    const pts = this.history.map((v, i) => {
      const x = COL_X + COL_W + 30 + (this.history.length - 1 - i) * 16;
      return `${x},${this.yOf(v).toFixed(1)}`;
    });
    // stepped: horizontal then vertical
    const stepped: string[] = [];
    pts.forEach((p, i) => {
      if (i > 0) stepped.push(`${p.split(',')[0]},${pts[i - 1].split(',')[1]}`);
      stepped.push(p);
    });
    this.trail.setAttribute('points', stepped.join(' '));
    if (this.ice) {
      const y0 = this.yOf(-RANGE);
      const yv = this.yOf(value);
      this.mercury.setAttribute('y', String(Math.max(6, yv)));
      this.mercury.setAttribute('height', String(Math.max(0, Math.min(RULER_H - 6, y0) - Math.max(6, yv))));
      this.mercury.setAttribute('fill', value >= 0 ? '#ff3355' : '#3c8cff');
    }
  }

  setReadout(value: number, x: number, y: number, visible: boolean): void {
    if (value !== this.lastValue) {
      this.readout.textContent = this.ice ? `${signed(value)}°C` : signed(value);
      this.readout.className = `readout ${value > 0 ? 'pos' : value < 0 ? 'neg' : 'zero'}`;
      if (!Number.isNaN(this.lastValue)) {
        void this.readout.offsetWidth;
        this.readout.classList.add('pop');
      }
      this.lastValue = value;
    }
    this.readout.style.left = `${x}px`;
    this.readout.style.top = `${y}px`;
    this.readout.style.visibility = visible ? 'visible' : 'hidden';
  }

  setStats(score: number, multiplier: number, combo: number): void {
    if (score !== this.lastScore) { $('score').textContent = score.toLocaleString('en-US'); this.lastScore = score; }
    $('mult').textContent = `×${multiplier}`;
    if (combo !== this.lastCombo) {
      $('combo').textContent = String(combo);
      const pill = $('comboPill');
      pill.classList.remove('bump', 'broken');
      void pill.offsetWidth;
      pill.classList.add(combo === 0 && this.lastCombo > 0 ? 'broken' : 'bump');
      this.lastCombo = combo;
    }
  }

  setLevel(id: number, name: string, segs: number, current: number): void {
    $('levelName').textContent = `שלב ${id} · ${name}`;
    const dots = $('dots');
    if (dots.children.length !== segs) {
      dots.innerHTML = '';
      for (let i = 0; i < segs; i++) dots.appendChild(document.createElement('i'));
    }
    Array.from(dots.children).forEach((d, i) => { d.className = i < current ? 'on' : i === current ? 'now' : ''; });
  }

  banner(text: string, small = ''): void {
    const b = $('banner');
    b.hidden = false;
    b.innerHTML = '';
    b.append(text);
    if (small) { const s = document.createElement('small'); s.textContent = small; b.append(s); }
    b.style.animation = 'none';
    void b.offsetWidth;
    b.style.animation = '';
  }

  showCrash(ex: Explanation): void {
    const math = $('crashMath');
    math.innerHTML = '';
    for (const s of ex.steps) {
      const d = document.createElement('div');
      d.textContent = expression(s.from, s.op);
      math.appendChild(d);
    }
    const key = pickKeyStep(ex.steps);
    $('crashRule').textContent = key ? ruleHe(key.from, key.op) : '';
    const need = $('crashNeed');
    need.innerHTML = '';
    const unit = this.ice ? '°C' : '';
    need.append('המנהרה בגובה ', ltr(`${signed(ex.tunnel)}${unit}`), ', הגעת ל־', ltr(`${signed(ex.result)}${unit}`));
    const fix = $('crashFix');
    if (ex.correct) {
      fix.hidden = false;
      fix.innerHTML = '';
      fix.append('הדרך שעוברת: ');
      const parts = ex.correct.map((c) => expression(c.from, c.op));
      fix.append(ltr(parts.join('   ·   ')));
    } else fix.hidden = true;
    $('crash').hidden = false;
  }

  setCrashCount(n: number): void { $('crashCount').textContent = String(Math.max(1, n)); }
  hideCrash(): void { $('crash').hidden = true; }
  show(on: boolean): void { $('hud').hidden = !on; }
}

function ltr(text: string): HTMLElement {
  const b = document.createElement('bdi');
  b.setAttribute('dir', 'ltr');
  b.textContent = text;
  return b;
}

/** The step whose sign rule matters most, for the one-line explanation. */
function pickKeyStep(steps: { from: number; op: Op }[]): { from: number; op: Op } | null {
  const score = (s: { from: number; op: Op }) => {
    const o = s.op;
    if (o.kind === 'pow' && s.from < 0) return 5;
    if ((o.kind === 'mul' || o.kind === 'div') && (s.from < 0 || o.n < 0)) return 4;
    if (o.kind === 'sub' && o.n < 0) return 3;
    if (o.kind === 'add' && o.n < 0) return 2;
    return 1;
  };
  return steps.reduce<{ from: number; op: Op } | null>((best, s) => (!best || score(s) > score(best) ? s : best), null);
}

export { num };

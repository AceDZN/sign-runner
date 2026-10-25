// Fresh, solver-verified variants of a level for replays. Pure TypeScript.
import { Level, Row, Segment, allPaths, solutions } from './levels';
import { Op, add, sub, mul, div, sq, cube, tryApply } from './rules';

export type Rng = () => number;

export function rng(seed: number): Rng {
  let a = seed >>> 0 || 1;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const int = (r: Rng, lo: number, hi: number) => lo + Math.floor(r() * (hi - lo + 1));
const pick = <T>(r: Rng, xs: T[]): T => xs[Math.floor(r() * xs.length)];
const nz = (r: Rng, lo: number, hi: number) => { let n = 0; while (n === 0) n = int(r, lo, hi); return n; };

const MAX_VALUE = 30;

/** Is this segment fair: exactly one path, exact everywhere, on the scale? */
export function validSegment(start: number, seg: Segment, maxTunnel = 16): boolean {
  if (Math.abs(seg.tunnel) > maxTunnel || seg.tunnel === start && seg.rows.length === 1) return false;
  const paths = allPaths(start, seg.rows);
  for (const p of paths) {
    if (p.final === null) return false;
    if (p.values.some((v) => Math.abs(v) > MAX_VALUE)) return false;
  }
  return solutions(start, seg).length === 1;
}

type Family = 'add' | 'sub' | 'mul' | 'div' | 'pow';

/** A correct op for this family from v, plus misconception-shaped distractors. */
function proposal(r: Rng, fam: Family, v: number): { op: Op; distractors: Op[] } | null {
  switch (fam) {
    case 'add': {
      const t = nz(r, -12, 12);
      const n = t - v;
      if (n === 0 || Math.abs(n) > 14) return null;
      return { op: add(n), distractors: [add(-n), add(n + pick(r, [-2, -1, 1, 2])), sub(n)] };
    }
    case 'sub': {
      const n = r() < 0.7 ? nz(r, -9, -1) : nz(r, 1, 9);
      if (Math.abs(v - n) > 12) return null;
      return { op: sub(n), distractors: [sub(-n), add(n), sub(n + pick(r, [-1, 1]))] };
    }
    case 'mul': {
      const opts = [-5, -4, -3, -2, -1, 2, 3, 4, 5].filter((n) => Math.abs(v * n) <= 16);
      if (v === 0 || !opts.length) return null;
      const n = pick(r, opts);
      return { op: mul(n), distractors: [mul(-n), sub(-n), add(n)] };
    }
    case 'div': {
      const opts = [-6, -5, -4, -3, -2, -1, 2, 3, 4, 5, 6].filter((n) => v !== 0 && v % n === 0 && Math.abs(n) !== Math.abs(v) + 100);
      if (!opts.length) return null;
      const n = pick(r, opts);
      return { op: div(n), distractors: [div(-n), sub(-n), mul(n)] };
    }
    case 'pow': {
      if (v === 0 || Math.abs(v) > 4) return null;
      const op = Math.abs(v) <= 3 && r() < 0.4 ? cube() : sq();
      return { op, distractors: [mul(Math.abs(v)), op.kind === 'pow' && op.n === 2 ? cube() : sq(), sub(-Math.abs(v))] };
    }
  }
}

/** Connector that brings a far-off value back to a friendly range. */
function connector(r: Rng, v: number, fam: Family): { op: Op; distractors: Op[] } | null {
  if (fam === 'div') {
    const n = pick(r, [-4, -3, -2, 2, 3, 4]);
    const base = v === 0 ? 1 : Math.sign(v) * Math.min(4, Math.abs(v));
    const target = base * n;
    const k = target - v;
    if (k === 0) return null;
    return { op: add(k), distractors: [add(-k), sub(k), add(k + 1)] };
  }
  const t = fam === 'pow' ? nz(r, -4, 4) : nz(r, -6, 6);
  const k = t - v;
  if (k === 0) return null;
  return { op: add(k), distractors: [add(-k), sub(k), add(k + 1), add(k - 1), sub(-(k + 2))] };
}

function shuffleInto(r: Rng, correct: Op, ds: Op[], lane: number): Row {
  const pool = [...ds].sort(() => r() - 0.5).slice(0, 2);
  const row: Op[] = [];
  let k = 0;
  for (let i = 0; i < 3; i++) row.push(i === lane ? correct : pool[k++]);
  return row as Row;
}

function familiesFor(level: Level): Family[] {
  switch (level.id) {
    case 1: return ['add'];
    case 2: return ['sub'];
    case 3: return ['mul'];
    case 4: return ['div'];
    case 5: return ['mul', 'add'];
    case 6: return ['pow'];
    default: return ['add', 'sub', 'mul', 'div', 'pow'];
  }
}

/** Shrink a big value with an exact division (used between powers). */
function shrink(r: Rng, v: number): { op: Op; distractors: Op[] } | null {
  const opts = [-4, -3, -2, 2, 3, 4].filter((n) => v % n === 0 && Math.abs(v / n) <= 4);
  if (!opts.length) return null;
  const n = pick(r, opts);
  return { op: div(n), distractors: [div(-n), sub(-n), add(n)] };
}

function singleSegment(r: Rng, level: Level, v: number, lane: number): Segment | null {
  const fams = familiesFor(level);
  const fam = pick(r, fams);
  const p = proposal(r, fam, v) ?? (fam === 'pow' ? shrink(r, v) : null) ?? connector(r, v, fam);
  if (!p) return null;
  const row = shuffleInto(r, p.op, p.distractors, lane);
  const tunnel = tryApply(p.op, v);
  if (tunnel === null) return null;
  return { rows: [row], tunnel };
}

/** Two rows where the same two operations give different results in the two orders. */
function orderSegment(r: Rng, v: number, fams: Family[], mixed: boolean): Segment | null {
  const f1 = pick(r, fams);
  const p1 = proposal(r, f1, v);
  if (!p1) return null;
  const mid = tryApply(p1.op, v);
  if (mid === null) return null;
  const f2 = pick(r, fams.filter((f) => mixed || f !== f1));
  const p2 = proposal(r, f2, mid);
  if (!p2) return null;
  const end = tryApply(p2.op, mid);
  const swapped = tryApply(p1.op, tryApply(p2.op, v) ?? NaN);
  if (end === null || swapped === end) return null;
  const l1 = int(r, 0, 2);
  let l2 = int(r, 0, 2);
  if (!mixed && l2 === l1) l2 = (l1 + 1) % 3;
  // in the order level, both operations sit in both rows, so either order is on the board
  const row1 = shuffleInto(r, p1.op, mixed ? p1.distractors : [p2.op, ...p1.distractors], l1);
  const row2 = shuffleInto(r, p2.op, mixed ? p2.distractors : [p1.op, ...p2.distractors], l2);
  if (!mixed) {
    if (!row1.includes(p2.op)) row1[(l1 + 1) % 3] = p2.op;
    if (!row2.includes(p1.op)) row2[(l2 + 1) % 3] = p1.op;
  }
  return { rows: [row1, row2], tunnel: end };
}

/** A new level with the same skill, structure and start, and fresh numbers. */
export function freshLevel(level: Level, seed: number): Level {
  const r = rng(seed * 7919 + level.id);
  const segments: Segment[] = [];
  let v = level.start;
  // spread the solution lanes so no lane dominates
  const lanes = level.segments.map((_, i) => i % 3).sort(() => r() - 0.5);
  level.segments.forEach((tpl, i) => {
    let seg: Segment | null = null;
    for (let tries = 0; tries < 400 && !seg; tries++) {
      const cand = tpl.rows.length === 2 ? orderSegment(r, v, level.id === 6 ? ['pow', 'add', 'sub'] : level.id === 5 ? ['mul', 'add'] : familiesFor(level), level.id !== 5) : singleSegment(r, level, v, lanes[i]);
      if (cand && validSegment(v, cand, level.id === 6 ? 27 : 16)) seg = cand;
    }
    if (!seg) {
      // guaranteed fallback: a plain addition back toward zero
      for (let tries = 0; tries < 400 && !seg; tries++) {
        const c = connector(r, v, 'add');
        if (!c) continue;
        const mid = tryApply(c.op, v)!;
        const rows: Row[] = [shuffleInto(r, c.op, c.distractors, lanes[i])];
        let end = mid;
        if (tpl.rows.length === 2) {
          const c2 = connector(r, mid, 'add');
          if (!c2) continue;
          rows.push(shuffleInto(r, c2.op, c2.distractors, (lanes[i] + 1) % 3));
          end = tryApply(c2.op, mid)!;
        }
        const cand: Segment = { rows, tunnel: end };
        if (validSegment(v, cand)) seg = cand;
      }
    }
    if (!seg) throw new Error(`freshLevel: no valid segment for level ${level.id} from ${v}`);
    segments.push(seg);
    v = seg.tunnel;
  });
  return { ...level, segments };
}

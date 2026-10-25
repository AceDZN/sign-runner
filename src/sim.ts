// Deterministic run simulation. Pure TypeScript: the scene only renders this.
import { Level, Segment, segmentStarts, solutions } from './levels';
import { apply, opLabel, Op } from './rules';

export const METERS_PER_BEAT = 6;
export const ROW_FIRST_BEAT = 5;  // first gate row, beats after the checkpoint
export const ROW_GAP_BEATS = 3;   // between two rows of the same segment
export const TUNNEL_GAP_BEATS = 2; // last row → tunnel
export const TAIL_BEATS = 2;      // tunnel → next checkpoint
export const LEAD_IN_BEATS = 3;   // run-up before the first checkpoint
export const CRASH_BEATS = 4;     // slow-motion smash before the respawn
export const BASE_BPM = { normal: 100, slow: 80 } as const;
export type Tempo = keyof typeof BASE_BPM;

export interface SegmentLayout {
  startZ: number;
  rowZ: number[];
  tunnelZ: number;
  endZ: number;
}

export function layoutLevel(level: Pick<Level, 'segments'>): SegmentLayout[] {
  const out: SegmentLayout[] = [];
  let z = 0;
  for (const seg of level.segments) {
    const rowZ = seg.rows.map((_, i) => z + (ROW_FIRST_BEAT + i * ROW_GAP_BEATS) * METERS_PER_BEAT);
    const tunnelZ = rowZ[rowZ.length - 1] + TUNNEL_GAP_BEATS * METERS_PER_BEAT;
    const endZ = tunnelZ + TAIL_BEATS * METERS_PER_BEAT;
    out.push({ startZ: z, rowZ, tunnelZ, endZ });
    z = endZ;
  }
  return out;
}

export function multiplierFor(combo: number): number {
  return Math.min(4, 1 + Math.floor(combo / 4));
}

export type Rank = 'S' | 'A' | 'B' | 'C';
export function rankFor(crashes: number, hints: number): Rank {
  const p = crashes + hints;
  if (p === 0) return 'S';
  if (p <= 2) return 'A';
  if (p <= 5) return 'B';
  return 'C';
}

export interface GateChoice { lane: number; op: Op; label: string; from: number; to: number }

export interface Explanation {
  steps: { from: number; op: Op }[];
  result: number;
  tunnel: number;
  /** Shown from the second crash on the same segment: the worked correct path. */
  correct: { from: number; op: Op }[] | null;
  /** The right two gates, taken in the wrong order. */
  reversedOrder: boolean;
}

export type SimEvent =
  | { type: 'gate'; seg: number; row: number; choice: GateChoice }
  | { type: 'pass'; seg: number; value: number; combo: number; multiplier: number; hinted: boolean; firstTry: boolean; points: number }
  | { type: 'crash'; seg: number; value: number; tunnel: number; explanation: Explanation }
  | { type: 'respawn'; seg: number; value: number }
  | { type: 'hint'; seg: number }
  | { type: 'checkpoint'; seg: number; value: number }
  | { type: 'done'; rank: Rank };

export interface LearningEvent {
  level: number;
  seg: number;
  attempt: number;
  start: number;
  choices: string[];
  values: number[];
  tunnel: number;
  outcome: 'pass' | 'crash';
  hint: boolean;
  firstUnaided: boolean;
}

export type Phase = 'run' | 'crash' | 'done';

export class RunSim {
  readonly level: Level;
  readonly layout: SegmentLayout[];
  readonly starts: number[];
  readonly bpm: number;
  readonly speed: number; // m/s

  t = 0;
  z: number;
  lane = 1;
  value: number;
  seg = 0;
  row = 0; // next row index inside the current segment
  phase: Phase = 'run';
  crashTimer = 0;

  combo = 0;
  bestCombo = 0;
  score = 0;
  crashes = 0;
  hints = 0;
  passes = 0;

  ghostHeld = false;
  hintThisAttempt = false;
  attempt = 1;
  crashesThisSeg = 0;
  choices: GateChoice[] = [];

  events: SimEvent[] = [];
  learning: LearningEvent[] = [];

  constructor(level: Level, tempo: Tempo = 'normal') {
    this.level = level;
    this.layout = layoutLevel(level);
    this.starts = segmentStarts(level);
    this.bpm = BASE_BPM[tempo] * level.tempo;
    this.speed = (METERS_PER_BEAT * this.bpm) / 60;
    this.z = -LEAD_IN_BEATS * METERS_PER_BEAT;
    this.value = level.start;
  }

  get beat(): number { return 60 / this.bpm; }
  get segment(): Segment { return this.level.segments[this.seg]; }
  get multiplier(): number { return this.hintThisAttempt ? 1 : multiplierFor(this.combo); }
  get nextTunnel(): number { return this.segment.tunnel; }
  get rank(): Rank { return rankFor(this.crashes, this.hints); }

  setLane(lane: number): void {
    if (this.phase !== 'run') return;
    this.lane = Math.max(0, Math.min(2, lane));
  }
  moveLane(delta: number): void { this.setLane(this.lane + delta); }

  setGhost(held: boolean): void { this.ghostHeld = held; }

  /** Value each lane of the next gate row would give, from the current value. */
  ghostPreview(): number[] | null {
    if (this.phase !== 'run' || this.row >= this.segment.rows.length) return null;
    return this.segment.rows[this.row].map((op) => apply(op, this.value));
  }

  step(dt: number): void {
    if (this.phase === 'done') return;
    this.t += dt;
    if (this.phase === 'crash') {
      this.crashTimer -= dt;
      if (this.crashTimer <= 0) this.respawn();
      return;
    }
    if (this.ghostHeld && this.level.ghost && this.row < this.segment.rows.length && !this.hintThisAttempt) {
      this.hintThisAttempt = true;
      this.hints++;
      this.events.push({ type: 'hint', seg: this.seg });
    }
    const target = this.z + this.speed * dt;
    // Process every crossing in order; a crash stops the runner at the wall.
    for (;;) {
      const L = this.layout[this.seg];
      const nextZ = this.row < L.rowZ.length ? L.rowZ[this.row] : L.tunnelZ;
      if (nextZ > target) break;
      this.z = nextZ;
      if (this.row < L.rowZ.length) this.crossRow();
      else {
        this.crossTunnel();
        if (this.phase !== 'run') return;
        // advance into the next segment; the checkpoint is the segment start
        if (this.seg + 1 >= this.level.segments.length) {
          this.phase = 'done'; // seg stays on the last segment so `segment` is always valid
          this.events.push({ type: 'done', rank: this.rank });
          return;
        }
        this.seg++;
        this.row = 0;
        this.attempt = 1;
        this.crashesThisSeg = 0;
        this.hintThisAttempt = false;
        this.choices = [];
        this.events.push({ type: 'checkpoint', seg: this.seg, value: this.value });
      }
    }
    this.z = target;
  }

  private crossRow(): void {
    const op = this.segment.rows[this.row][this.lane];
    const from = this.value;
    this.value = apply(op, from);
    const choice: GateChoice = { lane: this.lane, op, label: opLabel(op), from, to: this.value };
    this.choices.push(choice);
    this.events.push({ type: 'gate', seg: this.seg, row: this.row, choice });
    this.row++;
  }

  private crossTunnel(): void {
    const seg = this.segment;
    const hinted = this.hintThisAttempt;
    const firstTry = this.attempt === 1;
    this.learning.push({
      level: this.level.id,
      seg: this.seg,
      attempt: this.attempt,
      start: this.starts[this.seg],
      choices: this.choices.map((c) => c.label),
      values: this.choices.map((c) => c.to),
      tunnel: seg.tunnel,
      outcome: this.value === seg.tunnel ? 'pass' : 'crash',
      hint: hinted,
      firstUnaided: firstTry && !hinted,
    });
    if (this.value === seg.tunnel) {
      if (hinted) this.combo = 0;
      this.combo++;
      this.bestCombo = Math.max(this.bestCombo, this.combo);
      const multiplier = hinted ? 1 : multiplierFor(this.combo);
      const points = 100 * multiplier;
      this.score += points;
      this.passes++;
      this.events.push({ type: 'pass', seg: this.seg, value: this.value, combo: this.combo, multiplier, hinted, firstTry, points });
      if (hinted) this.combo = 0; // a ghost-assisted pass doesn't build the streak
      return;
    }
    this.crashes++;
    this.crashesThisSeg++;
    this.combo = 0;
    this.phase = 'crash';
    this.crashTimer = CRASH_BEATS * this.beat;
    const sol = solutions(this.starts[this.seg], seg)[0];
    const solOps = sol ? sol.lanes.map((lane, r) => opLabel(seg.rows[r][lane])) : [];
    const mine = this.choices.map((c) => c.label);
    const reversedOrder = mine.length === 2 && solOps.length === 2 && mine[0] === solOps[1] && mine[1] === solOps[0] && mine[0] !== mine[1];
    let v = this.starts[this.seg];
    const correct = this.crashesThisSeg >= 2 && sol
      ? sol.lanes.map((lane, r) => { const step = { from: v, op: seg.rows[r][lane] }; v = apply(step.op, v); return step; })
      : null;
    this.events.push({
      type: 'crash',
      seg: this.seg,
      value: this.value,
      tunnel: seg.tunnel,
      explanation: {
        steps: this.choices.map((c) => ({ from: c.from, op: c.op })),
        result: this.value,
        tunnel: seg.tunnel,
        correct,
        reversedOrder,
      },
    });
  }

  private respawn(): void {
    const L = this.layout[this.seg];
    this.phase = 'run';
    this.z = L.startZ;
    this.value = this.starts[this.seg];
    this.lane = 1;
    this.row = 0;
    this.attempt++;
    this.hintThisAttempt = false;
    this.choices = [];
    this.events.push({ type: 'respawn', seg: this.seg, value: this.value });
  }

  drainEvents(): SimEvent[] {
    const e = this.events;
    this.events = [];
    return e;
  }
}

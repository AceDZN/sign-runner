// Authored levels and the path solver. Pure TypeScript.
import { Op, add, sub, mul, div, sq, cube, tryApply } from './rules';

/** One row of gates. Index = lane: 0 left, 1 center, 2 right. */
export type Row = [Op, Op, Op];

export interface Segment {
  rows: Row[];
  /** Height of the tunnel slot after the last row. */
  tunnel: number;
}

export type Skin = 'sea' | 'ice';

export interface Level {
  id: number;
  name: string;      // Hebrew
  subtitle: string;  // Hebrew: the skill
  rule: string;      // Hebrew one-line rule on the intro card
  example: string;   // LTR math example on the intro card
  start: number;
  segments: Segment[];
  skin: Skin;
  ghost: boolean;
  /** Tempo multiplier on top of the player's chosen tempo. */
  tempo: number;
  modules: string[];
}

export interface Path {
  lanes: number[];
  values: number[]; // value after each row
  final: number | null; // null if an operation was not exact
}

/** Every lane combination through a segment's rows (3^rows paths). */
export function allPaths(start: number, rows: Row[]): Path[] {
  const out: Path[] = [];
  const walk = (r: number, v: number | null, lanes: number[], values: number[]) => {
    if (r === rows.length) {
      out.push({ lanes, values, final: v });
      return;
    }
    for (let lane = 0; lane < 3; lane++) {
      const next = v === null ? null : tryApply(rows[r][lane], v);
      walk(r + 1, next, [...lanes, lane], [...values, next ?? NaN]);
    }
  };
  walk(0, start, [], []);
  return out;
}

export function solutions(start: number, seg: Segment): Path[] {
  return allPaths(start, seg.rows).filter((p) => p.final === seg.tunnel);
}

/** Value at the start of each segment (passing a tunnel puts you at its height). */
export function segmentStarts(level: Pick<Level, 'start' | 'segments'>): number[] {
  return level.segments.map((_, i) => (i === 0 ? level.start : level.segments[i - 1].tunnel));
}

const r = (a: Op, b: Op, c: Op): Row => [a, b, c];
const one = (tunnel: number, a: Op, b: Op, c: Op): Segment => ({ rows: [r(a, b, c)], tunnel });
const two = (tunnel: number, r1: Row, r2: Row): Segment => ({ rows: [r1, r2], tunnel });

const MOD = 'https://math.workbook.co.il/grade-7/chapter-7/';

export const LEVELS: Level[] = [
  {
    id: 1,
    name: 'קו המים',
    subtitle: 'חיבור מספרים מכוונים',
    rule: 'חיבור מספר חיובי מעלה אתכם. חיבור מספר שלילי מוריד אתכם למטה, גם אם לא עוברים את קו המים.',
    example: '3 + (−5) = −2',
    start: 0,
    skin: 'sea',
    ghost: true,
    tempo: 1,
    modules: [MOD + 'number-line-expanded', MOD + 'adding-directed'],
    segments: [
      one(3, add(5), add(-3), add(3)),
      one(-2, add(-5), add(5), add(-1)),
      one(-6, add(4), add(-4), add(-6)),
      one(-1, add(-5), add(7), add(5)),
      one(4, add(3), add(5), add(-5)),
      one(-3, add(-1), add(-7), add(7)),
      one(-10, add(7), add(-13), add(-7)),
      one(2, add(12), add(8), add(-12)),
    ],
  },
  {
    id: 2,
    name: 'מינוס מינוס',
    subtitle: 'חיסור מספרים מכוונים',
    rule: 'חיסור מספר שלילי = חיבור המספר הנגדי לו. מחסירים מספר שלילי? עולים!',
    example: '−2 − (−3) = −2 + 3 = 1',
    start: -2,
    skin: 'sea',
    ghost: true,
    tempo: 1,
    modules: [MOD + 'opposite-numbers', MOD + 'subtracting-directed'],
    segments: [
      one(1, sub(-3), sub(3), add(-3)),
      one(-4, sub(-5), add(-3), sub(5)),
      one(2, sub(-6), sub(6), sub(-2)),
      one(9, sub(-7), sub(7), sub(-5)),
      one(0, sub(-9), add(-8), sub(9)),
      one(-5, sub(-5), sub(5), add(5)),
      one(-1, sub(4), sub(-4), sub(-6)),
      one(-8, sub(-9), sub(-7), sub(7)),
      one(-3, sub(-5), sub(5), sub(-11)),
    ],
  },
  {
    id: 3,
    name: 'היפוך',
    subtitle: 'כפל מספרים מכוונים',
    rule: 'כופלים את הערכים המוחלטים, ואז קובעים סימן: אותו סימן ← חיובי, סימנים שונים ← שלילי. ×(−1) הוא שער המראה: הוא נותן את המספר הנגדי.',
    example: '4 × (−2) = −8',
    start: 4,
    skin: 'sea',
    ghost: true,
    tempo: 1,
    modules: [MOD + 'multiplying-directed', MOD + 'opposite-numbers'],
    segments: [
      one(-8, mul(-2), sub(-4), mul(2)),
      one(8, add(-1), mul(1), mul(-1)),
      one(-2, mul(-1), add(-10), sub(2)),
      one(-6, mul(-3), mul(3), sub(-4)),
      one(-12, mul(-2), sub(-6), mul(2)),
      one(12, sub(-1), mul(1), mul(-1)),
      one(-2, mul(-1), add(-14), sub(-2)),
      one(-10, mul(5), mul(-5), sub(-8)),
      one(10, mul(-1), sub(-10), mul(1)),
    ],
  },
  {
    id: 4,
    name: 'פיצול',
    subtitle: 'חילוק מספרים מכוונים',
    rule: 'בחילוק אותם כללי סימנים כמו בכפל. וחילוק לא תמיד מקטין!',
    example: '(−12) ÷ (−4) = 3',
    start: -12,
    skin: 'sea',
    ghost: true,
    tempo: 1,
    modules: [MOD + 'dividing-directed'],
    segments: [
      one(3, div(4), sub(-4), div(-4)),
      one(-15, mul(5), mul(-5), div(-3)),
      one(-5, div(-3), div(3), div(-5)),
      one(-10, mul(-2), sub(-5), mul(2)),
      one(5, div(2), sub(-5), div(-2)),
      one(-1, div(5), div(-5), sub(-4)),
      one(8, mul(-8), div(-1), mul(8)),
      one(-2, div(-4), div(4), sub(-4)),
      one(-12, mul(-6), add(-6), mul(6)),
      one(-3, div(-4), div(4), sub(-3)),
    ],
  },
  {
    id: 5,
    name: 'הסדר קובע',
    subtitle: 'סדר פעולות עם מספרים מכוונים',
    rule: 'שני שערים ברצף: אותן פעולות בסדר אחר יכולות לתת תוצאה אחרת.',
    example: '3 × (−1) + (−5) = −8   ·   (3 + (−5)) × (−1) = 2',
    start: 3,
    skin: 'sea',
    ghost: true,
    tempo: 1,
    modules: [MOD + 'order-of-ops-directed'],
    segments: [
      two(-8, r(mul(-1), add(-5), add(1)), r(add(2), add(-5), mul(-1))),
      two(2, r(mul(-1), add(-2), add(6)), r(add(-4), mul(-1), add(6))),
      two(-6, r(add(-2), mul(-2), mul(3)), r(mul(-2), sub(-3), add(-2))),
      two(8, r(mul(-2), add(-4), sub(-1)), r(mul(-2), add(-4), add(-1))),
      two(-5, r(div(-2), sub(-2), sub(2)), r(div(-2), mul(-1), sub(-2))),
      two(4, r(mul(-2), add(-3), sub(-3)), r(mul(-2), sub(-3), mul(2))),
    ],
  },
  {
    id: 6,
    name: 'חזקות',
    subtitle: 'חזקות בבסיס שלילי',
    rule: 'חזקה זוגית של מספר שלילי ← חיובית. חזקה אי־זוגית של מספר שלילי ← שלילית.',
    example: '(−3)² = (−3) × (−3) = 9',
    start: -3,
    skin: 'sea',
    ghost: true,
    tempo: 1,
    modules: [MOD + 'negative-base-powers'],
    segments: [
      one(9, sq(), mul(3), sub(-6)),
      one(-2, mul(-1), add(-7), add(-11)),
      one(-8, sq(), mul(-4), cube()),
      one(-4, div(-2), div(2), sub(-2)),
      one(-16, mul(4), sq(), sub(-12)),
      one(-1, div(-16), sub(-14), div(16)),
      one(-1, cube(), sq(), mul(-1)),
      two(9, r(sq(), add(-2), sub(-2)), r(sq(), mul(3), cube())),
      one(-3, div(3), div(-3), add(-6)),
      one(-27, sq(), cube(), mul(-9)),
    ],
  },
  {
    id: 7,
    name: 'תחנת הקרח',
    subtitle: 'שלב העברה: הכל ביחד, בלי רמזים',
    rule: 'עכשיו הגובה הוא טמפרטורה במעלות צלזיוס. מתחת לאפס הכל קפוא. בלי רוח רפאים.',
    example: '(−15) ÷ (−5) − (−4) = 7',
    start: -15,
    skin: 'ice',
    ghost: false,
    tempo: 1.15,
    modules: [
      MOD + 'adding-directed',
      MOD + 'subtracting-directed',
      MOD + 'multiplying-directed',
      MOD + 'dividing-directed',
      MOD + 'order-of-ops-directed',
      MOD + 'negative-base-powers',
    ],
    segments: [
      two(7, r(div(5), add(5), div(-5)), r(sub(4), mul(-1), sub(-4))),
      one(-14, mul(2), sub(-7), mul(-2)),
      one(-6, sub(-8), sub(8), add(-8)),
      two(9, r(div(3), div(-3), sub(-3)), r(sq(), mul(-1), add(-4))),
      one(-9, add(-9), mul(-1), sub(-9)),
      two(2, r(div(-3), sub(-3), add(-3)), r(sub(-3), mul(-1), div(-3))),
      one(-12, mul(6), add(-6), mul(-6)),
      two(0, r(div(-6), sub(-6), div(6)), r(mul(-1), add(2), mul(2))),
    ],
  },
];

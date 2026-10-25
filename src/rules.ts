// Pure directed-number rules. No Three.js, no DOM. Every gate result and
// tunnel check in the game comes from here.

export const MINUS = '−'; // real minus sign, never a hyphen

export type Op =
  | { kind: 'add'; n: number }
  | { kind: 'sub'; n: number }
  | { kind: 'mul'; n: number }
  | { kind: 'div'; n: number }
  | { kind: 'pow'; n: 2 | 3 };

export const add = (n: number): Op => ({ kind: 'add', n });
export const sub = (n: number): Op => ({ kind: 'sub', n });
export const mul = (n: number): Op => ({ kind: 'mul', n });
export const div = (n: number): Op => ({ kind: 'div', n });
export const sq = (): Op => ({ kind: 'pow', n: 2 });
export const cube = (): Op => ({ kind: 'pow', n: 3 });

/** Exact integer result, or null when the operation is undefined or not an integer. */
export function tryApply(op: Op, v: number): number | null {
  if (!Number.isSafeInteger(v)) return null;
  let r: number;
  switch (op.kind) {
    case 'add': r = v + op.n; break;
    case 'sub': r = v - op.n; break;
    case 'mul': r = v * op.n; break;
    case 'div':
      if (op.n === 0 || v % op.n !== 0) return null;
      r = v / op.n;
      break;
    case 'pow': r = op.n === 2 ? v * v : v * v * v; break;
  }
  if (!Number.isSafeInteger(r)) return null;
  return r === 0 ? 0 : r; // normalize -0
}

export function apply(op: Op, v: number): number {
  const r = tryApply(op, v);
  if (r === null) throw new Error(`operation ${opLabel(op)} is not exact on ${v}`);
  return r;
}

export function applyAll(ops: Op[], v: number): number {
  return ops.reduce((acc, op) => apply(op, acc), v);
}

/** "5", "−8", "0" (no plus sign). */
export function num(v: number): string {
  return v < 0 ? `${MINUS}${-v}` : `${v}`;
}

/** "+5", "−8", "0": the signed readout for altitude. */
export function signed(v: number): string {
  return v > 0 ? `+${v}` : num(v);
}

/** Operand in Workbook notation: negatives get parentheses. */
export function paren(v: number): string {
  return v < 0 ? `(${num(v)})` : num(v);
}

/** Gate label in Workbook notation: +3, +(−5), −(−3), ×(−2), ÷(−4), (  )². */
export function opLabel(op: Op): string {
  switch (op.kind) {
    case 'add': return `+${paren(op.n)}`;
    case 'sub': return `${MINUS}${paren(op.n)}`;
    case 'mul': return `×${paren(op.n)}`;
    case 'div': return `÷${paren(op.n)}`;
    case 'pow': return op.n === 2 ? '(  )²' : '(  )³';
  }
}

/** Left operand as written at the start of an expression: −2 − (−3), but (−3)². */
function lead(v: number, op: Op): string {
  if (op.kind === 'pow') return `(${num(v)})`;
  if (op.kind === 'mul' || op.kind === 'div') return paren(v);
  return num(v);
}

/** "4 × (−2) = −8", "−2 − (−3) = −2 + 3 = 1", "(−3)² = (−3) × (−3) = 9". */
export function expression(v: number, op: Op): string {
  const r = apply(op, v);
  switch (op.kind) {
    case 'add': return `${lead(v, op)} + ${paren(op.n)} = ${num(r)}`;
    case 'sub':
      if (op.n < 0) return `${lead(v, op)} ${MINUS} ${paren(op.n)} = ${num(v)} + ${num(-op.n)} = ${num(r)}`;
      return `${lead(v, op)} ${MINUS} ${num(op.n)} = ${num(r)}`;
    case 'mul': return `${lead(v, op)} × ${paren(op.n)} = ${num(r)}`;
    case 'div': return `${lead(v, op)} ÷ ${paren(op.n)} = ${num(r)}`;
    case 'pow': {
      const factors = Array(op.n).fill(paren(v)).join(' × ');
      return `(${num(v)})${op.n === 2 ? '²' : '³'} = ${factors} = ${num(r)}`;
    }
  }
}

/** One short Hebrew rule for what this operation did (Workbook wording). */
export function ruleHe(v: number, op: Op): string {
  const r = apply(op, v);
  switch (op.kind) {
    case 'add':
      if (op.n < 0) return 'חיבור מספר שלילי ← יורדים';
      if (op.n > 0) return 'חיבור מספר חיובי ← עולים';
      return 'חיבור אפס לא משנה';
    case 'sub':
      if (op.n < 0) return 'חיסור מספר שלילי = חיבור הנגדי ← עולים';
      if (op.n > 0) return 'חיסור מספר חיובי ← יורדים';
      return 'חיסור אפס לא משנה';
    case 'mul':
    case 'div': {
      if (v === 0) return op.kind === 'mul' ? 'כל מספר כפול אפס הוא אפס' : 'אפס חלקי מספר הוא אפס';
      if (op.kind === 'mul' && op.n === -1) return 'כפל ב־(−1) נותן את המספר הנגדי: היפוך לצד השני של קו המים';
      if (op.kind === 'mul' && op.n === 0) return 'כל מספר כפול אפס הוא אפס';
      const same = Math.sign(v) === Math.sign(op.n);
      return same ? 'אותו סימן ← חיובי' : 'סימנים שונים ← שלילי';
    }
    case 'pow':
      if (v === 0) return 'אפס בחזקה הוא אפס';
      if (v > 0) return 'חזקה של מספר חיובי היא חיובית';
      if (op.n === 2) return 'מספר זוגי של מינוסים ← חיובי';
      return r < 0 ? 'מספר אי־זוגי של מינוסים ← שלילי' : '';
  }
}

// ---------------------------------------------------------------------------
// Misconceptions. Each maps (op, v) to the result a student holding it would
// predict, or null when the misconception doesn't change the answer here.

export type Misconception =
  | 'minusMinusIsMinus'   // −(−3) treated as −3
  | 'negTimesNegIsNeg'    // (−a)×(−b) or (−a)÷(−b) treated as negative
  | 'addNegMovesUp'       // +(−5) treated as +5
  | 'negSquareIsNeg'      // (−3)² treated as −9
  | 'divAlwaysSmaller';   // picks the smaller-looking result: ignores sign on division

export function misconceivedApply(m: Misconception, op: Op, v: number): number | null {
  const r = tryApply(op, v);
  if (r === null) return null;
  switch (m) {
    case 'minusMinusIsMinus':
      return op.kind === 'sub' && op.n < 0 ? v + op.n : null;
    case 'addNegMovesUp':
      return op.kind === 'add' && op.n < 0 ? v - op.n : null;
    case 'negTimesNegIsNeg':
      return (op.kind === 'mul' || op.kind === 'div') && v < 0 && op.n < 0 ? -r : null;
    case 'negSquareIsNeg':
      return op.kind === 'pow' && op.n === 2 && v < 0 ? -r : null;
    case 'divAlwaysSmaller':
      return op.kind === 'div' && r > v ? -r : null;
  }
}

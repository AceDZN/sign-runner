import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, allPaths, solutions, segmentStarts, Level, Segment } from '../src/levels';
import { apply, applyAll, add, sub, mul, div, sq, cube, opLabel, misconceivedApply, Misconception, Op, tryApply } from '../src/rules';

const lvl = (id: number) => LEVELS.find((l) => l.id === id)!;
const labels = (s: Segment, row = 0) => s.rows[row].map(opLabel);
const solve = (L: Level, i: number) => solutions(segmentStarts(L)[i], L.segments[i]);

test('seven levels, at least six segments each, finite 6–10 minute slice', () => {
  assert.equal(LEVELS.length, 7);
  for (const L of LEVELS) assert.ok(L.segments.length >= 6, `level ${L.id}`);
});

test('every authored segment has exactly one path to its tunnel', () => {
  for (const L of LEVELS) {
    const starts = segmentStarts(L);
    L.segments.forEach((s, i) => {
      assert.equal(solutions(starts[i], s).length, 1, `level ${L.id} segment ${i + 1}`);
    });
  }
});

test('every path through every segment is exact integer arithmetic', () => {
  for (const L of LEVELS) {
    const starts = segmentStarts(L);
    L.segments.forEach((s, i) => {
      for (const p of allPaths(starts[i], s.rows)) {
        assert.notEqual(p.final, null, `level ${L.id} segment ${i + 1} lanes ${p.lanes.join('')}`);
        assert.ok(Math.abs(p.final!) <= 30, `level ${L.id} segment ${i + 1} stays on the scale`);
      }
    });
  }
});

test('handoff numbers: level 1 waterline', () => {
  const L = lvl(1);
  assert.equal(L.start, 0);
  assert.equal(L.segments[0].tunnel, 3);
  assert.deepEqual([...labels(L.segments[0])].sort(), ['+(−3)', '+3', '+5'].sort());
  assert.equal(L.segments[1].tunnel, -2);
  const s = solve(L, 1)[0];
  assert.equal(opLabel(L.segments[1].rows[0][s.lanes[0]]), '+(−5)');
  // first 30 seconds: two correct gates take you below the waterline
  assert.ok(L.segments[1].tunnel < 0);
});

test('handoff numbers: levels 2–4', () => {
  const L2 = lvl(2);
  assert.equal(L2.start, -2);
  assert.equal(L2.segments[0].tunnel, 1);
  assert.equal(opLabel(L2.segments[0].rows[0][solve(L2, 0)[0].lanes[0]]), '−(−3)');
  for (const op of L2.segments[0].rows[0]) if (opLabel(op) !== '−(−3)') assert.equal(apply(op, -2), -5);

  const L3 = lvl(3);
  assert.equal(L3.start, 4);
  assert.equal(L3.segments[0].tunnel, -8);
  assert.equal(opLabel(L3.segments[0].rows[0][solve(L3, 0)[0].lanes[0]]), '×(−2)');
  for (const op of L3.segments[0].rows[0]) if (opLabel(op) !== '×(−2)') assert.equal(apply(op, 4), 8);
  assert.ok(L3.segments.some((s, i) => opLabel(s.rows[0][solve(L3, i)[0].lanes[0]]) === '×(−1)'), 'mirror gate');

  const L4 = lvl(4);
  assert.equal(L4.start, -12);
  assert.equal(L4.segments[0].tunnel, 3);
  assert.equal(opLabel(L4.segments[0].rows[0][solve(L4, 0)[0].lanes[0]]), '÷(−4)');
  const others = L4.segments[0].rows[0].filter((op) => opLabel(op) !== '÷(−4)').map((op) => apply(op, -12)).sort((a, b) => a - b);
  assert.deepEqual(others, [-8, -3]);
});

test('handoff numbers: level 5 order matters, both orders forced', () => {
  const L = lvl(5);
  assert.equal(L.start, 3);
  assert.equal(applyAll([mul(-1), add(-5)], 3), -8);
  assert.equal(applyAll([add(-5), mul(-1)], 3), 2);
  assert.equal(L.segments[0].tunnel, -8);
  const s0 = solve(L, 0)[0];
  assert.deepEqual(s0.lanes.map((ln, r) => opLabel(L.segments[0].rows[r][ln])), ['×(−1)', '+(−5)']);
  // the reversed order is on the board and crashes
  const rev = allPaths(3, L.segments[0].rows).find((p) => p.lanes.map((ln, r) => opLabel(L.segments[0].rows[r][ln])).join() === '+(−5),×(−1)');
  assert.equal(rev?.final, 2);
  // segment 2: tunnel at 2, now the add must come first
  assert.equal(L.segments[1].tunnel, 2);
  const s1 = solve(L, 1)[0];
  assert.deepEqual(s1.lanes.map((ln, r) => opLabel(L.segments[1].rows[r][ln])), ['+6', '×(−1)']);
  // every segment in this level is two gates, and the two gates' reversed order misses
  const starts = segmentStarts(L);
  L.segments.forEach((seg, i) => {
    assert.equal(seg.rows.length, 2);
    const sol = solve(L, i)[0];
    const ops = sol.lanes.map((ln, r) => seg.rows[r][ln]);
    const reversed = tryApply(ops[0], tryApply(ops[1], starts[i]) ?? NaN);
    assert.notEqual(reversed, seg.tunnel, `segment ${i + 1}: order must matter`);
  });
  // lanes cross: the solution never stays in one lane for all segments
  assert.ok(L.segments.some((_, i) => new Set(solve(L, i)[0].lanes).size === 2));
});

test('handoff numbers: level 6 powers', () => {
  const L = lvl(6);
  assert.equal(L.start, -3);
  assert.equal(L.segments[0].tunnel, 9);
  assert.equal(opLabel(L.segments[0].rows[0][solve(L, 0)[0].lanes[0]]), '(  )²');
  assert.ok(L.segments[0].rows[0].some((op) => apply(op, -3) === -9), '(−3)² ≠ −9 is on the board');
  const starts = segmentStarts(L);
  const cubeSeg = L.segments.findIndex((s, i) => starts[i] === -2 && s.tunnel === -8);
  assert.ok(cubeSeg >= 0);
  assert.equal(opLabel(L.segments[cubeSeg].rows[0][solve(L, cubeSeg)[0].lanes[0]]), '(  )³');
});

test('handoff numbers: level 7 transfer (ice, no ghost, faster, chains)', () => {
  const L = lvl(7);
  assert.equal(L.skin, 'ice');
  assert.equal(L.ghost, false);
  assert.ok(L.tempo > 1);
  assert.equal(L.start, -15);
  assert.equal(L.segments[0].tunnel, 7);
  const s = solve(L, 0)[0];
  assert.deepEqual(s.lanes.map((ln, r) => opLabel(L.segments[0].rows[r][ln])), ['÷(−5)', '−(−4)']);
  assert.ok(L.segments.filter((x) => x.rows.length === 2).length >= 3, 'two-gate chains');
  const kinds = new Set(L.segments.flatMap((x) => x.rows.flat().map((op) => op.kind)));
  for (const k of ['add', 'sub', 'mul', 'div', 'pow']) assert.ok(kinds.has(k as Op['kind']), `mixes ${k}`);
});

// ---- bypass hunting -------------------------------------------------------

function passRate(L: Level, pick: (start: number, seg: Segment, row: number, value: number) => number): number {
  const starts = segmentStarts(L);
  let ok = 0;
  L.segments.forEach((seg, i) => {
    let v = starts[i];
    seg.rows.forEach((row, r) => { v = apply(row[pick(starts[i], seg, r, v)], v); });
    if (v === seg.tunnel) ok++;
  });
  return ok / L.segments.length;
}

test('no constant lane wins: staying in one lane passes under half of any level', () => {
  for (const L of LEVELS) {
    for (const lane of [0, 1, 2]) {
      const rate = passRate(L, () => lane);
      assert.ok(rate < 0.5, `level ${L.id} lane ${lane}: ${rate}`);
    }
  }
});

test('surface heuristics do not reliably win (eyeballing is not enough)', () => {
  const operand = (op: Op) => ('n' in op && op.kind !== 'pow' ? op.n : 0);
  const heuristics: Record<string, (s: number, seg: Segment, r: number, v: number) => number> = {
    // pick the gate whose printed number equals the tunnel's distance
    matchNumber: (_s, seg, r, v) => Math.max(0, seg.rows[r].findIndex((op) => Math.abs(operand(op)) === Math.abs(seg.tunnel - v))),
    // tunnel above → pick a gate that starts with "+"; below → one that starts with "−"
    symbolDirection: (_s, seg, r, v) => Math.max(0, seg.rows[r].findIndex((op) => (seg.tunnel > v) === opLabel(op).startsWith('+'))),
    // pick the gate whose operand has the tunnel's sign
    operandSign: (_s, seg, r) => Math.max(0, seg.rows[r].findIndex((op) => Math.sign(operand(op)) === Math.sign(seg.tunnel))),
  };
  let total = 0; let wins = 0;
  for (const [name, h] of Object.entries(heuristics)) {
    for (const L of LEVELS) {
      const rate = passRate(L, h);
      assert.ok(rate <= 0.6, `${name} on level ${L.id}: ${rate}`);
      total += L.segments.length; wins += rate * L.segments.length;
    }
  }
  assert.ok(wins / total < 0.4, `heuristics overall ${wins / total}`);
});

// A student holding a misconception steers into the lane their wrong rule predicts.
function trapCount(L: Level, m: Misconception): number {
  const starts = segmentStarts(L);
  let traps = 0;
  L.segments.forEach((seg, i) => {
    const believed = allPaths(starts[i], seg.rows).filter((p) => {
      let v = starts[i];
      p.lanes.forEach((ln, r) => { v = misconceivedApply(m, seg.rows[r][ln], v) ?? apply(seg.rows[r][ln], v); });
      return v === seg.tunnel;
    });
    if (believed.some((p) => p.final !== seg.tunnel)) traps++;
  });
  return traps;
}

test('each level catches its target misconception with a crash', () => {
  assert.ok(trapCount(lvl(1), 'addNegMovesUp') >= 3, 'adding a negative moves you up');
  assert.ok(trapCount(lvl(2), 'minusMinusIsMinus') >= 4, 'minus minus is minus');
  assert.ok(trapCount(lvl(3), 'negTimesNegIsNeg') >= 3, 'negative × negative is negative');
  assert.ok(trapCount(lvl(4), 'negTimesNegIsNeg') >= 3, 'negative ÷ negative is negative');
  assert.ok(trapCount(lvl(4), 'divAlwaysSmaller') >= 1, 'dividing always makes it smaller');
  assert.ok(trapCount(lvl(6), 'negSquareIsNeg') >= 2, '(−3)² = −9');
  const transfer: Misconception[] = ['addNegMovesUp', 'minusMinusIsMinus', 'negTimesNegIsNeg', 'negSquareIsNeg'];
  assert.ok(transfer.filter((m) => trapCount(lvl(7), m) >= 1).length >= 3, 'transfer level mixes traps');
});

test('the op helpers used above are the same exact rules', () => {
  assert.equal(apply(sub(-4), 3), 7);
  assert.equal(apply(div(-5), -15), 3);
  assert.equal(apply(sq(), -4), 16);
  assert.equal(apply(cube(), -3), -27);
});

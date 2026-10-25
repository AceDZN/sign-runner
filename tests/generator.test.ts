import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, allPaths, solutions, segmentStarts } from '../src/levels';
import { freshLevel } from '../src/generator';

const SEEDS = Array.from({ length: 25 }, (_, i) => i * 37 + 1);

test('fresh variants keep the skill, start, structure and rules of each level', () => {
  for (const L of LEVELS) {
    for (const seed of SEEDS) {
      const F = freshLevel(L, seed);
      assert.equal(F.start, L.start);
      assert.equal(F.skin, L.skin);
      assert.equal(F.ghost, L.ghost);
      assert.equal(F.segments.length, L.segments.length);
      F.segments.forEach((s, i) => assert.equal(s.rows.length, L.segments[i].rows.length, `level ${L.id} seed ${seed} seg ${i}`));
    }
  }
});

test('every fresh segment has exactly one exact path to its tunnel', () => {
  for (const L of LEVELS) {
    for (const seed of SEEDS) {
      const F = freshLevel(L, seed);
      const starts = segmentStarts(F);
      F.segments.forEach((s, i) => {
        assert.equal(solutions(starts[i], s).length, 1, `level ${L.id} seed ${seed} seg ${i + 1}`);
        for (const p of allPaths(starts[i], s.rows)) {
          assert.notEqual(p.final, null);
          assert.ok(p.values.every((v) => Math.abs(v) <= 30));
        }
      });
    }
  }
});

test('fresh variants are actually different and practice the level skill', () => {
  for (const L of LEVELS.slice(0, 6)) {
    const a = JSON.stringify(freshLevel(L, 1).segments);
    const b = JSON.stringify(freshLevel(L, 2).segments);
    assert.notEqual(a, b, `level ${L.id}`);
  }
  const kind = { 1: 'add', 2: 'sub', 3: 'mul', 4: 'div', 6: 'pow' } as const;
  for (const [id, k] of Object.entries(kind)) {
    const L = LEVELS.find((x) => x.id === Number(id))!;
    let hits = 0, total = 0;
    for (const seed of SEEDS) {
      const F = freshLevel(L, seed);
      const starts = segmentStarts(F);
      F.segments.forEach((s, i) => {
        total++;
        const sol = solutions(starts[i], s)[0];
        if (sol.lanes.some((ln, r) => s.rows[r][ln].kind === k)) hits++;
      });
    }
    assert.ok(hits / total >= (k === "pow" ? 0.4 : 0.5), `level ${id}: ${k} drives ${hits}/${total}`);
  }
});

test('fresh variants avoid degenerate gates and practise the sign rules', () => {
  for (const L of LEVELS) {
    for (const seed of SEEDS) {
      const F = freshLevel(L, seed);
      for (const s of F.segments) for (const row of s.rows) for (const op of row) {
        assert.ok(op.kind === 'pow' || op.n !== 0, `level ${L.id} seed ${seed}: no zero operand`);
        if (L.id === 1) assert.equal(op.kind, 'add', 'fresh level 1 only adds');
      }
    }
  }
  for (const [id, kind] of [[3, 'mul'], [4, 'div']] as const) {
    let unit = 0, total = 0;
    for (const seed of SEEDS) {
      const F = freshLevel(LEVELS[id - 1], seed);
      const starts = segmentStarts(F);
      F.segments.forEach((s, i) => {
        const sol = solutions(starts[i], s)[0];
        sol.lanes.forEach((ln, r) => { const op = s.rows[r][ln]; if (op.kind === kind) { total++; if (Math.abs(op.n) === 1) unit++; } });
      });
    }
    assert.ok(unit / total <= 0.2, `level ${id}: ${unit}/${total} correct gates are ×/÷(±1)`);
  }
});

test('no constant lane wins a fresh variant', () => {
  for (const L of LEVELS) {
    for (const seed of SEEDS) {
      const F = freshLevel(L, seed);
      const starts = segmentStarts(F);
      for (const lane of [0, 1, 2]) {
        let ok = 0;
        F.segments.forEach((s, i) => { if (solutions(starts[i], s)[0].lanes.every((l) => l === lane)) ok++; });
        assert.ok(ok / F.segments.length <= 0.5, `level ${L.id} seed ${seed} lane ${lane}`);
      }
    }
  }
});

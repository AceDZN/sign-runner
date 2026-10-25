import { test } from 'node:test';
import assert from 'node:assert/strict';
import { LEVELS, solutions, segmentStarts } from '../src/levels';
import { RunSim, layoutLevel, METERS_PER_BEAT, CRASH_BEATS, multiplierFor, rankFor } from '../src/sim';

const DT = 1 / 120;

/** Play a level with real lane inputs. `pickLane(seg,row)` returns the lane to hold before that row. */
function play(levelIdx: number, pickLane: (sim: RunSim) => number, opts: { ghostOnSeg?: number; maxSeconds?: number } = {}) {
  const sim = new RunSim(LEVELS[levelIdx]);
  const events = [];
  for (let i = 0; i < (opts.maxSeconds ?? 400) / DT && sim.phase !== 'done'; i++) {
    if (sim.phase === 'run') sim.setLane(pickLane(sim));
    sim.setGhost(opts.ghostOnSeg === sim.seg && sim.attempt === 1);
    sim.step(DT);
    events.push(...sim.drainEvents());
  }
  return { sim, events };
}

const solver = (sim: RunSim) => {
  const sol = solutions(sim.starts[sim.seg], sim.segment)[0];
  return sol.lanes[Math.min(sim.row, sol.lanes.length - 1)];
};

test('layout is beat-aligned so gates land on the beat', () => {
  for (const L of LEVELS) {
    for (const s of layoutLevel(L)) {
      for (const z of [s.startZ, ...s.rowZ, s.tunnelZ, s.endZ]) assert.equal(z % METERS_PER_BEAT, 0);
    }
  }
});

test('every level is completable end-to-end with lane inputs, clean run ranks S', () => {
  LEVELS.forEach((L, i) => {
    const { sim, events } = play(i, solver);
    assert.equal(sim.phase, 'done', `level ${L.id}`);
    assert.equal(sim.crashes, 0);
    assert.equal(sim.passes, L.segments.length);
    assert.equal(sim.rank, 'S');
    assert.equal(sim.value, L.segments[L.segments.length - 1].tunnel);
    assert.ok(events.some((e) => e.type === 'done'));
    assert.ok(sim.learning.every((e) => e.firstUnaided && e.outcome === 'pass'));
  });
});

test('a sign mistake crashes into the wall, then respawns at the checkpoint', () => {
  // Level 2, segment 1: from −2, "−3" (minus-minus-is-minus) gives −5, tunnel is at +1.
  const L = LEVELS[1];
  const wrongLane = L.segments[0].rows[0].findIndex((op) => op.kind === 'sub' && op.n === 3);
  let crashed = false;
  const sim = new RunSim(L);
  const seen = [];
  for (let i = 0; i < 60 / DT; i++) {
    if (sim.phase === 'run') sim.setLane(sim.seg === 0 && !crashed ? wrongLane : solver(sim));
    sim.step(DT);
    for (const e of sim.drainEvents()) {
      seen.push(e);
      if (e.type === 'crash') crashed = true;
    }
    if (sim.seg >= 1) break;
  }
  const crash = seen.find((e) => e.type === 'crash');
  assert.ok(crash && crash.type === 'crash');
  assert.equal(crash.value, -5);
  assert.equal(crash.tunnel, 1);
  assert.equal(crash.explanation.correct, null, 'first crash explains the move, does not hand over the answer');
  const respawn = seen.find((e) => e.type === 'respawn');
  assert.ok(respawn && respawn.type === 'respawn');
  assert.equal(respawn.value, -2, 'back at the checkpoint value');
  // respawn comes CRASH_BEATS after the crash: no game over, quick retry
  assert.equal(sim.crashes, 1);
  assert.equal(sim.seg, 1, 'passed on the retry');
  assert.equal(sim.learning[0].outcome, 'crash');
  assert.equal(sim.learning[1].outcome, 'pass');
  assert.equal(sim.learning[1].firstUnaided, false, 'a retry is not a first unaided success');
  assert.ok(CRASH_BEATS * sim.beat <= 2.5, 'respawn within ~2 s');
});

test('second crash on the same segment shows the worked correct path', () => {
  const sim = new RunSim(LEVELS[2]); // level 3, from 4 → −8
  const wrong = LEVELS[2].segments[0].rows[0].findIndex((op) => op.kind === 'mul' && op.n === 2);
  const crashes = [];
  for (let i = 0; i < 60 / DT && crashes.length < 2; i++) {
    if (sim.phase === 'run') sim.setLane(wrong);
    sim.step(DT);
    for (const e of sim.drainEvents()) if (e.type === 'crash') crashes.push(e);
  }
  assert.equal(crashes.length, 2);
  assert.equal(crashes[0].type === 'crash' && crashes[0].explanation.correct, null);
  const c = crashes[1].type === 'crash' ? crashes[1].explanation.correct : null;
  assert.ok(c);
  assert.equal(c!.length, 1);
  assert.equal(c![0].op.kind, 'mul');
});

test('ghost preview shows each lane result, costs the multiplier and is logged', () => {
  const sim = new RunSim(LEVELS[0]);
  assert.deepEqual(sim.ghostPreview(), [5, -3, 3]);
  // clean streak of 4 builds the multiplier, then a ghost on segment 5 drops it
  const { sim: s2, events } = play(0, solver, { ghostOnSeg: 4 });
  const passes = events.filter((e) => e.type === 'pass');
  assert.equal(passes[3].type === 'pass' && passes[3].multiplier, 2);
  const hinted = passes[4];
  assert.ok(hinted.type === 'pass' && hinted.hinted && hinted.multiplier === 1);
  assert.ok(passes[5].type === 'pass' && passes[5].combo === 1, 'streak restarts after a ghost pass');
  assert.equal(s2.hints, 1);
  assert.equal(s2.rank, 'A');
  assert.equal(s2.learning[4].hint, true);
  assert.equal(s2.learning[4].firstUnaided, false);
  assert.ok(events.some((e) => e.type === 'hint'));
});

test('transfer level ignores the ghost (no hints there)', () => {
  const { sim } = play(6, solver, { ghostOnSeg: 0 });
  assert.equal(sim.hints, 0);
  assert.equal(sim.rank, 'S');
});

test('slower tempo is slower, same decisions', () => {
  const normal = new RunSim(LEVELS[0], 'normal');
  const slow = new RunSim(LEVELS[0], 'slow');
  assert.ok(slow.speed < normal.speed);
  assert.ok(new RunSim(LEVELS[6], 'normal').speed > normal.speed, 'ice station is faster');
});

test('scoring helpers', () => {
  assert.deepEqual([0, 3, 4, 8, 12, 40].map(multiplierFor), [1, 1, 2, 3, 4, 4]);
  assert.equal(rankFor(0, 0), 'S');
  assert.equal(rankFor(1, 1), 'A');
  assert.equal(rankFor(4, 2), 'B');
  assert.equal(rankFor(9, 0), 'C');
});

test('segment starts chain from the previous tunnel', () => {
  for (const L of LEVELS) {
    const s = segmentStarts(L);
    for (let i = 1; i < s.length; i++) assert.equal(s[i], L.segments[i - 1].tunnel);
  }
});

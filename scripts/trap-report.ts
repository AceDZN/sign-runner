import { LEVELS, allPaths, segmentStarts, solutions } from '../src/levels';
import { apply, misconceivedApply, Misconception, opLabel, num } from '../src/rules';
const ms: Misconception[] = ['addNegMovesUp','minusMinusIsMinus','negTimesNegIsNeg','negSquareIsNeg','divAlwaysSmaller'];
for (const L of LEVELS) {
  const st = segmentStarts(L);
  const lanes = L.segments.map((s, i) => solutions(st[i], s)[0].lanes.join(''));
  const traps: Record<string, number[]> = {};
  for (const m of ms) {
    traps[m] = [];
    L.segments.forEach((seg, i) => {
      const believed = allPaths(st[i], seg.rows).filter((p) => { let v = st[i]; p.lanes.forEach((ln, r) => { v = misconceivedApply(m, seg.rows[r][ln], v) ?? apply(seg.rows[r][ln], v); }); return v === seg.tunnel; });
      if (believed.some((p) => p.final !== seg.tunnel)) traps[m].push(i + 1);
    });
  }
  console.log(`L${L.id} lanes=${lanes.join(' ')}`, JSON.stringify(traps));
}

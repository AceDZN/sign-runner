import { LEVELS, segmentStarts, allPaths, solutions } from '../src/levels';
import { opLabel, num } from '../src/rules';
for (const L of LEVELS) {
  const starts = segmentStarts(L);
  console.log(`L${L.id} ${L.name}`);
  L.segments.forEach((s, i) => {
    const sols = solutions(starts[i], s);
    const finals = allPaths(starts[i], s.rows).map((p) => `${p.lanes.join('')}:${p.final === null ? 'X' : p.final}`).join(' ');
    const flag = sols.length === 1 ? 'ok' : `!! ${sols.length} solutions`;
    console.log(`  ${i + 1}. ${num(starts[i])} -> ${num(s.tunnel)}  [${s.rows.map((r) => r.map(opLabel).join(' | ')).join(' ; ')}]  ${flag} sol=${sols.map((p) => p.lanes.join('')).join(',')}  ${s.rows.length > 1 ? finals : ''}`);
  });
}

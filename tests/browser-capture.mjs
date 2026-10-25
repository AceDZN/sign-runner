// Real-browser play-through and gameplay captures. Needs the dev server on :5211 (npm run dev).
// Usage: node tests/browser-capture.mjs [outDir]
// Plays with real key presses. Lane choices are computed here from the gate labels the game
// reports (an independent parser of Workbook notation), never from game internals.
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const out = process.argv[2] ?? 'docs/screenshots';
const QUICK = process.argv.includes('--quick'); // visuals only, skip full play-throughs
mkdirSync(out, { recursive: true });
const base = 'http://localhost:5211/?test';
const browser = await chromium.launch({ channel: 'chrome', args: ['--use-angle=metal', '--enable-gpu', '--ignore-gpu-blocklist'] });
const errors = [];
const report = [];

async function page(viewport, touch = false) {
  const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch });
  const p = await ctx.newPage();
  p.on('console', (m) => m.type() === 'error' && errors.push(m.text()));
  p.on('pageerror', (e) => errors.push(String(e)));
  await p.goto(base);
  await p.waitForFunction(() => typeof window.render_game_to_text === 'function');
  await p.waitForFunction(() => JSON.parse(window.render_game_to_text()).models.gate !== undefined);
  await p.waitForTimeout(2500); // fonts + models
  return p;
}
const shot = (p, name) => p.screenshot({ path: `${out}/${name}.jpg`, type: 'jpeg', quality: 84 });
const state = async (p) => JSON.parse(await p.evaluate(() => window.render_game_to_text()));
const adv = (p, ms) => p.evaluate((m) => window.advanceTime(m), ms);

// ---- independent Workbook-notation evaluator
function evalGate(label, v) {
  const s = label.replace(/−/g, '-').replace(/\s/g, '');
  if (s === '()²') return v * v;
  if (s === '()³') return v * v * v;
  const m = s.match(/^([+\-×÷])\(?(-?\d+)\)?$/);
  if (!m) throw new Error(`unparsed gate ${label}`);
  const n = Number(m[2]);
  if (m[1] === '+') return v + n;
  if (m[1] === '-') return v - n;
  if (m[1] === '×') return v * n;
  if (n === 0 || v % n !== 0) return NaN;
  return v / n;
}
function plan(st) {
  const rows = st.gatesAhead;
  const best = [];
  const walk = (i, v, lanes) => {
    if (i === rows.length) { if (v === st.tunnel.height) best.push(lanes); return; }
    rows[i].lanes.forEach((g) => walk(i + 1, evalGate(g.gate, v), [...lanes, g.lane]));
  };
  walk(0, st.value, []);
  return best;
}
async function steerTo(p, lane) {
  let st = await state(p);
  while (st.lane !== lane) {
    await p.keyboard.press(st.lane < lane ? 'ArrowRight' : 'ArrowLeft');
    st = await state(p);
  }
}
/** Advance until the runner is `dist` metres before the next gate row (or tunnel). */
async function runUntil(p, dist) {
  for (let i = 0; i < 400; i++) {
    const st = await state(p);
    const d = st.gatesAhead[0]?.distance_m ?? st.tunnel?.distance_m ?? 0;
    if (st.phase !== 'run' || d <= dist) return st;
    await adv(p, 50);
  }
  return state(p);
}
/** Play one level to the end, choosing lanes from the displayed labels. `mistakes` = segment indexes to fail once. */
async function playLevel(p, idx, mistakes = new Set()) {
  await p.evaluate((i) => window.__signRunner.start(i), idx);
  const failed = new Set();
  for (let guard = 0; guard < 2000; guard++) {
    const st = await state(p);
    if (st.phase === 'done') break;
    if (st.phase === 'crash') { await adv(p, 200); continue; }
    if (!st.gatesAhead.length) { await adv(p, 100); continue; }
    const sols = plan(st);
    if (sols.length !== 1) throw new Error(`level ${idx + 1} seg ${st.segment}: ${sols.length} solutions from labels`);
    let lane = sols[0][0];
    if (mistakes.has(st.segment) && !failed.has(st.segment)) { lane = (lane + 1) % 3; if (st.gatesAhead.length === 1) failed.add(st.segment); }
    await steerTo(p, lane);
    await runUntil(p, 2);
    await adv(p, 400); // cross the row
  }
  await adv(p, 2000);
  return state(p);
}

// 1. first 30 seconds: level 1 approaching the first gates (desktop, mockup size)
let p = await page({ width: 1672, height: 941 });
await shot(p, '00-title');
await p.evaluate(() => window.__signRunner.start(0));
await adv(p, 600);
await runUntil(p, 13);
await shot(p, '01-first30-gates');
const s1 = await state(p);
const sol = plan(s1)[0];
await steerTo(p, sol[0]);
await runUntil(p, 0.5);
await adv(p, 700);
await shot(p, '02-after-gate-rising');
await runUntil(p, 2);
await adv(p, 300);
await shot(p, '03-tunnel-pass');
// second segment: go below the waterline correctly
let st = await state(p);
await runUntil(p, 14);
await steerTo(p, plan(await state(p))[0][0]);
await runUntil(p, 0.5);
await adv(p, 900);
await shot(p, '04-below-waterline');
await runUntil(p, 2);
await adv(p, 300);
// third segment: deliberate sign mistake, crash, respawn
st = await runUntil(p, 14);
const good = plan(st)[0][0];
await steerTo(p, (good + 1) % 3);
await runUntil(p, 0.5);
await runUntil(p, -1);
for (let i = 0; i < 40 && (await state(p)).phase !== 'crash'; i++) await adv(p, 50);
await adv(p, 350);
await shot(p, '05-crash');
const crashState = await state(p);
for (let i = 0; i < 80 && (await state(p)).phase === 'crash'; i++) await adv(p, 50);
await adv(p, 200);
await shot(p, '06-respawn');
const respawnState = await state(p);
report.push({ check: 'first 30 s: two correct gates, below the waterline, a crash, respawn', crash: crashState.lastCrash, crashPhase: crashState.phase, respawnPhase: respawnState.phase, respawnValue: respawnState.value, checkpoint: respawnState.checkpointValue, elapsedNote: 'see sim time in log' });

// ghost hint on the retry
st = await runUntil(p, 16);
await p.keyboard.down('Shift');
await adv(p, 300);
await shot(p, '07-ghost-hint');
const ghostState = await state(p);
await p.keyboard.up('Shift');
report.push({ check: 'ghost preview', held: ghostState.ghostHeld, preview: ghostState.ghostPreview, multiplier: ghostState.multiplier, hintUsed: ghostState.hintUsedThisAttempt });

// 2. full play-throughs of every level with lane inputs
const results = [];
for (let i = 0; i < (QUICK ? 0 : 7); i++) {
  const end = await playLevel(p, i, i === 1 ? new Set([2]) : new Set());
  results.push({ level: i + 1, phase: end.phase, mode: end.mode, rank: end.rank, crashes: end.crashes, hints: end.hints, score: end.score });
  if (i === 1) await shot(p, '08-results-level2');
}
report.push({ check: 'all levels played to the end through lane inputs', results });

// 3. underwater mid-play (level 2 start is −2) and the order level
await p.evaluate(() => window.__signRunner.start(1));
await runUntil(p, 12);
await shot(p, '09-underwater');
await p.evaluate(() => window.__signRunner.start(4));
await runUntil(p, 14);
await shot(p, '10-order-two-rows');
await p.evaluate(() => window.__signRunner.start(5));
await runUntil(p, 13);
await shot(p, '11-powers');

// 4. ice station transfer
await p.evaluate(() => window.__signRunner.start(6));
await runUntil(p, 16);
await shot(p, '12-ice-station');
await p.keyboard.down('Shift');
await adv(p, 300);
const iceGhost = await state(p);
await p.keyboard.up('Shift');
report.push({ check: 'no ghost on the transfer level', ghostHeld: iceGhost.ghostHeld, hints: iceGhost.hints });

// 5. pause and restart
await p.keyboard.press('p');
await adv(p, 500);
const paused = await state(p);
await shot(p, '13-paused');
await p.keyboard.press('p');
report.push({ check: 'pause', mode: paused.mode });

// 6. mobile portrait with touch
p = await page({ width: 390, height: 844 }, true);
await p.evaluate(() => window.__signRunner.start(0));
await runUntil(p, 13);
await shot(p, '14-mobile-gates');
const before = (await state(p)).lane;
await p.touchscreen.tap(330, 500);
await adv(p, 100);
const after = (await state(p)).lane;
report.push({ check: 'mobile tap right moves one lane right', before, after });
// crash on mobile to see the card
st = await state(p);
await steerTo(p, (plan(st)[0][0] + 1) % 3);
await runUntil(p, 0.5);
for (let i = 0; i < 60 && (await state(p)).phase !== 'crash'; i++) await adv(p, 50);
await adv(p, 300);
await shot(p, '15-mobile-crash');

report.push({ consoleErrors: errors });
writeFileSync(`${out}/capture-report.json`, JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2));
await browser.close();

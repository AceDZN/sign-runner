# Playtest log — what was verified, and how

Automation can show that the game runs, that the math is right and that a level can be finished through real inputs. It **cannot** show that it's fun or that students learn. Nobody outside the crew has played it yet.

## Unit tests (`npm test`, 32 tests, all passing)

- **Rules** (`tests/rules.test.ts`): Workbook notation with a real minus (`+(−5)`, `−(−3)`, `×(−2)`, `÷(−4)`, `(  )²`), exact arithmetic, inexact division rejected (never rounded), no negative zero, worked expressions keep negatives in parentheses, Hebrew sign rules, misconception models.
- **Levels** (`tests/levels.test.ts`): 7 levels, at least 6 segments each. Every segment has exactly one lane path to its tunnel, and every path through every segment is exact with values within ±30. The handoff's numbers are checked level by level, including both orders in level 5 and the cube `(−2)³ = −8` in level 6. The transfer level is ice-skinned, ghost-free, faster and mixes all five operations.
- **Bypasses:** staying in one lane passes under half of any level. Surface heuristics win at most 60% per level and under 40% overall: "the gate's number equals the distance", "+ when the tunnel is above", and "operand sign = tunnel sign".
- **Misconception traps:** each level has a wrong lane that its target misconception makes look right. Level 1: adding a negative moves up, at least 3. Level 2: minus minus is minus, at least 4. Level 3: negative × negative, at least 3. Level 4: negative ÷ negative at least 3, and dividing makes smaller. Level 6: (−3)² = −9, at least 2. Level 7: at least 3 different misconceptions.
- **Simulation** (`tests/sim.test.ts`):
  - Gates are beat-aligned, and every level is completed through lane inputs with an S rank.
  - A sign mistake crashes with the advertised value and respawns at the checkpoint value in 4 beats (2.4 s at normal tempo). It's logged as a crash, and the retry isn't counted as first-unaided.
  - The first crash explains your own move; the second crash on the same segment shows the correct path.
  - The ghost preview gives the right lane results, drops the multiplier to ×1, restarts the streak and is logged. The transfer level ignores it.
  - Slow tempo really is slower. The segment index stays valid after the finish (regression test for a crash found in the browser).
- **Fresh variants** (`tests/generator.test.ts`, 25 seeds × 7 levels):
  - Each variant keeps the start value and row structure, has exactly one exact path per segment, and has no zero gates.
  - Level 1 only adds, and each level's own operation drives at least half the segments (powers at least 40%).
  - Levels 3 and 4 don't collapse into ×(±1)/÷(±1). No constant lane wins.

## Independent math review (`docs/MATH_REVIEW.md`)

A separate reviewer re-solved all 60 authored segments with their own exact-fraction evaluator (not `rules.ts`), checked terms against Workbook pages, and hunted for bypasses. All must-fix and most should-fix items were applied:
- Four Hebrew rule strings were mathematically wrong and are now corrected.
- Labels were clipped by the arch pillars.
- The generator locked into ±1 and could produce `+0` gates.
- Level 5 segment 3 wasn't an order puzzle.
- The crash card now says when the right two gates were taken in the wrong order.
- Address is plural throughout; ציר המספרים and ערך מוחלט are now visible; the intro card has Workbook links.

## Real browser (`tests/browser-capture.mjs`, headless Chrome on Metal)

Real key presses, `?test` mode, the game's own `advanceTime`. Lanes are chosen by a parser in the test script that reads the gate labels the game reports. It's independent of the game's rules code. Results from the last run (`docs/screenshots/capture-report.json`):

- **First 30 s:** two correct gates, a drop below the waterline (with the "מתחת לקו המים!" banner), then a deliberate wrong lane. The crash showed `−2 + (−6) = −8` against a tunnel at −6, and the respawn came back at the checkpoint value −2.
- **Ghost:** holding Shift showed `[2, −6, −8]`, set the multiplier to ×1 and marked the hint.
- **All 7 levels played to the end** through lane inputs: levels 1 and 3–7 ranked S. Level 2 got rank A because of one deliberate crash, and play continued after it.
- **Transfer level:** Shift does nothing (`hints: 0`).
- **Pause:** P pauses the game.
- **Phone (390×844, touch):** a tap on the right half moves one lane right.
- **Console errors:** none.

## Built game, frame rate (`tests/perf.mjs` against `npm run preview`)

Measured in real time (400 frames each) on this Mac (Chrome, Metal):
- **Desktop (1672×941):** 59.6–59.9 fps, p95 frame 16.8 ms.
- **Phone-sized viewport (390×844 @2x):** 59.7–59.9 fps, p95 16.7 ms.

That's the 60 Hz vsync cap. It isn't a real phone, so phone performance is **unverified**. If the average drops below 38 fps the game turns bloom off by itself.

Build: `dist/` is 3.6 MB. JS is 748 KB (196 KB gzipped) and the models are 1.8 MB. Fonts and models are bundled; there are no runtime fetches.

## Also checked

- Hebrew RTL HUD with LTR math. The reviewer measured glyph positions in real Chrome: no flipped minus signs.
- Resize, portrait and landscape phone layouts.
- Auto-pause on blur or hidden tab (off in `?test`).
- The WebGL context-lost screen.
- Reduced-motion toggle (no slow-mo, fewer particles, no camera roll), mute, slower tempo.

## Not verified

- Fun, learning and readability for real 13-year-olds.
- Sound: the procedural music and effects were written and wired, but nobody listened to them in this session.
- A real phone or tablet, Safari, and slow GPUs.
- Long sessions: the previous level's textures, materials and geometry are disposed on rebuild, but memory over many replays was not measured.

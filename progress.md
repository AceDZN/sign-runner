# Progress — Sign Runner

## 2026-10-25 / 26 (builder crew, round 3)

- Repo created locally at `/Users/acedzn/dev/AceDZN-exp/sign-runner` with the handoff in `docs/handoff/` and Workbook snapshots in `workbook/`.
- Public GitHub repo: first refused by the session's permission classifier; created on 2026-10-26 after the user's go-ahead: https://github.com/AceDZN/sign-runner
- Visual helper generated 4 ChatGPT gameplay mockups (`docs/visual-targets/`) and Tripo models (`ASSETS.md`).
- Rules (`src/rules.ts`), 7 authored levels (`src/levels.ts`), path solver and deterministic run sim (`src/sim.ts`) with unit tests. Tuning the levels against the tests found: level 5's brief numbers can't chain (after the −8 tunnel you're at −8), so segment 2 is from −8: `+6` then `×(−1)` = 2 (other order 14), which still forces both orders. Several two-row segments had 0 or 2 solutions and were re-authored; level 2 leaned on the right lane; levels 3, 4 and 6 lacked misconception traps and were re-authored.
- 3D scene, HUD, audio, generator. Headless play-through found a real bug: finishing a level crashed the scene (segment index ran past the end). Fixed in the sim, with a test.
- Visual fixes from the first captures: tunnel walls are bounded to reachable heights (they read as towers before), road bloom calmed, bigger gate labels, camera raised so the runner doesn't cover the middle label, altitude unit raised from 1.2 m to 2 m so the camera dives with you at −1, walls hidden once you're through (camera clipped into them), brighter sea.

- Rigged Tripo runner integrated (run/jump/dive/hit/cheer; hips root motion stripped), plus arch, buoy, jellyfish, manta, polar hut.
- Independent math review (`docs/MATH_REVIEW.md`): all 60 segments verified; applied the must-fixes (four wrong Hebrew rule strings, clipped labels, generator ±1 lock-in and zero gates) and most should-fixes (plural address, reversed-order crash message, stronger level-3 traps, real order puzzle in level 5 segment 3, Workbook links, visible ציר המספרים / ערך מוחלט, ghost-heavy runs rank lower).
- Visual review against the mockups (`docs/VISUAL_REVIEW.md`), phone portrait/landscape layouts, 60 fps measured on this Mac, all 7 levels played to the end in real Chrome.

## Open

- Not verified: fun and learning with real students, sound by ear, a real phone.
- Ideas not built: endless mode with streak records; coral/light shafts underwater; a crisper ice level.

# Progress — Sign Runner

## 2026-10-25 / 26 (builder crew, round 3)

- Repo created locally at `/Users/acedzn/dev/AceDZN-exp/sign-runner` with the handoff in `docs/handoff/` and Workbook snapshots in `workbook/`.
- **Public GitHub repo not created yet.** `gh repo create AceDZN/sign-runner --public --source . --push` was refused by the session's permission classifier ("Create Public Surface"). Everything is committed on local `main`; it needs the user's go-ahead (or them running that one command) to publish.
- Visual helper generated 4 ChatGPT gameplay mockups (`docs/visual-targets/`) and Tripo models (`ASSETS.md`).
- Rules (`src/rules.ts`), 7 authored levels (`src/levels.ts`), path solver and deterministic run sim (`src/sim.ts`) with unit tests. Tuning the levels against the tests found: level 5's brief numbers can't chain (after the −8 tunnel you're at −8), so segment 2 is from −8: `+6` then `×(−1)` = 2 (other order 14), which still forces both orders. Several two-row segments had 0 or 2 solutions and were re-authored; level 2 leaned on the right lane; levels 3, 4 and 6 lacked misconception traps and were re-authored.
- 3D scene, HUD, audio, generator. Headless play-through found a real bug: finishing a level crashed the scene (segment index ran past the end). Fixed in the sim, with a test.
- Visual fixes from the first captures: tunnel walls are bounded to reachable heights (they read as towers before), road bloom calmed, bigger gate labels, camera raised so the runner doesn't cover the middle label, altitude unit raised from 1.2 m to 2 m so the camera dives with you at −1, walls hidden once you're through (camera clipped into them), brighter sea.

## Next

- Integrate the rigged runner when exported; visual review vs. mockups; math review fixes; mobile check; docs; push (pending permission).

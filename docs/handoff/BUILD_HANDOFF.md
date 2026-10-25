# Sign Runner — רץ הסימנים — build handoff

Read `../COMMON.md` first. Repo `/Users/acedzn/dev/AceDZN-exp/sign-runner` → public `AceDZN/sign-runner`, port 5211 (preview 4211).

## Promise

Thumper meets the number line. You're a runner on a pulsing neon track at night, and **your number is your altitude**. Zero is a glowing waterline. Positive numbers ride above it through the sky; negative numbers dive under it through a bioluminescent sea, with bubbles, muffled music and a cyan tint. Lane gates on the beat apply an operation to your number, and you rise or sink instantly to match. Ahead, **tunnels sit at fixed heights**. Pick the lane whose operation puts you exactly at the tunnel's height, or smash into the wall, lose the combo and respawn at the last checkpoint. Fast, loud, readable. The fun is reading ahead and nailing a 20-gate streak. You learn signed-number rules because they're the only way through.

Map evidence: Thumper × Human Resource Machine is the emptiest related blend this round (density 0.623); Thumper is at the 74.2nd originality percentile. Flip Side (VVVVVV × Baba Is You, 0.656) is the same topic as a gravity platformer; don't build both.

## Curriculum (Workbook grade 7, chapter 7)

[number-line-expanded](https://math.workbook.co.il/grade-7/chapter-7/number-line-expanded), [opposite-numbers](https://math.workbook.co.il/grade-7/chapter-7/opposite-numbers), [adding-directed](https://math.workbook.co.il/grade-7/chapter-7/adding-directed), [subtracting-directed](https://math.workbook.co.il/grade-7/chapter-7/subtracting-directed), [multiplying-directed](https://math.workbook.co.il/grade-7/chapter-7/multiplying-directed), [dividing-directed](https://math.workbook.co.il/grade-7/chapter-7/dividing-directed), [order-of-ops-directed](https://math.workbook.co.il/grade-7/chapter-7/order-of-ops-directed), [negative-base-powers](https://math.workbook.co.il/grade-7/chapter-7/negative-base-powers). Snapshots are in the curriculum folder.

Rules: exact integer arithmetic (never floats; division gates are always exact). Gate labels use Workbook notation with parentheses around negatives: `+(−5)`, `−(−3)`, `×(−2)`, `÷(−4)`, `(  )²`. Same signs give a positive product/quotient, different signs a negative one. Subtracting a number = adding its opposite. A power gate squares the current value, so (−3)² = 9. Never show the ambiguous −3² form as a gate. Directed-number terms: מספר מכוון, מספר נגדי, ציר המספרים, ערך מוחלט.

Misconceptions to catch: "minus minus is minus"; "a negative times a negative is negative"; "dividing always makes it smaller"; adding a negative moves you up; (−3)² = −9.

## Loop

- 3 lanes (A/D or ←/→, swipe on touch). Gates sit on the beat every few bars. Your current number floats over the runner as a big LTR readout and also *is* your height on a visible number-line scale beside the track.
- Look-ahead: the next tunnel's height is always visible on the scale. Hold **Shift / two-finger hold** for a "ghost" preview of each lane's result. It's a hint, logged, and costs combo multiplier.
- Crash: wall impact, a slow-motion shatter, a short worked explanation ("4 × (−2) = −8: different signs → negative"), respawn at the checkpoint within ~2 s. No game over; a level ends with a rank by crashes, hints and combo.
- Tempo options: normal and slower (no reading-speed penalty).

## Levels (author exactly; tests prove each gate sequence)

1. **Waterline** — adding. Start 0 → tunnel at +3 (lanes `+3` ✓ / `+(−3)` / `+5`). Then tunnel −2 (`+(−5)` ✓ from 3).
2. **Minus a minus** — from −2 → tunnel +1: `−(−3)` ✓, `−3` → −5 ✗, `+(−3)` → −5 ✗.
3. **Flip** — from 4 → tunnel −8: `×(−2)` ✓, `−(−4)` → 8 ✗, `×2` → 8 ✗. Introduce `×(−1)` as the "mirror gate" across the waterline.
4. **Split** — from −12 → tunnel +3: `÷(−4)` ✓, `÷4` → −3 ✗, `−(−4)` → −8 ✗.
5. **Order matters** — lanes cross so you hit two gates in either order. From 3: `×(−1)` then `+(−5)` = −8; `+(−5)` then `×(−1)` = 2. Tunnels at −8 and then 2 force both orders.
6. **Powers** — from −3, `(  )²` → 9 ✓ for a tunnel at +9. Then from −2 a cube gate → −8 for a tunnel at −8.
7. **Transfer: Ice Station (no ghost, new skin)** — the track becomes a thermometer in a polar station: altitude = temperature in °C, below zero is ice. Faster tempo, mixed gates, two-gate chains, unfamiliar values (e.g. from −15: `÷(−5)` then `−(−4)` → 7).

After the slice works: an endless mode where gates and tunnels are generated with a solver that guarantees exactly one lane (or one order) reaches each tunnel, plus streak records.

## 3D and art

Neon synthwave night above the waterline, deep-sea glow below; the camera tilts and the audio filter changes when you cross zero. Procedural: track, gates, tunnels and the number-line scale (all exact). Tripo: the **runner hero** (rigged, Mixamo run/jump/stumble/cheer), a **gate frame** or guardian prop, plus underwater and sky set dressing (a jellyfish swarm, a lighthouse buoy at zero). Music: bundled royalty-free or procedural WebAudio beats; record sources in `ASSETS.md`.

## Acceptance

In the first 30 seconds: hit two correct gates, see yourself drop below the waterline as the world changes, crash once on a sign mistake, and respawn instantly. Every gate result and tunnel height comes from the pure rules module; tests cover every authored sequence and the ghost-preview penalty.

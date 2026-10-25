# Visual review — mockups vs. the real game

Targets: `docs/visual-targets/sr-target-0{1..4}-*.jpg` (ChatGPT image generation, 1672×941, design targets only).
Actual: `docs/screenshots/*.jpg`, captured by `tests/browser-capture.mjs` in headless Chrome (Metal GPU) at the same 1672×941 viewport, through real key presses and the game's own `advanceTime` clock (no injected states). Phone captures are 390×844 portrait.

Three capture rounds were compared before this one (`test-output/`, not committed); the fixes they drove are listed per pair.

## 1. First 30 seconds — `sr-target-01-first30` vs `01-first30-gates`, `02-after-gate-rising`, `03-tunnel-pass`

| | Target | Actual | Verdict |
|---|---|---|---|
| Camera | Low chase cam, runner bottom-centre, track to a centre vanishing point | Same framing; runner a little smaller | Match |
| Sky / world | Magenta→violet sky, striped sun, wireframe mountains, cyan hex water, red buoy right | All present (procedural sky/sun/mountains, hex water texture, Tripo buoy) plus Tripo manta gliders | Match |
| Gates | 3 neon arches, dark label panels, chevrons | Tripo arch ×3 with procedural Workbook-notation panels and chevrons | Match |
| Tunnel | Wall behind gates, slot with big `+3` to the right | Wall with glowing slot and `+3` painted on both sides | Match (both sides, by choice) |
| HUD | Logo TL, score/×N/streak pills TC, level + dots TR, ruler left with `מנהרה: +3` chip, ghost/pause/mute bottom | Same layout and hierarchy; ruler is labelled ציר המספרים | Match |
| Readout | Big italic `0` lower-left of the runner | Same, colour by sign plus an explicit sign | Match |

Fixes driven by earlier rounds: the tunnel wall first read as a 40 m tower (now bounded to the heights a wrong path can reach); the road bloomed to solid pink (darker glass road, calmer bloom); labels were too small at decision distance (bigger text, wider lanes); the runner's head covered the middle label (higher camera and panels); arch pillars clipped the outer characters of `×(−2)` and `−(−4)` (panels now in front of the arch, found by the math reviewer); passing through a slot whited out the screen (thinner frames, walls hide once passed).

## 2. Underwater — `sr-target-02-underwater` vs `09-underwater`, `04-below-waterline`, `07-ghost-hint`

| | Target | Actual | Verdict |
|---|---|---|---|
| Medium | Teal/navy sea, bright caustic ceiling, light shafts, bubbles, jellyfish | Teal fog, hex caustic ceiling seen from below, sun glow through the surface, round bubbles, Tripo jellyfish (translucent, emissive), music low-passed | Close; no volumetric light shafts, no coral or ruins |
| Track | Glassy road continuing underwater | Glass road (62% opacity) so slots and ghosts below your altitude stay visible | Match |
| Trail | Stepped line of past values top-left | Stepped trail drawn beside the ruler | Match (smaller) |
| Ghost | (not in target) | Translucent runners with value badges at each lane's result height; the one that fits the slot turns green | Added |

Fixes: at 1.2 m per unit the camera stayed above water at −1/−2, so the dive didn't read; the unit is now 2 m and the camera stays on the runner's side of the waterline. Ghost markers were hidden by the opaque road; they now draw on top.

## 3. Crash — `sr-target-03-crash` vs `05-crash`, `15-mobile-crash`

| | Target | Actual | Verdict |
|---|---|---|---|
| Moment | Slow-motion smash, magenta glass shards, cartoon tumble | 0.7 s slow motion, 60 shards, camera shake, Tripo `hit_to_body_01` clip, runner knocked back | Match |
| Crash card | Right third: "בום!", worked line in a cyan pill, rule, "the tunnel needed…" pill, countdown ring | Same structure. Worked line LTR (`−2 + (−6) = −8`), rule, `המנהרה בגובה −6, הגעתם ל־−8`, countdown in beats | Match; the target's RTL-flipped math (`−8 = (−2)× 4`) is not reproduced |
| Combo pill | Cracked, red `0` | Turns red and shakes | Match (no crack texture) |
| Ruler | Dotted arrow between result and tunnel | Marker at the result, bracket at the tunnel, no arrow | Minor deviation |

## 4. Ice Station — `sr-target-04-ice-station` vs `12-ice-station`

| | Target | Actual | Verdict |
|---|---|---|---|
| Ruler | Glass thermometer in °C | Thermometer: °C header, `°` labels, mercury column ending at the current value (red above 0, blue below) | Match (the target's mercury was wrong) |
| Gates | Two rows, near big and far small | Two rows; the later row floats higher so it's readable over the near one | Match |
| Readout / ghost | `−15°C`; ghost button with a padlock | `−15°C`; ghost button dimmed and inactive | Match |
| World | Aurora, snow, ice shelf, research hut | Aurora sky and snow above 0°C, Tripo polar hut; but the level starts at −15°C, so you mostly see the under-ice side: a pale blue ice cave with a hex-ice ceiling | **Deviation**: much paler and less crisp than the target; the tall ice walls read as blank slabs |

## Phone (390×844) — `14-mobile-gates`, `15-mobile-crash`

The desktop ruler covered the left gate on a phone. Phones now get a short pillar-only ruler in the sky area, and the "מנהרה" callout moves to a chip under the pills. The crash card becomes a bottom sheet. Landscape phones (844×390) get a compact layout with the controls bottom-right.

## Remaining honest deviations

- No volumetric light shafts, coral or ruins underwater; ice level is paler than its target.
- The runner is smaller in frame than in the mockups (the camera has to show the next tunnel slot above or below you).
- Crash shards are pink tetrahedra, not cracked wall pieces.
- Captures come from headless Chrome on a Mac GPU; no real phone was used.

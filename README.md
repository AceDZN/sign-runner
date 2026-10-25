# Sign Runner — רץ הסימנים

A Thumper-style 3D rhythm runner for grade-7 directed numbers (Workbook grade 7, chapter 7). **Your signed number is your altitude.** Zero is a glowing waterline: positive numbers race through a synthwave night sky, negative numbers dive into a bioluminescent sea. Gates on the beat change your number; tunnels ahead have one slot at a fixed height. Pick the lane that lands you exactly on the slot, or smash into the wall and respawn at the checkpoint two seconds later.

Hebrew UI (RTL), numbers and operations always LTR in Workbook notation: `+(−5)`, `−(−3)`, `×(−2)`, `÷(−4)`, `(  )²`.

## Run

```bash
npm install
npm run dev        # http://localhost:5211
npm test           # unit tests: rules, levels, sim, generator
npm run build      # static build in dist/ (typechecks first)
npm run preview    # http://localhost:4211, serves dist/
npm run capture    # headless Chrome play-through + screenshots (needs npm run dev running)
```

## Controls

| | Desktop | Phone / tablet |
|---|---|---|
| Change lane | ← → or A D | swipe, or tap the left/right half |
| Ghost hint (shows where each lane puts you; resets the multiplier to ×1) | hold Shift | hold the 👻 button, or two fingers |
| Pause | P or Esc | ❚❚ |
| Mute | M | 🔊 |

Options on the title screen: normal or slower tempo (100 / 80 BPM), reduced motion, mute.

## What's implemented

- 7 authored levels (about 6–8 minutes for a clean run): adding, subtracting, multiplying (×(−1) "mirror gate"), dividing, order of operations (two gate rows per tunnel), powers with a negative base, and a transfer level, **Ice Station**: a thermometer in °C, new skin, faster, no ghost hint.
- Every gate result, tunnel height and explanation comes from the pure rules module (`src/rules.ts`), integer-exact. Every segment has exactly one path to its tunnel (`tests/levels.test.ts`).
- Crash: slow-motion shatter, a worked line (`4 × (−2) = −8 · סימנים שונים ← שלילי`) and where the tunnel was; the second crash on a segment also shows the path that goes through. Respawn at the segment start, no game over. Rank S/A/B/C by crashes and ghost uses.
- Combo streak and multiplier, synthwave music generated in WebAudio and scheduled on the simulation clock so gates land on the beat; the music is muffled underwater.
- "שוב, עם תרגילים חדשים": seeded, solver-verified fresh variants of each level (`src/generator.ts`).
- Anonymous local learning log (localStorage) separating first unaided decisions from hinted or repeated ones.
- Tripo 3D models (runner hero rigged with animations, gate arch, lighthouse buoy, jellyfish, polar hut), see `ASSETS.md`. Everything that shows math (ruler, gates' labels, tunnel slots and numbers) is procedural and exact.
- Test hooks: `window.render_game_to_text()`, `window.advanceTime(ms)`; `?test` disables auto-pause on blur and exposes `window.__signRunner.start(levelIndex)`.

Planned, not built: an endless mode with streak records.

## Deploy (Vercel)

It's a static Vite site with a relative base, so `dist/` works from any path.

- Framework preset: **Vite**. Build command `npm run build`, output directory `dist`, install `npm install`.
- Or from the CLI: `npx vercel` in this folder (preview), `npx vercel --prod` for production.
- No environment variables, no backend, no runtime network requests (fonts and models are bundled).

## Docs

`GAME_IDENTITY.md` (visual thesis), `CURRICULUM.md` (level → Workbook module, misconception), `ASSETS.md` (Tripo models, prompts, credits), `docs/visual-targets/` (ChatGPT gameplay mockups) and `docs/VISUAL_REVIEW.md` (mockup vs. real captures), `docs/MATH_REVIEW.md` (independent math review), `PLAYTEST.md` (what was verified and how), `progress.md` (build log), `docs/handoff/` (the brief).

# Math 3D games, round 3 — shared builder rules

25 October 2026. Read this, then your game's `BUILD_HANDOFF.md`. Ideas, map evidence and why these games: `/Users/acedzn/idea-plotter/reports/math-games-2026-10-25/IDEAS.md`. Also read `/Users/acedzn/idea-plotter/reports/design-reset-2026-10-24.md`: earlier builders were stopped because their games were the same courier loop with the same toy look. Don't repeat that.

The bar to beat is the user's three released math games (Pizza Pi, Rooftop Hypotenuse, Goose on the Scale), which the user and their kids played and approved. They are in `/Users/acedzn/idea-plotter/prototypes/` (Pizza Pi: `github.com/AceDZN/pizza-pi`). Look at how they handle Hebrew RTL HUDs, juice, rigged Tripo characters and `render_game_to_text`, but don't copy their loops or look.

## Authorization (the user's words)

The user, an edtech founder who owns Workbook, asked on 25 Oct 2026: "now I want you to ideate and start builder crews for 3 other math games - same way as before, ideation cycle, then open a new thread for each game builder team. make sure to use the workbook math curriculum - you can choose whatever grade/topic you want." Earlier, for the same series: "the main target is games that are heck of fun to play but you learn stuff along the way", for Hebrew-speaking students, taught according to the Israeli Ministry of Education curriculum as published in Workbook. Build now; no further kickoff approval is needed. "Same way as before" means this standing workflow from the user, verbatim:

```
Don't forget to build it as real 3d fun games.
Before starting development - generate 'game screenshots' images (real gameplay images using gpt-image through the chatgpt webapp  https://chatgpt.com/ on my chrome browser ) - then use tripo 3d to generate models, create the game, then review it in front of the 'screenshots' to really build the same gameplay ui/ux as it is in the planning and  mockups.

use my chrome browser tripo.ai to create the 3d models ([https://studio.tripo3d.ai/workspace/generate/](https://studio.tripo3d.ai/workspace/generate/) ).
if the 3d model needs animation (like characters) - make sure to rig them in tripo (simple mixamo rigs for full body animation, more complicated rigs for stuff like rigging face animations - Tripo has many rigging options and pre-defined animation but also "ai animations" for custom stuff).

btw,create it as a new public repo on my github (AceDZN). I think that I'll deploy it to one of our vercel servers soon because its pretty fun.. you can use my chrome browser for that as well . don't forget to commit your changes from time to time all to the same main branch for now (or open prs for side-tracks)
```

This is a prototype experiment and does not change Idea Plotter's G1/G2 gates. Never edit the Idea Plotter `spec/`.

## Your repository

| Game | Local repo | GitHub (public) | Dev / preview port |
|---|---|---|---|
| Sign Runner | `/Users/acedzn/dev/AceDZN-exp/sign-runner` | AceDZN/sign-runner | 5211 / 4211 |
| Splash Arc | `/Users/acedzn/dev/AceDZN-exp/splash-arc` | AceDZN/splash-arc | 5212 / 4212 |
| Bank Shot | `/Users/acedzn/dev/AceDZN-exp/bank-shot` | AceDZN/bank-shot | 5213 / 4213 |

- **First step:** create the local repo, copy this `COMMON.md` and your `BUILD_HANDOFF.md` into `docs/handoff/`, commit on `main`, and create the **public** GitHub repo with `gh repo create AceDZN/<slug> --public --source . --push` (`gh` is logged in as AceDZN). If it already exists, clone it and continue.
- Work and commit only inside your repo. Commit meaningful checkpoints to `main` and push regularly (at least after each working milestone). Side-tracks go on a branch + PR. No force pushes, no history rewrites.
- Deployment: prepare a Vercel-ready static build and README instructions. Don't deploy unless the user asks.
- The Idea Plotter checkout and other games' repos are read-only context. Never touch them.
- `strictPort: true`. Ports 3000, 5173–5210 and 5299 belong to the explorer and other games. Never kill a process you didn't start. Gitignore `node_modules`, `dist`, test output.
- Add `.claude/launch.json` with your dev server so you can use the built-in browser preview tools.

## Crew

You're the crew lead and own gameplay, integration and Git. Use the Agent tool to run real helpers in parallel with clear file ownership:

1. **Visual/Chrome builder:** gameplay mockups in ChatGPT, Tripo models and rigs in Chrome, art direction, scene, lighting, animation, sound, `ASSETS.md`. Only this role drives Chrome.
2. **Independent math reviewer + playtester:** checks every rule, number and Hebrew term against the saved Workbook modules and your handoff, verifies each level's solution by hand, plays real sequences, and hunts for bypasses (a constant strategy that wins, eyeballing that makes the math unnecessary) and misconceptions. Must not claim fun or learning gains from automation.

Helpers report changes; the lead serializes commits.

## Step 1 — gameplay "screenshots" in ChatGPT (before development)

Use the user's Chrome via the Claude in Chrome tools (`mcp__claude-in-chrome__*`; load them all in one ToolSearch call; read the `anthropic-skills:chrome-browser` skill first).

- **Shared browser:** three crews and possibly other agents use this Chrome at once. Open **your own new tab**, work only there, and never touch, reload, close or navigate any other tab. If a page is busy with another task's conversation, start a new chat.
- Go to https://chatgpt.com/ and generate **2–4 gameplay screenshot mockups** with its image generation (gpt-image): the first 30 seconds, the core action mid-play, a failure/consequence moment, and optionally the HUD close-up. Prompt for an in-game screenshot of a 3D browser game with the camera, scene, HUD and Hebrew RTL UI from your `GAME_IDENTITY.md`. Iterate until it looks like a game a 13-year-old would want to play, not an edtech worksheet.
- Download through the normal UI and save under `docs/visual-targets/`, with the exact prompts, chat URL and date in `docs/visual-targets/PROMPTS.md`. These are design targets, never evidence of the implemented game. Generated Hebrew text in images is often wrong: copy the layout, not the text.
- If ChatGPT is not signed in or refuses, say so plainly in `progress.md` and keep going with the written identity. Don't use another account, API key or paid upgrade.

## Step 2 — Tripo models in Chrome

Use https://studio.tripo3d.ai/workspace/generate/ in **your own tab** (the user is signed in).

- Derive an asset list from the mockups. Generate only what gives the game its identity (hero character, key props, landmark set pieces). Budget: **at most 6 model generations and 2 rig/animation jobs per game**, existing credits only. Note the displayed cost of each task. Never buy credits, upgrade, accept a paid plan, use Tripo API endpoints/tokens or another generator. If credits or login block you, keep building with placeholders and report it.
- **Characters that move get rigged in Tripo** (Rig tab: Humanoid + Mixamo preset for full body; richer rigs for faces if needed) and use Tripo's preset or AI animations (idle, run, throw, cheer, react). Export GLB with the animations and play them with `THREE.AnimationMixer`.
- Download GLB through the UI, optimize when large (`npx @gltf-transform/cli optimize` with webp textures, target ≤ 3 MB per model), put it in `public/models/`, and record prompt, task URL, credits, hashes and processing in `ASSETS.md`.
- Generated meshes are never colliders or math surfaces. Number lines, arcs, angles, protractors, tunnels and anything that shows mathematical state are procedural and reflect authoritative state exactly.

## Step 3 — build, then compare with the mockups

Stack: TypeScript + Vite + Three.js, one main WebGL canvas with real depth, lights, shadows and raycasting. Add Rapier only where physics materially matters. Lock dependency versions, commit the lockfile, use a relative Vite base. A static `npm run build` works offline: fonts and models are bundled locally, nothing is fetched at runtime. No backend, accounts, analytics, runtime AI or API keys.

Math rules (operations, curves, angle deduction, level solvers, scoring) live in pure TypeScript modules with no Three.js imports, with unit tests. The scene renders state. Handle resize, pause, restart, focus loss, lost WebGL context, touch and keyboard. Cap DPR at 2. Measure FPS and bundle size; never claim numbers you didn't measure.

Then capture real gameplay at the same viewport, camera and state as each mockup, through real inputs, and store the captures separately. Write `docs/VISUAL_REVIEW.md` comparing target and actual: camera, silhouettes, HUD hierarchy, RTL typography, feedback, lighting and gameplay differences. Fix material differences and recapture; record honest remaining deviations. The reviewer inspects both images and plays.

## Curriculum and language

- Workbook is the source of truth. Saved Markdown snapshots: `/Users/acedzn/idea-plotter/reports/math-games-2026-10-25/curriculum/`. Fetch more with the Workbook MCP (`mcp__workbookMCP__get_page_markdown`, path like `/math/grade-7/chapter-7/subtracting-directed`) or https://www.workbook.co.il/llms-full.txt. Never invent a route. Write `CURRICULUM.md` linking each level to exact module URLs, the skill practiced and the misconception it checks.
- UI language Hebrew: `lang="he" dir="rtl"`, readable bundled Hebrew font (Rubik or Heebo). Numbers, formulas, signs and units go in LTR spans (`<bdi>` / `dir="ltr"`); never let RTL flip a minus sign or parentheses. Use Workbook's Hebrew terms.
- Never color-only feedback. Mute, pause and reduced-motion toggles. No reading-speed penalties (Sign Runner: offer a slower tempo option).
- Teach through action and consequence: a wrong choice produces a visible, funny, recoverable result, never a "wrong answer" popup. No typed-answer gates. A short worked explanation may follow a failure.
- Log anonymous local learning events (level id, values, action, outcome, hint used, retries) in memory or localStorage only. Distinguish first unaided decisions from hinted or repeated successes.

## Quality bar

A polished, finite 6–10 minute vertical slice: a strong first 30 seconds, at least 6 authored levels that escalate, and a final **transfer level** with no hints and a changed situation. Prove one level end-to-end first, then expand. Juice matters: sound after the first gesture, particles, camera shake, satisfying feedback and animated characters. It must feel like a game kids would choose to play. After the slice works, add replay value (fresh solver-verified exercises per level, as the released games do).

Testing:
- Unit tests prove each authored level is solvable, that wrong approaches produce the advertised consequence, and that eyeballing alone does not reliably win.
- Expose `window.render_game_to_text()` (level, objects, math quantities, objective, win/fail reason) and a deterministic `window.advanceTime(ms)` that respects pause. Never test by injecting a win state.
- `/Users/acedzn/.codex/skills/develop-web-game/SKILL.md` and its `scripts/web_game_playwright_client.js` are good references. Also play in the built-in browser (`mcp__Claude_Browser__*`): a full success, a recoverable mistake, a hint, a restart, mobile width, and Tripo models visible in gameplay. Look at real screenshots; fix console errors.
- Automation can't prove fun or learning; say so.

## Deliverables

In your repo, all pushed to `main`: README (run, controls, implemented vs planned, Vercel instructions), `GAME_IDENTITY.md`, `progress.md` (keep updated), `ASSETS.md`, `CURRICULUM.md`, `docs/visual-targets/` + `docs/VISUAL_REVIEW.md`, `PLAYTEST.md` (what you verified, known limits), tests and real gameplay screenshots. Leave your dev server running on your port and show the game in the browser pane when done. Don't stop at a plan, scaffold, title screen or model viewer.

# Assets — רץ הסימנים (Sign Runner)

All models were generated in **Tripo Studio** (https://studio.tripo3d.ai/workspace/generate/) in the user's Chrome on 2026-10-25/26: **HD Model**, AI model **"H3.1 – Best Quality"**, text-to-3D, Geometry & Texture defaults (Texture on, 2K, PBR on, topology **Triangle**, polycount **20000**). Because Tripo now honours the 20k polycount setting, the raw exports are already ~17–19.5k triangles and ~0.9–1.2 MB (earlier crews got ~1M-triangle meshes); no Tripo retopology was needed.

Budget: **6 of 6** allowed model generations, **1 of 2** rig/animation jobs (one auto-rig; the preset animations are retargets on that rig and showed no credit cost). No credits were bought, no plan was upgraded, no API was used, no "Upgrade" modal appeared.

Credits: the header balance read **7815** before my first task. The account is shared with two other crews working at the same time (Splash Arc, Bank Shot), so the header balance cannot be split per crew (it read 6835 when I finished at ~00:45 on 26 Oct; most of the 980-credit drop came from the other crews' tasks). Costs shown by Tripo on the buttons for this game's own tasks: 6 × generation **30** = 180; auto-rig **20**; preset animations: no cost shown and no balance change attributable to them. **Total ≈ 200 credits.**

Everything math-critical — the track, the 3D number-line ruler / thermometer, gate label panels and their numbers, tunnel walls, slots and their numbers, the stepped trail — is **procedural Three.js** and reflects the pure rules module exactly. Generated meshes are never colliders or math surfaces.

## Models (`public/models/`)

All props are static meshes, normalized by Tripo to a max dimension of 1.0 with the base at y = 0 and centred on x/z (bounds measured on the optimized files). One material each (`OPAQUE`, PBR, base colour + metallic-roughness + normal maps as WebP).

| File | Tripo task | Prompt (abridged) | Processing | Triangles | Size | Bounds (x × y × z) |
|---|---|---|---|---|---|---|
| `runner.glb` | `a4376d45-5607-45e3-a71f-893c78bb6e07` | see below (rigged) | T-pose ON; Tripo auto-rig **Humanoid / Mixamo** preset; preset animations retargeted (run, jump, dive, hit_to_body_01, cheer); exported GLB, skeleton on, 5 animations, "Animation stay in Place" on; optimize script (no simplification, WebP 1024, meshopt) | 19,436 | 888 KB | ~1.0 tall, T-pose ~0.97 wide |
| `gate-arch.glb` | `89979425-2ba5-470d-95f3-6448f506ede5` | "A sleek sci-fi neon portal arch gate, front-facing, a thin open frame … tall rectangle with rounded top corners and chamfered edges, completely empty open center…, dark glossy metal frame with glowing magenta neon tube edges and small cyan light strips, two short feet…, Synthwave / Tron style game prop…" | WebP 1024, meshopt; **not simplified** (kept Tripo's 16,967 so the thin frame stays clean) | 16,967 | 377 KB | 0.73 × 1.0 × 0.20 (opening faces ±z) |
| `buoy.glb` | `7b17f5a4-7c93-4f48-abb8-7b08eefadb61` | "A stylized floating lighthouse buoy, red and white horizontal stripes, a chunky round float base, a short tapered tower with a small glass lamp cage on top glowing warm yellow…, cartoon stylized game prop like Sea of Thieves…" | sloppy simplify 18,900 → 9,955, WebP 512, meshopt | 9,955 | 126 KB | 0.56 × 1.0 × 0.55 |
| `jellyfish.glb` | `f474f772-83a0-4838-b84e-01051f53584b` | "A stylized bioluminescent jellyfish, smooth translucent dome-shaped bell glowing cyan and magenta…, a ring of glowing dots around the bell rim, 6 to 8 long wavy ribbon tentacles and frilly oral arms…" | sloppy simplify 19,080 → 10,807, WebP 512, meshopt | 10,807 | 122 KB | 0.81 × 1.0 × 0.76 |
| `polar-hut.glb` | `63638309-00ed-46b3-b4a6-ab47b1d72e5a` | "A small stylized polar research station hut on short stilts, boxy red-orange insulated cabin with snow piled on the flat roof…, a tall radio antenna mast and a small satellite dish…, a big round outdoor dial thermometer with a red needle mounted on a pole next to the door…" | sloppy simplify 18,531 → 11,802, WebP 1024, meshopt | 11,802 | 240 KB | 0.72 × 1.0 × 0.80 |
| `manta.glb` | `2e2bb0e6-b877-4ffa-bc18-d49cadc85368` | "A sleek stylized neon manta ray glider flying with wings spread wide, smooth dark violet body with glowing magenta and cyan neon lines along the wing edges and spine, long thin glowing tail, synthwave / Tron style sky creature…" | sloppy simplify 19,407 → 7,683, WebP 512, meshopt | 7,683 | 103 KB | 1.0 × 0.84 × 0.67 — **stands upright in the XY plane** (front view); rotate −90° about X to fly flat |

Task pages: `https://studio.tripo3d.ai/workspace/generate/<task id>`.

Notes for the scene code:
- Files use `EXT_meshopt_compression` and `EXT_texture_webp`: call `gltfLoader.setMeshoptDecoder(MeshoptDecoder)` (`three/examples/jsm/libs/meshopt_decoder.module.js`).
- The jellyfish is exported `OPAQUE`; set `transparent: true`, `opacity ~0.7`, `depthWrite: false` and an emissive tint in code for the bioluminescent look. Neon edges on the gate/manta are baked into the base colour; add emissive (e.g. `emissiveMap = map`, `emissiveIntensity ~1–2`) plus bloom to make them glow.
- The gate arch's opening is empty; mount the procedural label panel inside it.
- All six optimized files were loaded with three.js `GLTFLoader` + `MeshoptDecoder` in headless Chromium and rendered side by side (`assets-src/model-render-check.png`): no load errors, no visible holes at gameplay scale (simplifier error 0.004–0.014 of the mesh extent). Close-ups were not checked; if a prop shows holes up close, re-run the script with target 20000 (= no simplification).

### Runner hero prompt (T-Pose toggle ON)

> A sporty 13-year-old teen runner, stylized 3D game character, full body, T-pose with arms straight out. Sleek wraparound glowing cyan visor helmet that doubles as a dive mask, messy brown hair sticking out the back. Black neon-trimmed wetsuit-like running suit with glowing cyan and magenta light lines, short sleeves and knee-length shorts, wristbands, chunky sneakers with glowing magenta and cyan light strips on the soles. Clean stylized proportions, Fortnite / Overwatch style, vibrant colors, hand-painted texture, symmetrical, standing on flat ground, no base, no weapon.

Result: 19,436 faces, clean T-pose; the "visor helmet" came out as big cyan swim/ski goggles over the eyes (reads as a dive mask), black suit with cyan/magenta light lines, light-strip sneakers.

### Runner rig and clips (`public/models/runner.glb`)

- One skinned mesh, one skin, **65 joints**, Mixamo names, root joint **`mixamorig:Hips`** (e.g. `mixamorig:LeftUpLeg`, `mixamorig:Spine`, `mixamorig:Head`…). T-pose bind; ~1.0 units tall, feet at y = 0 (forward axis not verified; check it in the scene).
- Clips (exact names, durations): `run` 1.25 s (loop), `jump` 2.21 s, `dive` 2.71 s (forward dive / fall pose — use for sinking below zero), `hit_to_body_01` 1.29 s (stumble / hit-react for the crash), `cheer` 12.08 s (long; play the first 2–3 s or loop for level end). 195 channels each (T/R/S on all joints).
- All clips are exported "in place" (Hips x/z first = last). **Quirk:** `run` holds Hips at z ≈ +0.52 for the whole clip (the other clips sit at z ≈ 0), so the body sits half a body-length forward of the origin while running. Either offset the model −0.52 z while `run` plays, or strip the Hips x/z translation track in code (keep y) before crossfading.
- Tripo's "visor helmet" came out as goggles, not a helmet; it still reads as a dive mask.
- Verified: loaded in three.js 0.186 with `GLTFLoader` + `MeshoptDecoder` in headless Chromium, T-pose and `run`/`dive`/`hit_to_body_01` sampled at 40 % render correctly skinned (`assets-src/model-render-check.png`, gitignored).
- Clips requested but not added, to stay inside the shared queue time: separate `fall` and `idle`/`swim` presets (each retarget took 5–20 min in the shared queue). `dive` covers the sinking pose.

## Originals (gitignored `assets-src/`)

SHA-256:

- `sign-runner-runner-5anims.glb` (hero, rigged, 5 clips, 1.996 MB) — `7a9d811636e7c78c26e9653a230fd54b447d7c6b8978eadcc1466c1544295397`
- `sign-runner-gate-arch.glb` (1.180 MB) — `cde3bc08cc35346097dcf3d712024a78a45f07de2563754513f807de1b4af7ed`
- `sign-runner-buoy.glb` (0.958 MB) — `f0984d86fa1be4a7df8967a62522b5ec6dcabdf0954d4fbca95ff9e9d3587143`
- `sign-runner-jellyfish.glb` (0.879 MB) — `2771c3f16aeed45bea992c435b6a8716ab87e4e4844b939f042608915601bd3e`
- `sign-runner-polar-hut.glb` (1.073 MB) — `eb611746be05b2112c06115eb5a1cb9ba51b44d12fbe327c0516f07f25d9ade0`
- `sign-runner-manta.glb` (0.924 MB) — `7f7e65cbc83322163faf82f8253457e267fcd42eab1d7b25e4b41762fc66fb73`

Mockup PNG originals (`assets-src/mockups/`, JPEG copies in `docs/visual-targets/`):

- `sr-target-01-first30.png` — `a30d69b56a0a2d9ec2501abffc53d76994236e05ae4ac73240b97531abc23ab8`
- `sr-target-02-underwater.png` — `cc31578b1e53ca41e3729845b7adad93d900315023251f50ad55b819eb14560c`
- `sr-target-03-crash.png` — `c13567561cc03a05004d1886f128430211016d3464b76767f71b7f7da47d1c32`
- `sr-target-04-ice-station.png` — `35a1134c61a835efb15518170b3e4dcdca8550ad633285086bbaae6f04223b77`

## Reproduce

`scripts/optimize-model.mjs` (adapted from goose-on-the-scale): weld → meshoptimizer `simplifySloppy` per primitive (regular simplification is blocked by Tripo's UV seams; budget split across primitives) → prune/dedup → WebP textures → meshopt compression. Skins, joints and animation channels pass through untouched. It prints a JSON summary (bytes, triangles, joints, root joint, clip names, textures).

```
node scripts/optimize-model.mjs assets-src/<file>.glb public/models/<name>.glb <targetTris> [textureSize] [maxError]
```

Used: runner 20000/1024 (no simplification), gate 20000/1024, buoy 10000/512, jellyfish 8000/512 (stopped at 10,807 by the 0.02 error cap), polar-hut 12000/1024, manta 8000/512. Dev dependencies added with `npm install --save-dev --save-exact`: `@gltf-transform/core@4.5.1`, `@gltf-transform/extensions@4.5.1`, `@gltf-transform/functions@4.5.1`, `sharp@0.35.5` (`meshoptimizer` was already installed).

## Mockups (design reference, never shipped)

`docs/visual-targets/sr-target-0{1..4}-*.jpg`, ChatGPT image generation in the user's Chrome, 2026-10-25, chat https://chatgpt.com/c/6ade725f-ca40-83ed-aed0-68bd63dc9b42. Prompts and per-image notes in `docs/visual-targets/PROMPTS.md`.

## Music and sound

Procedural WebAudio in `src/audio.ts` (the lead writes it): 4/4 beat (kick, clap, hats, bass arpeggio) at 112 / 92 / 128 BPM, low-pass filter + bubble blips under the waterline, pitched gate blips, tunnel whoosh + chord, crash glass smash + record-scratch slow-down. No audio files are bundled or fetched; no third-party music.

## Fonts

Rubik via `@fontsource/rubik` (bundled by the lead). Nothing is fetched at runtime.

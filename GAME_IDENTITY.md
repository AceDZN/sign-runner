# Sign Runner — רץ הסימנים — game identity

## One line

A Thumper-style neon rhythm runner where **your signed number is your altitude**. Zero is a glowing waterline; above it you race through a synthwave night sky, below it you dive through a bioluminescent sea. Lane gates on the beat change your number, and tunnels sit at fixed heights ahead. Pick the lane that lands you exactly at the tunnel's height or smash into the wall.

## Core action (without setting or topic)

Real-time, 3-lane, on-the-beat lane choice with look-ahead. You read 3 options, predict which one lands you at a visible target height, commit before the gate, and see the result instantly as a height change. Crash → 2-second respawn at the segment start. No menus between decisions, no typed answers.

## Camera

Third-person chase camera low behind the runner, ~10° down, looking down a long straight track that recedes into fog. The camera follows the runner's altitude with a short lag. When you cross zero, the camera rolls a few degrees and the world tint, fog and music filter flip (sky ↔ sea). Mobile portrait keeps the same camera with a wider FOV.

## Scene

- **The waterline (0):** a huge glowing cyan plane, visible from above (rippling neon surface with grid lines) and below (shimmering ceiling). A lighthouse buoy bobs at zero beside the track.
- **Above (positive):** synthwave night: magenta-to-violet gradient sky, a striped retro sun on the horizon, wireframe mountains, stars, magenta fog.
- **Below (negative):** deep-sea teal-to-navy gradient, bubbles streaming up, glowing jellyfish swarms, drifting plankton motes, cyan fog, muffled music.
- **Track:** a glowing hover-rail ribbon with 3 lanes at the runner's current altitude. Behind the runner the ribbon stays where it was, so the trail is a **stepped graph of your number over time**.
- **Number-line scale:** a tall vertical ruler (ציר המספרים) beside the track on the left: integer ticks, bold labels every 1 (LTR, with real minus signs), the zero tick glowing. Your marker rides on it; the next tunnel's height is a pulsing target bracket on it.
- **Gates:** a row of 3 neon arch frames, one per lane, floating at your altitude. Each carries a holographic panel with its operation in Workbook notation: `+3`, `+(−5)`, `−(−3)`, `×(−2)`, `÷(−4)`, `(  )²`, `(  )³`. Two-row segments put two gate rows before one tunnel.
- **Tunnels:** a giant wall across all lanes with one glowing slot at a fixed height, its number painted large beside the slot (`+9`, `−8`). Pass through: whoosh, light burst, combo +1. Wrong height: slow-motion smash, the wall shards fly, camera shake.
- **Ice Station (level 7, transfer):** new skin. The scale becomes a thermometer in °C, the waterline freezes into an ice sheet, the sky gets aurora, snow falls, the sea below becomes cracked blue ice caves. Faster tempo, no ghost preview.

## Characters and props (Tripo)

- **Runner hero (rigged, Mixamo):** a sporty 13-year-old with a sleek glowing visor helmet that works as a dive mask, neon-trimmed wetsuit-like running suit, chunky sneakers with light strips. Animations: run, jump (rising), dive/fall (sinking), stumble/crash, cheer (level complete).
- **Gate arch frame:** a sleek sci-fi arch/portal frame (neon tube edges) that the procedural label panel mounts in.
- **Jellyfish:** bioluminescent translucent jellyfish (swarm dressing below zero, animated procedurally).
- **Lighthouse buoy:** a red-and-white floating lighthouse buoy with a lamp, marks zero.
- **Ice-station prop:** a small polar research station hut / thermometer tower for the level 7 skin.
- **Sky dressing:** a neon manta / glider or floating sky-island crystal for the positive side (optional).

## HUD (Hebrew RTL, numbers LTR)

- **Top-right:** level name (`שלב 3 · היפוך`) and progress dots for segments.
- **Top-center:** combo (`רצף 12`) and multiplier (`×3`), score.
- **Big readout above the runner:** your current number, huge, LTR, signed (`−8`, `+3`, `0`), color-coded *and* with explicit sign.
- **Left edge:** the 3D number-line scale (part of the scene, not a DOM overlay).
- **Target chip:** `מנהרה: +1` next to the scale target bracket.
- **Bottom:** hint hold button (`רוח רפאים` ghost, shows each lane's result as a translucent runner at its result height; costs the multiplier, logged), pause, mute.
- **Crash card:** slow-motion; a short worked line in LTR inside Hebrew: `4 × (−2) = −8 · סימנים שונים ← שלילי`, plus what the tunnel needed. Auto-dismisses at respawn.
- **Level end:** rank (S/A/B/C) by crashes, hints and best combo.

## Palette

Above: magenta #ff2fb3, violet #6b2bff, hot orange sun #ff9a3c, deep night #120526. Waterline: cyan #3cf2ff. Below: teal #00d1b2, navy #031a3a, bio-green #7dff9a. Positive numbers warm (orange/magenta), negative numbers cool (cyan/teal), always also shown with an explicit `+`/`−` sign. Ice Station: white #eef8ff, ice blue #8fd8ff, aurora green #6dffb0.

## Sound

Procedural WebAudio 4/4 beat (kick, clap, hats, bass arpeggio) at 112 BPM normal, 92 BPM slower option, 128 BPM in Ice Station. Underwater: low-pass filter + bubble blips. Gate pass: pitched blip (up when rising, down when sinking). Tunnel pass: whoosh + chord. Crash: glass smash + record-scratch slow-down.

## Not this

No courier, no delivery, no toy-industrial diorama, no robot, no quiz popups. Not a worksheet with a runner pasted on: the number is the height, and the height is the game.

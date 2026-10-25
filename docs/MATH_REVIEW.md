# Sign Runner (רץ הסימנים) · independent math review

Reviewer: math reviewer / playtester on the build crew. Date: 2026-10-26.
Scope: `src/rules.ts`, `src/levels.ts`, `src/sim.ts`, `src/generator.ts`, `src/hud.ts` (`showCrash`), `src/main.ts` + `index.html` (Hebrew UI), checked against the Workbook snapshots in `workbook/` and two live pages fetched through the Workbook MCP (`/math/grade-7/chapter-7/opposite-numbers`, `/math/grade-7/chapter-7/directed-numbers`).

How this was checked (independently of the crew's tests):
- Level data was dumped from `LEVELS` to JSON and every lane path was re-evaluated with my own evaluator in Python using exact `Fraction` arithmetic (it does not import `rules.ts`). I also hand-checked the brief's own segments.
- Misconception lures were found by re-evaluating every path under a model of each misconception and listing wrong paths that the misconception makes land on the tunnel.
- Bypass strategies (constant lane, stay in the center, label-sign, operand-sign, "number matches the tunnel", "number matches the distance") were simulated over all authored single-row segments.
- `freshLevel` was sampled for seeds 1 to 3 by hand-reading, and for seeds 1 to 200 per level with counters.
- Real headless Chrome (Playwright, `channel: 'chrome'`, `--use-angle=metal`) on `http://localhost:5211/?test`: crashed twice on level 3 segment 1, held the ghost, crashed on a level 5 order segment and on level 7, and took screenshots of gates up close.
- Nothing here claims fun or learning gains; those need real students.

Line numbers are as of this review; `main.ts`, `hud.ts`, `scene.ts` and `sim.ts` were being edited while I worked, so search by the quoted string if a line moved.

---

## 0. Priority summary

### Must-fix (wrong math, wrong statement, unreadable notation, broken generator)

| # | Where | Problem | Proposed fix |
|---|---|---|---|
| M1 | `src/levels.ts:73` level 1 `rule` | `'חיבור מספר חיובי מעלה אותך. חיבור מספר שלילי מוריד אותך מתחת לקו המים.'` is false: adding a negative moves you down, not necessarily below zero. Level 1 itself contradicts it (segment 6: 4 + (−1) = 3 stays above the waterline). The Workbook says this explicitly: "10 + (-3) = 7 ... התוצאה קטנה מהמספר הראשון" (adding-directed). | `'חיבור מספר חיובי מעלה אתכם. חיבור מספר שלילי מוריד אתכם למטה, גם אם לא עוברים את קו המים.'` or shorter `'חיבור מספר חיובי ← עולים. חיבור מספר שלילי ← יורדים.'` |
| M2 | `src/rules.ts:113` `ruleHe` for ×(−1) | `'כפל ב־(−1) נותן את המספר הנגדי: מראה מעל קו המים'`: "מעל" (above) is wrong. ×(−1) reflects across the waterline to the other side (from 8 down to −8, from −2 up to 2). The level 5 crash showed it after (−2) × (−1) = 2. | `'כפל ב־(−1) נותן את המספר הנגדי: היפוך לצד השני של קו המים'`. The Workbook's own mirror image is "באותו מרחק מאפס, אבל בצד השני" (opposite-numbers). |
| M3 | `src/levels.ts:165` level 5 `rule` | `'שני שערים ברצף: אותן פעולות בסדר אחר נותנות תוצאה אחרת.'` is false in general: two additions (or two multiplications) give the same result in either order. Students in this chapter have to know that addition is commutative. | `'שני שערים ברצף: אותן פעולות בסדר אחר יכולות לתת תוצאה אחרת.'` |
| M4 | Gate panels, `src/scene.ts` around `panel.position.set(laneX(lane), 2.45, 0.05)` (~line 432) and `src/textures.ts:63` `fitText(ctx, label, 450, 176)` | In real screenshots the arch pillars hide the outer characters of 5-character labels: `×(−2)` reads as `:(−2` (the × is half-hidden and the closing parenthesis is gone), and `−(−4)` / `−(−6)` lose most of the leading minus and the `)`. The leading operator is the whole lesson in levels 2 to 4. Short labels (`×2`, `×3`, `(  )²`) are fine. | Fit the text to the opening between the pillars (about 340 to 360 px of the 512 px canvas instead of 450), or move the panel in front of the pillars (z about +0.5) and make it narrower than the arch. Check again with a screenshot of `×(−2)` and `−(−4)` at about 14 m. |
| M5 | `src/generator.ts` `proposal('mul'\|'div')` | Fresh levels 3 and 4 collapse into a ±16 / ±1 loop. Over 200 seeds, **85 %** of level 3 segments are solved by ×(−1) or ×1, and **76 %** of level 4 segments by ÷(−1) or ÷1. Example (level 4 seed 1): `−1→1 [÷1 \| ÷(−1) \| −1]`, repeated 8 times. Cause: from ±16, `mul` only allows n = −1 (`\|v·n\| ≤ 16`); from ±1, `div` only allows n = −1. Nothing ever pulls the value back. This kills both the multiplication sign rule and "dividing doesn't always make smaller". | Before you call `proposal`, pick the *tunnel* first from a friendly set (for mul: `t = v·n` with `\|n\| ∈ {2..5}` and `\|t\| ≤ 16`; when there is no such n, use an additive connector to a value with many divisors, e.g. ±2, ±3, ±4, ±6, ±12). For div, use the brief's pattern: aim the start at multiples like −12, −15, 8, −16 (add a connector row in the *previous* segment, or let the div family pick a connector). Leave ±1 multipliers/divisors out of the correct op, except for one ×(−1) "mirror" per level. Add a test: in fresh L3/L4, at most 1 segment in 10 has |n| = 1 on the correct path. |
| M6 | `src/generator.ts` distractors | Gates with operand 0 are generated: `+0`, `−0` (seen in fresh L1, L2, L5, L6, L7; 58 of 1600 L1 segments, 55 of 1800 L2). `−0` is not a valid Workbook label, and `+0` is a free "do nothing" lane. Sources: `add(n + pick(r, [-2,-1,1,2]))`, `sub(n + pick(r,[-1,1]))`, `add(k ± 1)` in `connector`. | Filter every distractor with `n !== 0` (and `n !== 1` for ÷/×) in `shuffleInto`; make `validSegment` reject any gate with `n === 0`. Add a test. |

### Should-fix

| # | Where | Problem | Proposed fix |
|---|---|---|---|
| S1 | `levels.ts:174` level 5 segment 3 | Not an order contrast: rows `[×(−3), +(−4), ×3] \|\| [×3, +(−5), −(−3)]`. The correct path is `+(−4)` then `×3`, but row 2 has no `+(−4)`, so the reversed order is not on the board. `CURRICULUM.md` says "the reversed order is always on the board", which is untrue for this segment. You can't simply swap +(−5) for +(−4): then `+(−4)` then `+(−4)` also gives −6 (two paths). | Replace with `two(-6, r(add(-2), mul(-2), mul(3)), r(mul(-2), sub(-3), add(-2)))`. Correct: `×(−2)` → −4, then `+(−2)` → −6 (lanes 1→2). Reversed: `+(−2)` → 0, then `×(−2)` → 0. I checked it: exactly 1 of 9 paths, all exact, the next segment still starts at −6. |
| S2 | `levels.ts:127` level 3 segment 2 | From −8, tunnel 8: `+(−1)` → −9, `×2` → −16, `×(−1)` → 8. Only one lane has the right size (8), so you don't need the sign rule here: the mirror gate is never put next to its non-mirror twin. | `one(8, add(-1), mul(1), mul(-1))`: `×1` → −8 is the honest contrast ("×1 keeps, ×(−1) flips"). Checked: unique. |
| S3 | Level 5 crash card (`hud.ts` `pickKeyStep`) | When the student used the right two operations in the wrong order, the card explains whichever step scores highest (in the live run: ×(−1), with the wrong "מראה מעל קו המים" text). It never says that the *order* was the mistake, which is the whole point of the level. | In `showCrash`: if the chosen ops are the solution's ops in reverse, set `crashRule` to `'אותן שתי פעולות בסדר הפוך. כאן הסדר משנה את התוצאה.'` |
| S4 | Level 2 `rule` (`levels.ts:95`) | `'... מורידים מינוס? עולים!'` is sloppy: "removing a minus" isn't an operation, and it invites "cancel the minus signs" thinking. | `'חיסור מספר שלילי = חיבור המספר הנגדי לו. מחסירים מספר שלילי? עולים!'` |
| S5 | Level 4 `rule` (`levels.ts:141`) | `'בחילוק אותם כללים כמו בכפל. ולא תמיד חילוק מקטין!'`: says "rules" with no sign, and the second sentence has awkward word order. | `'בחילוק אותם כללי סימנים כמו בכפל: אותו סימן ← חיובי, סימנים שונים ← שלילי. וחילוק לא תמיד מקטין!'` (Workbook: "כללי הסימנים בחילוק זהים לכללי הכפל"). |
| S6 | Level 6 `rule` (`levels.ts:185`) | `'... חזקה אי־זוגית ← שלילית.'` leaves out "of a negative number", but an odd power of a positive number is positive. | `'חזקה זוגית של מספר שלילי ← חיובית. חזקה אי־זוגית של מספר שלילי ← שלילית.'` |
| S7 | Notation in `example` strings, `levels.ts:142` and `:210` | The Workbook puts a negative *left* operand of × and ÷ in parentheses (`(-10) \div (-2) = 5`, `(-3) \times 4 = -12`, `(-12) \div (-3) = 4`), and `expression()` does the same in the crash card (`(−15) ÷ 5 = −3`). The intro examples don't: `'−12 ÷ (−4) = 3'`, `'−15 ÷ (−5) − (−4) = 7'`. | `'(−12) ÷ (−4) = 3'` and `'(−15) ÷ (−5) − (−4) = 7'`. Keep `'−2 − (−3) = −2 + 3 = 1'`: for + and − the Workbook writes the leading negative without parentheses (`-8 - (-5) = -8 + 5 = -3`). |
| S8 | Mixed singular / plural address | Most of the UI uses plural (עברו, בחרו, החזיקו, עברתם, סיימתם), but: `index.html:46` `'המספר שלך הוא הגובה שלך ... בחרו את השער שמביא אתכם'`, `main.ts:151` `'המספר שלך הוא הגובה שלך. עברו בשער שמביא אתכם ...'` (both switch inside one sentence pair), level 1 rule `'מעלה אותך / מוריד אותך'`, crash `hud.ts:205` `', הגעת ל־'`. | Use plural everywhere: `'המספר שלכם הוא הגובה שלכם.'`, `'מעלה אתכם'`, `', הגעתם ל־'`. |
| S9 | `main.ts:205` result B | `'עברתם! שימו לב לסימנים ותנסו שוב לדירוג גבוה יותר.'` mixes an imperative with a future form. | `'עברתם! שימו לב לסימנים ונסו שוב לדירוג גבוה יותר.'` |
| S10 | `hud.ts:210` | `'הדרך שעוברת: '` is awkward Hebrew ("the way that passes"). | `'הדרך הנכונה: '` or `'כך עוברים: '` |
| S11 | `hud.ts:205` on the ice level | `'המנהרה בגובה +7°C'` describes a temperature as a "height". | When `this.ice`: `'המנהרה ב־' … '°C, הגעתם ל־' …` (or `'בטמפרטורה'`). |
| S12 | Brief terms | `ציר המספרים` only appears in an `aria-label` (`index.html:24`). `ערך מוחלט` never appears. Both are required terms in the brief and core Workbook terms ("מספר מכוון הוא מספר המורכב מגודל (ערך מוחלט) וכיוון (סימן)", directed-numbers). | Level 1 intro note: `'הסרגל משמאל הוא ציר המספרים, עומד.'` For the × / ÷ crash rule, add a first step: `'כופלים את הערכים המוחלטים, ואז: אותו סימן ← חיובי'` (Workbook multiplying-directed: "ערכים מוחלטים ואז סימן"). |
| S13 | `Level.modules` is never shown | No file in `src/` or `index.html` reads `modules`, so students never see the Workbook links. | Add a "לקריאה בספר" link row on the intro card and/or results card. All 8 slugs exist (checked against `https://www.workbook.co.il/llms-full.txt`); `absolute-value` also exists and fits levels 1 and 3. |
| S14 | Fresh level 1 shows subtraction gates | 837 of 1600 fresh level 1 segments include a `−(−n)` or `−n` gate (the `sub(n)` distractor in `proposal('add')`), but subtraction is taught in level 2. Example seed 1 S1: `0→−12 [−(−12) \| +(−10) \| +(−12)]`. | In level 1 (`familiesFor(level)==['add']`), drop `sub(n)` and use `add(n ± 1)`, the size twin, instead. |
| S15 | Two-row segments outside level 5 aren't introduced | Level 6 segment 8 and four level 7 segments have two rows, but only level 5 has the `'כאן יש שתי שורות שערים…'` note (`main.ts:152`). | Add a note for any level with a two-row segment, or a banner when the first two-row segment arrives (`'שתי שורות!'`). |

### Nice-to-have

| # | Where | Note |
|---|---|---|
| N1 | `rules.ts:119` | For v = 0, `ruleHe` pow returns `'חזקה של מספר חיובי היא חיובית'`, but 0 isn't positive. No authored path reaches it, but a fresh two-row segment can (row 1 lands on 0, row 2 has a power). Use `if (v === 0) return 'אפס בחזקה הוא אפס'`. The dead `''` branch at `:121` can go. |
| N2 | `index.html:46` | `'מתחת לאפס: מתחת לים.'` → `'מתחת לאפס: בעומק הים.'` |
| N3 | `index.html:80` | `'רצף הכי ארוך'` → `'הרצף הארוך ביותר'` |
| N4 | `main.ts:154` level 7 note | Repeats the level rule (`בלי רוח רפאים`, `מתחת לאפס … קפוא`). Use `'הקצב מהיר יותר, ויש שרשראות של שני שערים.'` |
| N5 | Ice ruler | Ticks read `+5°`, the target and readout read `+7°C`. Pick one. |
| N6 | First segment of levels 2, 3, 6 is solved by the center lane, the respawn lane, so doing nothing passes it | Move those correct gates to a side lane. Over a whole level, the center lane passes about 1 in 3, which is chance. |
| N7 | Level 5 two-row layout | All 6 correct paths change lanes between rows (never `00`, `11`, `22`), and every correct path is one ×/÷ gate plus one +/− gate. Neither is a real shortcut (you still have to choose between the two orders), but make one segment solvable in a straight line. |
| N8 | Fresh L6 repetitiveness | Seeds 1 to 3 bounce between −3 and 9 (`(  )²` from −3 three times in one level). |
| N9 | `ruleHe` sub n>0 crash line | `expression()` prints `1 − 5 = −4`. The Workbook always shows the rewrite `8 − 5 = 8 + (−5) = 3`; showing `1 − 5 = 1 + (−5) = −4` would reinforce "חיסור = חיבור הנגדי". |

---
## 1. Every authored segment, checked by hand

Lanes: 0 = left, 1 = center, 2 = right. A segment starts at the previous tunnel's height. ✓ marks the result that matches the tunnel. "Lure" means a wrong path that a student holding the misconception would compute as landing on the tunnel (minus-minus = −(−n) read as −n; add-neg-up = +(−n) read as +n; neg×neg = (−a)×(−b) or (−a)÷(−b) read as negative; (−a)²<0 = (−a)² read as −a²).

**Result: in all 60 segments exactly one lane (or one lane pair out of 9) reaches the tunnel, every division is exact on every path (0 non-exact paths, including all 99 paths of the 11 two-row segments), and no value goes beyond ±27.**

#### Level 1 (start 0)

| # | from | lane 0 (left) | lane 1 (center) | lane 2 (right) | tunnel | passes | misconception lure (wrong lane that looks right) |
|---|---|---|---|---|---|---|---|
| 1 | 0 | `+5` → 5 | `+(−3)` → −3 | `+3` → 3 ✓ | 3 | lane 2 (1 of 3) | add-neg-up: +(−3) |
| 2 | 3 | `+(−5)` → −2 ✓ | `+5` → 8 | `+(−1)` → 2 | −2 | lane 0 (1 of 3) | — |
| 3 | −2 | `+4` → 2 | `+(−4)` → −6 ✓ | `+(−6)` → −8 | −6 | lane 1 (1 of 3) | — |
| 4 | −6 | `+(−5)` → −11 | `+7` → 1 | `+5` → −1 ✓ | −1 | lane 2 (1 of 3) | add-neg-up: +(−5) |
| 5 | −1 | `+3` → 2 | `+5` → 4 ✓ | `+(−5)` → −6 | 4 | lane 1 (1 of 3) | add-neg-up: +(−5) |
| 6 | 4 | `+(−1)` → 3 | `+(−7)` → −3 ✓ | `+7` → 11 | −3 | lane 1 (1 of 3) | — |
| 7 | −3 | `+7` → 4 | `+(−13)` → −16 | `+(−7)` → −10 ✓ | −10 | lane 2 (1 of 3) | — |
| 8 | −10 | `+12` → 2 ✓ | `+8` → −2 | `+(−12)` → −22 | 2 | lane 0 (1 of 3) | add-neg-up: +(−12) |

#### Level 2 (start −2)

| # | from | lane 0 (left) | lane 1 (center) | lane 2 (right) | tunnel | passes | misconception lure (wrong lane that looks right) |
|---|---|---|---|---|---|---|---|
| 1 | −2 | `−3` → −5 | `−(−3)` → 1 ✓ | `+(−3)` → −5 | 1 | lane 1 (1 of 3) | add-neg-up: +(−3) |
| 2 | 1 | `−(−5)` → 6 | `+(−3)` → −2 | `−5` → −4 ✓ | −4 | lane 2 (1 of 3) | minus-minus: −(−5) |
| 3 | −4 | `−(−6)` → 2 ✓ | `−6` → −10 | `−(−2)` → −2 | 2 | lane 0 (1 of 3) | — |
| 4 | 2 | `−(−7)` → 9 ✓ | `−7` → −5 | `−(−5)` → 7 | 9 | lane 0 (1 of 3) | — |
| 5 | 9 | `−(−9)` → 18 | `+(−8)` → 1 | `−9` → 0 ✓ | 0 | lane 2 (1 of 3) | minus-minus: −(−9) |
| 6 | 0 | `−(−5)` → 5 | `−5` → −5 ✓ | `+5` → 5 | −5 | lane 1 (1 of 3) | minus-minus: −(−5) |
| 7 | −5 | `−4` → −9 | `−(−4)` → −1 ✓ | `−(−6)` → 1 | −1 | lane 1 (1 of 3) | — |
| 8 | −1 | `−(−9)` → 8 | `−(−7)` → 6 | `−7` → −8 ✓ | −8 | lane 2 (1 of 3) | minus-minus: −(−7) |
| 9 | −8 | `−(−5)` → −3 ✓ | `−5` → −13 | `−(−11)` → 3 | −3 | lane 0 (1 of 3) | — |

#### Level 3 (start 4)

| # | from | lane 0 (left) | lane 1 (center) | lane 2 (right) | tunnel | passes | misconception lure (wrong lane that looks right) |
|---|---|---|---|---|---|---|---|
| 1 | 4 | `−(−4)` → 8 | `×(−2)` → −8 ✓ | `×2` → 8 | −8 | lane 1 (1 of 3) | — |
| 2 | −8 | `+(−1)` → −9 | `×2` → −16 | `×(−1)` → 8 ✓ | 8 | lane 2 (1 of 3) | — |
| 3 | 8 | `×(−1)` → −8 | `+(−10)` → −2 ✓ | `−2` → 6 | −2 | lane 1 (1 of 3) | — |
| 4 | −2 | `×(−3)` → 6 | `×3` → −6 ✓ | `−(−4)` → 2 | −6 | lane 1 (1 of 3) | minus-minus: −(−4); neg×neg: ×(−3) |
| 5 | −6 | `×(−2)` → 12 ✓ | `×2` → −12 | `−(−6)` → 0 | 12 | lane 0 (1 of 3) | — |
| 6 | 12 | `−(−1)` → 13 | `×1` → 12 | `×(−1)` → −12 ✓ | −12 | lane 2 (1 of 3) | — |
| 7 | −12 | `×(−1)` → 12 | `−(−2)` → −10 | `+10` → −2 ✓ | −2 | lane 2 (1 of 3) | — |
| 8 | −2 | `×5` → −10 ✓ | `×(−5)` → 10 | `−(−8)` → 6 | −10 | lane 0 (1 of 3) | minus-minus: −(−8); neg×neg: ×(−5) |
| 9 | −10 | `×(−1)` → 10 ✓ | `−(−10)` → 0 | `×1` → −10 | 10 | lane 0 (1 of 3) | — |

#### Level 4 (start −12)

| # | from | lane 0 (left) | lane 1 (center) | lane 2 (right) | tunnel | passes | misconception lure (wrong lane that looks right) |
|---|---|---|---|---|---|---|---|
| 1 | −12 | `÷4` → −3 | `−(−4)` → −8 | `÷(−4)` → 3 ✓ | 3 | lane 2 (1 of 3) | — |
| 2 | 3 | `×5` → 15 | `×(−5)` → −15 ✓ | `÷(−3)` → −1 | −15 | lane 1 (1 of 3) | — |
| 3 | −15 | `÷(−3)` → 5 | `÷3` → −5 ✓ | `÷(−5)` → 3 | −5 | lane 1 (1 of 3) | neg×neg: ÷(−3) |
| 4 | −5 | `×(−2)` → 10 | `−(−5)` → 0 | `×2` → −10 ✓ | −10 | lane 2 (1 of 3) | minus-minus: −(−5); neg×neg: ×(−2) |
| 5 | −10 | `÷2` → −5 | `−(−5)` → −5 | `÷(−2)` → 5 ✓ | 5 | lane 2 (1 of 3) | — |
| 6 | 5 | `÷5` → 1 | `÷(−5)` → −1 ✓ | `−(−4)` → 9 | −1 | lane 1 (1 of 3) | — |
| 7 | −1 | `×(−8)` → 8 ✓ | `÷(−1)` → 1 | `×8` → −8 | 8 | lane 0 (1 of 3) | — |
| 8 | 8 | `÷(−4)` → −2 ✓ | `÷4` → 2 | `−(−4)` → 12 | −2 | lane 0 (1 of 3) | — |
| 9 | −2 | `×(−6)` → 12 | `+(−6)` → −8 | `×6` → −12 ✓ | −12 | lane 2 (1 of 3) | neg×neg: ×(−6) |
| 10 | −12 | `÷(−4)` → 3 | `÷4` → −3 ✓ | `−(−3)` → −9 | −3 | lane 1 (1 of 3) | neg×neg: ÷(−4) |

#### Level 5 (start 3)

| # | from | lane 0 (left) | lane 1 (center) | lane 2 (right) | tunnel | passes | misconception lure (wrong lane that looks right) |
|---|---|---|---|---|---|---|---|
| 1 | 3 | `×(−1)` / `+2` | `+(−5)` / `+(−5)` | `+1` / `×(−1)` | −8 | lanes 0→1: `×(−1)` → −3, `+(−5)` → −8 (1 of 9) | add-neg-up: +(−5) then ×(−1) |
| 2 | −8 | `×(−1)` / `+(−4)` | `+(−2)` / `×(−1)` | `+6` / `+6` | 2 | lanes 2→1: `+6` → −2, `×(−1)` → 2 (1 of 9) | add-neg-up: +6 then +(−4) |
| 3 | 2 | `×(−3)` / `×3` | `+(−4)` / `+(−5)` | `×3` / `−(−3)` | −6 | lanes 1→0: `+(−4)` → −2, `×3` → −6 (1 of 9) | — |
| 4 | −6 | `×(−2)` / `×(−2)` | `+(−4)` / `+(−4)` | `−(−1)` / `+(−1)` | 8 | lanes 0→1: `×(−2)` → 12, `+(−4)` → 8 (1 of 9) | — |
| 5 | 8 | `÷(−2)` / `÷(−2)` | `−(−2)` / `×(−1)` | `−2` / `−(−2)` | −5 | lanes 1→0: `−(−2)` → 10, `÷(−2)` → −5 (1 of 9) | — |
| 6 | −5 | `×(−2)` / `×(−2)` | `+(−3)` / `−(−3)` | `−(−3)` / `×2` | 4 | lanes 2→0: `−(−3)` → −2, `×(−2)` → 4 (1 of 9) | add-neg-up: +(−3) then ×(−2) |

#### Level 6 (start −3)

| # | from | lane 0 (left) | lane 1 (center) | lane 2 (right) | tunnel | passes | misconception lure (wrong lane that looks right) |
|---|---|---|---|---|---|---|---|
| 1 | −3 | `×3` → −9 | `(  )²` → 9 ✓ | `−(−6)` → 3 | 9 | lane 1 (1 of 3) | — |
| 2 | 9 | `×(−1)` → −9 | `+(−7)` → 2 | `+(−11)` → −2 ✓ | −2 | lane 2 (1 of 3) | — |
| 3 | −2 | `(  )²` → 4 | `×(−4)` → 8 | `(  )³` → −8 ✓ | −8 | lane 2 (1 of 3) | neg×neg: ×(−4) |
| 4 | −8 | `÷(−2)` → 4 | `÷2` → −4 ✓ | `−(−2)` → −6 | −4 | lane 1 (1 of 3) | neg×neg: ÷(−2) |
| 5 | −4 | `×4` → −16 ✓ | `(  )²` → 16 | `−(−12)` → 8 | −16 | lane 0 (1 of 3) | minus-minus: −(−12); (−a)²<0: (  )² |
| 6 | −16 | `÷(−16)` → 1 | `−(−14)` → −2 | `÷16` → −1 ✓ | −1 | lane 2 (1 of 3) | neg×neg: ÷(−16) |
| 7 | −1 | `(  )³` → −1 ✓ | `(  )²` → 1 | `×(−1)` → 1 | −1 | lane 0 (1 of 3) | neg×neg: ×(−1); (−a)²<0: (  )² |
| 8 | −1 | `(  )²` / `(  )²` | `+(−2)` / `×3` | `−(−2)` / `(  )³` | 9 | lanes 1→0: `+(−2)` → −3, `(  )²` → 9 (1 of 9) | minus-minus: −(−2) then (  )² |
| 9 | 9 | `÷3` → 3 | `÷(−3)` → −3 ✓ | `+(−6)` → 3 | −3 | lane 1 (1 of 3) | — |
| 10 | −3 | `(  )²` → 9 | `(  )³` → −27 ✓ | `×(−9)` → 27 | −27 | lane 1 (1 of 3) | neg×neg: ×(−9) |

#### Level 7 (start −15)

| # | from | lane 0 (left) | lane 1 (center) | lane 2 (right) | tunnel | passes | misconception lure (wrong lane that looks right) |
|---|---|---|---|---|---|---|---|
| 1 | −15 | `÷5` / `−4` | `+5` / `×(−1)` | `÷(−5)` / `−(−4)` | 7 | lanes 2→2: `÷(−5)` → 3, `−(−4)` → 7 (1 of 9) | — |
| 2 | 7 | `×2` → 14 | `−(−7)` → 14 | `×(−2)` → −14 ✓ | −14 | lane 2 (1 of 3) | — |
| 3 | −14 | `−(−8)` → −6 ✓ | `−8` → −22 | `+(−8)` → −22 | −6 | lane 0 (1 of 3) | add-neg-up: +(−8) |
| 4 | −6 | `÷3` / `(  )²` | `÷(−3)` / `×(−1)` | `−(−3)` / `+(−4)` | 9 | lanes 2→0: `−(−3)` → −3, `(  )²` → 9 (1 of 9) | minus-minus: −(−3) then ×(−1) |
| 5 | 9 | `+(−9)` → 0 | `×(−1)` → −9 ✓ | `−(−9)` → 18 | −9 | lane 1 (1 of 3) | — |
| 6 | −9 | `÷(−3)` / `−(−3)` | `−(−3)` / `×(−1)` | `+(−3)` / `÷(−3)` | 2 | lanes 1→2: `−(−3)` → −6, `÷(−3)` → 2 (1 of 9) | add-neg-up: +(−3) then ÷(−3) |
| 7 | 2 | `×6` → 12 | `+(−6)` → −4 | `×(−6)` → −12 ✓ | −12 | lane 2 (1 of 3) | — |
| 8 | −12 | `÷(−6)` / `×(−1)` | `−(−6)` / `+2` | `÷6` / `×2` | 0 | lanes 2→1: `÷6` → −2, `+2` → 0 (1 of 9) | neg×neg: ÷(−6) then +2 |

#### All 9 paths of each two-row segment

```
L5 S1 from 3 tunnel −8: rows ×(−1) , +(−5) , +1 || +2 , +(−5) , ×(−1)
   (0, 0): ×(−1) then +2 -> −3 -> −1
   (0, 1): ×(−1) then +(−5) -> −3 -> −8  ✓
   (0, 2): ×(−1) then ×(−1) -> −3 -> 3
   (1, 0): +(−5) then +2 -> −2 -> 0
   (1, 1): +(−5) then +(−5) -> −2 -> −7
   (1, 2): +(−5) then ×(−1) -> −2 -> 2
   (2, 0): +1 then +2 -> 4 -> 6
   (2, 1): +1 then +(−5) -> 4 -> −1
   (2, 2): +1 then ×(−1) -> 4 -> −4
L5 S2 from −8 tunnel 2: rows ×(−1) , +(−2) , +6 || +(−4) , ×(−1) , +6
   (0, 0): ×(−1) then +(−4) -> 8 -> 4
   (0, 1): ×(−1) then ×(−1) -> 8 -> −8
   (0, 2): ×(−1) then +6 -> 8 -> 14
   (1, 0): +(−2) then +(−4) -> −10 -> −14
   (1, 1): +(−2) then ×(−1) -> −10 -> 10
   (1, 2): +(−2) then +6 -> −10 -> −4
   (2, 0): +6 then +(−4) -> −2 -> −6
   (2, 1): +6 then ×(−1) -> −2 -> 2  ✓
   (2, 2): +6 then +6 -> −2 -> 4
L5 S3 from 2 tunnel −6: rows ×(−3) , +(−4) , ×3 || ×3 , +(−5) , −(−3)
   (0, 0): ×(−3) then ×3 -> −6 -> −18
   (0, 1): ×(−3) then +(−5) -> −6 -> −11
   (0, 2): ×(−3) then −(−3) -> −6 -> −3
   (1, 0): +(−4) then ×3 -> −2 -> −6  ✓
   (1, 1): +(−4) then +(−5) -> −2 -> −7
   (1, 2): +(−4) then −(−3) -> −2 -> 1
   (2, 0): ×3 then ×3 -> 6 -> 18
   (2, 1): ×3 then +(−5) -> 6 -> 1
   (2, 2): ×3 then −(−3) -> 6 -> 9
L5 S4 from −6 tunnel 8: rows ×(−2) , +(−4) , −(−1) || ×(−2) , +(−4) , +(−1)
   (0, 0): ×(−2) then ×(−2) -> 12 -> −24
   (0, 1): ×(−2) then +(−4) -> 12 -> 8  ✓
   (0, 2): ×(−2) then +(−1) -> 12 -> 11
   (1, 0): +(−4) then ×(−2) -> −10 -> 20
   (1, 1): +(−4) then +(−4) -> −10 -> −14
   (1, 2): +(−4) then +(−1) -> −10 -> −11
   (2, 0): −(−1) then ×(−2) -> −5 -> 10
   (2, 1): −(−1) then +(−4) -> −5 -> −9
   (2, 2): −(−1) then +(−1) -> −5 -> −6
L5 S5 from 8 tunnel −5: rows ÷(−2) , −(−2) , −2 || ÷(−2) , ×(−1) , −(−2)
   (0, 0): ÷(−2) then ÷(−2) -> −4 -> 2
   (0, 1): ÷(−2) then ×(−1) -> −4 -> 4
   (0, 2): ÷(−2) then −(−2) -> −4 -> −2
   (1, 0): −(−2) then ÷(−2) -> 10 -> −5  ✓
   (1, 1): −(−2) then ×(−1) -> 10 -> −10
   (1, 2): −(−2) then −(−2) -> 10 -> 12
   (2, 0): −2 then ÷(−2) -> 6 -> −3
   (2, 1): −2 then ×(−1) -> 6 -> −6
   (2, 2): −2 then −(−2) -> 6 -> 8
L5 S6 from −5 tunnel 4: rows ×(−2) , +(−3) , −(−3) || ×(−2) , −(−3) , ×2
   (0, 0): ×(−2) then ×(−2) -> 10 -> −20
   (0, 1): ×(−2) then −(−3) -> 10 -> 13
   (0, 2): ×(−2) then ×2 -> 10 -> 20
   (1, 0): +(−3) then ×(−2) -> −8 -> 16
   (1, 1): +(−3) then −(−3) -> −8 -> −5
   (1, 2): +(−3) then ×2 -> −8 -> −16
   (2, 0): −(−3) then ×(−2) -> −2 -> 4  ✓
   (2, 1): −(−3) then −(−3) -> −2 -> 1
   (2, 2): −(−3) then ×2 -> −2 -> −4
L6 S8 from −1 tunnel 9: rows (  )² , +(−2) , −(−2) || (  )² , ×3 , (  )³
   (0, 0): (  )² then (  )² -> 1 -> 1
   (0, 1): (  )² then ×3 -> 1 -> 3
   (0, 2): (  )² then (  )³ -> 1 -> 1
   (1, 0): +(−2) then (  )² -> −3 -> 9  ✓
   (1, 1): +(−2) then ×3 -> −3 -> −9
   (1, 2): +(−2) then (  )³ -> −3 -> −27
   (2, 0): −(−2) then (  )² -> 1 -> 1
   (2, 1): −(−2) then ×3 -> 1 -> 3
   (2, 2): −(−2) then (  )³ -> 1 -> 1
L7 S1 from −15 tunnel 7: rows ÷5 , +5 , ÷(−5) || −4 , ×(−1) , −(−4)
   (0, 0): ÷5 then −4 -> −3 -> −7
   (0, 1): ÷5 then ×(−1) -> −3 -> 3
   (0, 2): ÷5 then −(−4) -> −3 -> 1
   (1, 0): +5 then −4 -> −10 -> −14
   (1, 1): +5 then ×(−1) -> −10 -> 10
   (1, 2): +5 then −(−4) -> −10 -> −6
   (2, 0): ÷(−5) then −4 -> 3 -> −1
   (2, 1): ÷(−5) then ×(−1) -> 3 -> −3
   (2, 2): ÷(−5) then −(−4) -> 3 -> 7  ✓
L7 S4 from −6 tunnel 9: rows ÷3 , ÷(−3) , −(−3) || (  )² , ×(−1) , +(−4)
   (0, 0): ÷3 then (  )² -> −2 -> 4
   (0, 1): ÷3 then ×(−1) -> −2 -> 2
   (0, 2): ÷3 then +(−4) -> −2 -> −6
   (1, 0): ÷(−3) then (  )² -> 2 -> 4
   (1, 1): ÷(−3) then ×(−1) -> 2 -> −2
   (1, 2): ÷(−3) then +(−4) -> 2 -> −2
   (2, 0): −(−3) then (  )² -> −3 -> 9  ✓
   (2, 1): −(−3) then ×(−1) -> −3 -> 3
   (2, 2): −(−3) then +(−4) -> −3 -> −7
L7 S6 from −9 tunnel 2: rows ÷(−3) , −(−3) , +(−3) || −(−3) , ×(−1) , ÷(−3)
   (0, 0): ÷(−3) then −(−3) -> 3 -> 6
   (0, 1): ÷(−3) then ×(−1) -> 3 -> −3
   (0, 2): ÷(−3) then ÷(−3) -> 3 -> −1
   (1, 0): −(−3) then −(−3) -> −6 -> −3
   (1, 1): −(−3) then ×(−1) -> −6 -> 6
   (1, 2): −(−3) then ÷(−3) -> −6 -> 2  ✓
   (2, 0): +(−3) then −(−3) -> −12 -> −9
   (2, 1): +(−3) then ×(−1) -> −12 -> 12
   (2, 2): +(−3) then ÷(−3) -> −12 -> 4
L7 S8 from −12 tunnel 0: rows ÷(−6) , −(−6) , ÷6 || ×(−1) , +2 , ×2
   (0, 0): ÷(−6) then ×(−1) -> 2 -> −2
   (0, 1): ÷(−6) then +2 -> 2 -> 4
   (0, 2): ÷(−6) then ×2 -> 2 -> 4
   (1, 0): −(−6) then ×(−1) -> −6 -> 6
   (1, 1): −(−6) then +2 -> −6 -> −4
   (1, 2): −(−6) then ×2 -> −6 -> −12
   (2, 0): ÷6 then ×(−1) -> −2 -> 2
   (2, 1): ÷6 then +2 -> −2 -> 0  ✓
   (2, 2): ÷6 then ×2 -> −2 -> −4
```

---

## 2. Notation and terms

### Gate labels (`opLabel`, `rules.ts:64-72`)
- `+3`, `+(−5)`, `−(−3)`, `−5`, `×(−2)`, `×2`, `÷(−4)`, `÷4`, `(  )²`, `(  )³`: Workbook notation, with negatives in parentheses. ✓
- Every minus sign in labels, examples, rule strings and the HUD is U+2212 (`MINUS`, `rules.ts:4`). I searched `src/*.ts` and `index.html` for an ASCII `-` or a dash before a digit inside display strings and found none. ✓ Hebrew `ל־` uses the maqaf U+05BE. ✓
- The ambiguous `−3²` never appears: power gates show `(  )²` / `(  )³`, and `expression()` writes `(−3)² = (−3) × (−3) = 9` with the base in parentheses, as the Workbook does (`(-3)^2 = (-3) \times (-3) = 9`, negative-base-powers). ✓
- `expression()` follows the Workbook: parentheses around a negative left operand for × and ÷ (`(−15) ÷ 5 = −3`), none for + and − (`−2 − (−3) = −2 + 3 = 1`). The intro `example` strings for levels 4 and 7 break this (S7).
- The Workbook writes division as both `÷` and `:`. The game uses `÷` throughout, which is consistent and fine.
- Readout `+8` / `−8` with an explicit plus: the Workbook uses `+4`, `+500` the same way in directed-numbers. ✓
- **Rendering (M4):** the label strings are correct, but the 3D panels clip them behind the arch pillars.
- I measured the crash-card line `המנהרה בגובה −8, הגעת ל־+8` in the DOM (glyph x positions): the minus renders to the left of the 8 inside the `<bdi dir="ltr">`. No bidi bug.

### Hebrew rule phrasings against the Workbook
| Game string | Workbook | Verdict |
|---|---|---|
| `'אותו סימן ← חיובי'` / `'סימנים שונים ← שלילי'` (`rules.ts:116`) | "אותו סימן ← חיובי", "סימנים שונים ← שלילי" (multiplying-directed, dividing-directed) | ✓ word for word |
| `'חיסור מספר שלילי = חיבור הנגדי ← עולים'` (`rules.ts:107`) | "חיסור של מספר שלילי שווה לחיבור הנגדי שלו" (subtracting-directed) | ✓ |
| `'חיבור מספר שלילי ← יורדים'` / `'חיבור מספר חיובי ← עולים'` | "כשמחברים מספר שלילי, זזים שמאלה על הציר" (horizontal) | ✓ (the vertical axis is the game's metaphor) |
| `'מספר זוגי של מינוסים ← חיובי'` / `'מספר אי־זוגי של מינוסים ← שלילי'` (`rules.ts:120-121`) | Same wording (negative-base-powers) | ✓ |
| `'כפל ב־(−1) נותן את המספר הנגדי: מראה מעל קו המים'` | "המספר הנגדי", "באותו מרחק מאפס, אבל בצד השני" | Term ✓, image wrong (M2) |
| `'כל מספר כפול אפס הוא אפס'` | "כל מספר כפול אפס שווה אפס" | ✓ |
| `'אפס חלקי מספר הוא אפס'` | (division by zero is never generated) | ✓ |
| Level rules 1, 2, 4, 5, 6 | see M1, S4, S5, M3, S6 | fix |

### Required terms
- **מספר מכוון**: used in every level subtitle (`חיבור/חיסור/כפל/חילוק מספרים מכוונים`). ✓
- **מספר נגדי**: in the ×(−1) rule (`המספר הנגדי`) and the level 2 rule (`חיבור הנגדי שלו`). ✓
- **ציר המספרים**: not visible anywhere (only `aria-label`). ✗ S12
- **ערך מוחלט**: absent. ✗ S12

### UI strings (grammar, address, clarity for a 13-year-old)
All quoted strings were read in place. Fine as they are: `'מתחת לקו המים!'` / `'מספר שלילי = מתחת לאפס'`, `'עברתם בעזרת רוח רפאים'` / `'המכפיל חזר ל־×1'`, `'תקועים? החזיקו Shift … אבל המכפיל יורד ל־×1.'`, `'כאן יש שתי שורות שערים לפני כל מנהרה. בחרו מסלול בכל שורה.'`, `'חוזרים לנקודת השמירה'`, `'מנהרות בניסיון ראשון בלי עזרה'`, result S/A/C notes, `'סיימתם את כל השלבים! לתפריט'`, `'יאללה, רצים!'`. The Hebrew key mapping (ש = A, ג = D, פ = P, צ = M) is correct for a Hebrew layout. Needs fixing: S8 (singular vs plural), S9, S10, S11, N2 to N4.

---

## 3. Misconceptions: which segments catch them

A **lure** is a wrong lane that the misconception makes look correct, which is the strong kind of catch. A **dead end** means the misconception leaves no lane reaching the tunnel, so the student guesses; that still blocks them, but weakly.

| Misconception | Lures (level·segment, the wrong gate) | Dead ends / other catches | Verdict |
|---|---|---|---|
| "minus minus is minus" (−(−n) read as −n) | L2·2 `−(−5)`, L2·5 `−(−9)`, L2·6 `−(−5)`, L2·8 `−(−7)`; L3·4 `−(−4)`, L3·8 `−(−8)`; L6·5 `−(−12)`; L6·8 `−(−2)` then `(  )²`; L7·4 `−(−3)` then `×(−1)` | L2·1 (all three lanes give −5 to this student), L2·3, ·4, ·7, ·9 | Strong. A simulated "the operand's sign tells the direction" student passes **0 of 9** in level 2. |
| "a negative times a negative is negative" (also ÷) | L3·4 `×(−3)`, L3·8 `×(−5)`; L4·3 `÷(−3)`, L4·4 `×(−2)`, L4·9 `×(−6)`, L4·10 `÷(−4)`; L6·3 `×(−4)`, L6·4 `÷(−2)`, L6·6 `÷(−16)`, L6·7 `×(−1)`, L6·10 `×(−9)`; L7·8 `÷(−6)` then `+2` | L3·2, L3·5, L3·9, L4·1, L4·5 (neg÷neg is the right answer and no lane works for the student) | Good overall. **Weak in level 3**, the level that introduces it: only 2 lures in 9, and L3·2 has no ×1 twin (S2). |
| "dividing always makes it smaller" | No exact lure (this is about direction, not one wrong number). Divisions that make the number **bigger**: L4·1 (−12→3), L4·3 (−15→−5), L4·5 (−10→5), L4·10 (−12→−3), L6·4 (−8→−4), L6·6 (−16→−1), L7·1 (−15→3), L7·6 (−6→2). A student who won't divide "upward" is pushed toward the competing upward gate `−(−4)` (L4·1), `−(−5)` (L4·5), `−(−3)` (L4·10). | — | Adequate for authored play. **Lost in fresh L4** (M5: three quarters of it is ÷(±1)). |
| "adding a negative moves you up" | L1·1 `+(−3)`, L1·4 `+(−5)`, L1·5 `+(−5)`, L1·8 `+(−12)`; L2·1 `+(−3)`; L5·1 `+(−5)` then `×(−1)` (the brief's reverse-order trap), L5·2, L5·6; L7·3 `+(−8)`, L7·6 | L1·2, ·3, ·6, ·7 | Strong. In level 1 every segment offers exactly two gates of the right size (correct + its sign twin), so only the sign decides. |
| "(−3)² = −9" | L6·5 `(  )²` from −4 (believed −16 = tunnel), L6·7 `(  )²` from −1 (believed −1 = tunnel) | L6·1 (`×3` → −9 sits next to `(  )²`; the student finds no 9), L6·8 | **Weak**: 2 lures, and none in level 7 (transfer). Suggest one level 7 segment whose tunnel is −9 or −4 with a `(  )²` lure, e.g. from −2 to tunnel −4 via `×2`, with `(  )²` as a lure. |

Matches `CURRICULUM.md`'s claims, except for level 5 ("reversed order always on the board", false for L5·3, S1).

---

## 4. Bypass hunting

Simulated on all authored single-row segments (expected passes, random tie-break; pure guessing gives 1/3 per segment):

| Strategy | L1 (8) | L2 (9) | L3 (9) | L4 (10) | L6 (9 single) | L7 (4 single) |
|---|---|---|---|---|---|---|
| Always left / center / right (correct-lane count) | 2/3/3 | 3/3/3 | 3/3/3 | 2/4/4 | 2/4/3 (of 10) | 1/1/3 (of 8, incl. straight two-row paths) |
| "+ first when the tunnel is above, − first when below" | 2.7 | 3.2 | 1.7 | 2.3 | 2.7 | 0.3 |
| "operand sign = direction" (`−(−3)` means down) | 4.0 | **0.0** | 2.5 | 3.5 | 2.8 | 1.3 |
| "gate number equals the tunnel" | 2.5 | 2.7 | 2.0 | 2.5 | 2.8 | 1.0 |
| "gate number equals the distance to the tunnel" | 4.0 | 4.2 | 3.7 | 3.0 | 3.3 | 1.3 |

- No shortcut does clearly better than guessing. "Number = distance" wins about 50 % in levels 1 and 2 only because the correct gate and its sign twin share the distance, so the student still has to know which sign, and that is the lesson. "Number equals the tunnel" mostly lands on traps (L1·3 `+(−6)`, L2·6 `−(−5)`, L3·7 `−(−2)`, L4·3 `÷(−5)`, L4·7 `×8`, L4·10 `−(−3)`, L6·7 `×(−1)`). Only L1·1 and L6·9 reward it.
- Correct-lane positions: no lane wins more than 4 of 10, and runs of the same lane are near chance. The center (respawn) lane solves the first segment of levels 2, 3, 6 (N6).
- Two rows: the correct path always changes lanes, and in level 5 it is always one ×/÷ gate plus one +/− gate (N7). The ops that appear in both rows narrow it to the two orders, which is the intended decision.
- **Ghost:** on the last row the correct lane's ghost turns green (`scene.ts` `showGhost`, `good = lastRow && v === tunnel`), so the ghost gives the full answer. That is fine as a paid hint (multiplier ×1, logged, half a rank point), but note the arithmetic: holding the ghost on every segment of an 8-segment level gives 0 crashes, 8 hints, p = 4, **rank B**, while honest guessing gives about 8 crashes, rank C. Ghost-everything always beats guessing; consider rank thresholds that count a hint as 1 when ghost use is above half the segments. Level 7 has no ghost. ✓
- Ruler, readout, labels: the ruler shows only your value and the tunnel, and the readout changes only after a gate, so neither leaks a lane. The tunnel wall's height spans all wrong finals (`scene.ts` `WALL_TOP/WALL_BOTTOM` from `allPaths`), which says something about the *range* of results but not which lane. Fine.
- `window.render_game_to_text` is installed even without `?test` (`main.ts:453`). It reveals no results (only gate labels; `ghostPreview` only while the ghost is held), so this isn't a learning bypass. Gate it behind `TEST` for hygiene.
- **Crash card, first vs second crash:** the first crash shows your own worked steps, the rule for your key step and where the tunnel was: no answer, good. The second crash adds the correct worked path. On a single-row segment two crashes have already eliminated two lanes, so the reveal adds nothing; it serves as a worked example, which is right. On a two-row segment it cuts the search from 9 to 3 attempts; acceptable, and both crashes are already in the rank. One gap: the explanation doesn't name an *order* mistake (S3).

Live check (headless Chrome): L3·1 first crash with `−(−4)`: `4 − (−4) = 4 + 4 = 8` / `חיסור מספר שלילי = חיבור הנגדי ← עולים` / `המנהרה בגובה −8, הגעת ל־+8`, no fix line. Second crash with `×2`: `4 × 2 = 8` / `אותו סימן ← חיובי` / same need line / `הדרך שעוברת: 4 × (−2) = −8`. The ghost from 4 showed `[8, −8, 8]`. Level 5 reversed order: `3 + (−5) = −2`, `(−2) × (−1) = 2`, rule `כפל ב־(−1) … מראה מעל קו המים` (M2, S3). Level 7: `(−15) ÷ 5 = −3`, `−3 − 4 = −7`, `סימנים שונים ← שלילי`, `המנהרה בגובה +7°C` (S11). No page errors.

---

## 5. Level 5 re-authoring (segment 2)

Brief: "From 3: ×(−1) then +(−5) = −8; +(−5) then ×(−1) = 2. Tunnels at −8 and then 2 force both orders."

- **Segment 1** reproduces the brief exactly: rows `[×(−1), +(−5), +1] || [+2, +(−5), ×(−1)]`; ×(−1) then +(−5) = −8 ✓, and the reversed order +(−5) then ×(−1) = 2 is on the board as the trap. Unique (1 of 9).
- **Segment 2** (from −8): `[×(−1), +(−2), +6] || [+(−4), ×(−1), +6]`; +6 then ×(−1): −8 → −2 → 2 ✓; reversed ×(−1) then +6: 8 → 14 is on the board. Unique.
- **Verdict: this keeps the brief's intent.** The brief's literal second tunnel ("2 from 3") can't be reached from −8, and its goal (the multiply-first order must be used once and the add-first order once, in back-to-back tunnels, with the wrong order visible both times) is met: segment 1 rewards ×-first, segment 2 rewards +-first, and the tunnel heights −8 and 2 are kept. The two ops in segment 2 (+6, ×(−1)) aren't the same pair as segment 1, which is fine; reusing +(−5) from −8 can't reach 2 in either order. The intro `example` still shows the brief's original pair, which is good.
- Segments 4 to 6 are real order contrasts; segment 3 is not (S1).

---

## 6. Generator (`freshLevel`)

Sampled seeds 1 to 3 per level by reading them, and seeds 1 to 200 per level with counters. Every generated segment I checked was unique and exact (the solver check works), and no seed threw.

| Level | What a student would see | Verdict |
|---|---|---|
| 1 | Good targets and sign-twin distractors (`+9 \| −9 \| +8` from −1 to 8), but 52 % of segments show a subtraction gate (`−(−12)` in S1 of seed 1), and some show `+0`. | S14, M6 |
| 2 | Good: `−(−7)` vs `−7` vs `+(−7)` from −6 to 1; 85 % of correct ops are subtraction; occasional `−0`. | M6 |
| 3 | **Broken**: after 2 or 3 segments the value is stuck at ±16 and every segment is `×(−1)` vs `×1` vs `−1` (seed 1: 7 of 9 segments). 85 % of correct ops are ×(±1). | M5 |
| 4 | **Broken**: from the second or third segment the value is stuck at ±1: `[÷1 \| ÷(−1) \| −1]` again and again. 76 % ÷(±1). Neither division rule nor "division doesn't always make smaller" is practiced. | M5 |
| 5 | Order contrasts are real (both orders on the board), but 71 % lean on ×(−1), and `×1` / `+0` appear (`[+0 \| +(−2) \| ×(−1)] …`). Acceptable once M6 is done; vary the multiplier more. | M6, minor |
| 6 | Powers are the correct op in about 47 % of segments (the authored level has 5 of 10, so similar). Bounces between −3 and 9; large connector values like `−27→1 [−(−30) \| +27 \| +28]`. | N8 |
| 7 | Mixed and sensible (seed 1: from −15 to 8 via `−(−7)` then `×(−1)`), but ×1, ÷1 and `+0` show up (`1→−1 [÷1 \| ÷(−1) \| −1]`). | M5/M6 |

Smaller notes: `validSegment` allows `tunnel === start` for two-row segments (harmless). The lane shuffle `sort(() => r() - 0.5)` is biased but seeded; fine for 3 lanes.

---

## 7. Proposed replacement segments (verified)

```ts
// L3 segment 2 (S2): mirror gate next to its non-mirror twin
one(8, add(-1), mul(1), mul(-1)),            // −8: +(−1)→−9 | ×1→−8 | ×(−1)→8 ✓  (unique)
// L5 segment 3 (S1): a real order contrast, still ends at −6
two(-6, r(add(-2), mul(-2), mul(3)), r(mul(-2), sub(-3), add(-2))),
// from 2: ×(−2)→−4, +(−2)→−6 ✓ (lanes 1→2); reversed +(−2)→0, ×(−2)→0; 1 of 9 paths, all exact
```

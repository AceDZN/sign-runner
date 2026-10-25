# Curriculum map — רץ הסימנים

Source of truth: Workbook, grade 7, chapter 7 ("פרק 7: מספרים שליליים, חיוביים ואפס"). Snapshots used while building are in `workbook/` (fetched 2026-10-25). Every gate result, tunnel height and explanation comes from `src/rules.ts`; every authored segment is proved solvable by exactly one lane path in `tests/levels.test.ts`.

The core representation is the number line turned upright: **your number is your altitude**, zero is the waterline, the ruler on the left is ציר המספרים (number line). Moving up = getting bigger, moving down = getting smaller, so order and distance on the line are felt rather than told.

| Level | Workbook modules | Skill practised (the decision you make) | Misconception it catches (wrong lane that looks right) |
|---|---|---|---|
| 1 · קו המים | [number-line-expanded](https://math.workbook.co.il/grade-7/chapter-7/number-line-expanded), [adding-directed](https://math.workbook.co.il/grade-7/chapter-7/adding-directed) | Pick the addition that lands exactly on the tunnel: `+3` vs `+(−3)`, `+(−5)` takes you from 3 under the waterline to −2. | "Adding a negative moves you up": e.g. from 4 to −3, `+(−1)` lands on +3 (mirror of the tunnel). Sign traps −2 vs +2, −3 vs +3. |
| 2 · מינוס מינוס | [opposite-numbers](https://math.workbook.co.il/grade-7/chapter-7/opposite-numbers), [subtracting-directed](https://math.workbook.co.il/grade-7/chapter-7/subtracting-directed) | Subtracting a number = adding its opposite (a − b = a + (−b)): `−(−3)` from −2 rises to 1. | "Minus minus is minus": `−3` and `+(−3)` both sink to −5 when the tunnel is at +1; later tunnels sit where the misconception points. |
| 3 · היפוך | [multiplying-directed](https://math.workbook.co.il/grade-7/chapter-7/multiplying-directed), [opposite-numbers](https://math.workbook.co.il/grade-7/chapter-7/opposite-numbers) | Same sign → positive, different signs → negative. `×(−1)` is the mirror gate: it gives the opposite number, reflected across the waterline. | "Negative × negative is negative": from −2 the tunnel is at −6, and `×(−3)` (true +6) looks right to a student holding the misconception. |
| 4 · פיצול | [dividing-directed](https://math.workbook.co.il/grade-7/chapter-7/dividing-directed) | Division follows the multiplication sign rules; every division gate is exact. | "Negative ÷ negative is negative" and "dividing always makes it smaller": from −12, `÷4` → −3 rises (division made the number bigger). |
| 5 · הסדר קובע | [order-of-ops-directed](https://math.workbook.co.il/grade-7/chapter-7/order-of-ops-directed) | Two gate rows per tunnel: the same two operations in the other order give a different number. From 3: `×(−1)` then `+(−5)` = −8, but `+(−5)` then `×(−1)` = 2. | "Order doesn't matter": the reversed order is always on the board and always crashes. |
| 6 · חזקות | [negative-base-powers](https://math.workbook.co.il/grade-7/chapter-7/negative-base-powers) | `(  )²` squares your current value: (−3)² = 9; `(  )³` keeps the sign: (−2)³ = −8. The ambiguous −3² form never appears. | "(−3)² = −9": `×3` from −3 gives −9 right next to the `(  )²` gate; from −4 the tunnel is at −16 and `(  )²` (true +16) is the trap. |
| 7 · תחנת הקרח (transfer) | all of the above | New skin and context: altitude is temperature in °C on a thermometer, faster tempo, no ghost hint, mixed gates and two-gate chains with unfamiliar values (from −15: `÷(−5)` then `−(−4)` → 7). | Mixed: adding a negative, minus-minus, negative × negative. |

## Teaching through action

- No typed answers and no quiz popups. The only input is which lane you're in when you cross a gate.
- A wrong lane is a visible, funny, recoverable consequence: you smash into the tunnel wall in slow motion and respawn at the segment start within about 2.4 s at normal tempo.
- The first crash on a segment shows a worked line of what you did (`4 × (−2) = −8`) and the rule (`סימנים שונים ← שלילי`), plus where the tunnel was. A second crash on the same segment also shows the path that goes through.
- The ghost hint (hold Shift, the ghost button, or two fingers) shows where each lane of the next row puts you. It's logged and resets the multiplier to ×1. The transfer level has no ghost.
- Slower tempo option (80 BPM instead of 100) for students who read slowly; no other time pressure.

## Learning log

Anonymous, local only (`localStorage` key `sign-runner-learning-v1`, plus memory): level, segment, attempt number, start value, gate labels chosen, values reached, tunnel, outcome, whether the ghost was used, and `firstUnaided` (first attempt, no ghost) so first unaided decisions are separated from hinted or repeated successes. Nothing leaves the device.

## Fresh exercises

After the authored run, "שוב, עם תרגילים חדשים" builds a seeded variant of the level (`src/generator.ts`): same skill, start value and row structure, new numbers, misconception-shaped distractors, and a solver check that every segment has exactly one path and only exact arithmetic (`tests/generator.test.ts`).

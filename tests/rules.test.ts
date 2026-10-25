import { test } from 'node:test';
import assert from 'node:assert/strict';
import { add, sub, mul, div, sq, cube, apply, tryApply, opLabel, expression, signed, ruleHe, misconceivedApply, MINUS } from '../src/rules';

const m = (s: string) => s.replace(/-/g, MINUS);

test('gate labels use Workbook notation with real minus signs', () => {
  assert.equal(opLabel(add(3)), '+3');
  assert.equal(opLabel(add(-5)), m('+(-5)'));
  assert.equal(opLabel(sub(-3)), m('-(-3)'));
  assert.equal(opLabel(sub(3)), m('-3'));
  assert.equal(opLabel(mul(-2)), m('×(-2)'));
  assert.equal(opLabel(div(-4)), m('÷(-4)'));
  assert.equal(opLabel(sq()), '(  )²');
  assert.equal(opLabel(cube()), '(  )³');
  for (const op of [add(-5), sub(-3), mul(-2), div(-4)]) assert.ok(!opLabel(op).includes('-'), 'never a hyphen');
});

test('directed-number arithmetic is exact', () => {
  assert.equal(apply(add(-5), 3), -2);
  assert.equal(apply(sub(-3), -2), 1);
  assert.equal(apply(sub(3), -2), -5);
  assert.equal(apply(mul(-2), 4), -8);
  assert.equal(apply(mul(-2), -4), 8);
  assert.equal(apply(div(-4), -12), 3);
  assert.equal(apply(div(4), -12), -3);
  assert.equal(apply(sq(), -3), 9);
  assert.equal(apply(cube(), -2), -8);
  assert.equal(apply(mul(-1), 0), 0);
  assert.ok(Object.is(apply(mul(-1), 0), 0), 'no negative zero');
});

test('inexact or undefined division is rejected, never rounded', () => {
  assert.equal(tryApply(div(-2), 3), null);
  assert.equal(tryApply(div(0), 3), null);
  assert.throws(() => apply(div(4), 6));
});

test('worked expressions keep negatives in parentheses', () => {
  assert.equal(expression(4, mul(-2)), m('4 × (-2) = -8'));
  assert.equal(expression(-2, sub(-3)), m('-2 - (-3) = -2 + 3 = 1'));
  assert.equal(expression(-3, sq()), m('(-3)² = (-3) × (-3) = 9'));
  assert.equal(expression(-2, cube()), m('(-2)³ = (-2) × (-2) × (-2) = -8'));
  assert.equal(expression(-12, div(-4)), m('(-12) ÷ (-4) = 3'));
  assert.equal(signed(3), '+3');
  assert.equal(signed(-8), m('-8'));
  assert.equal(signed(0), '0');
});

test('sign rules in Hebrew match the operation', () => {
  assert.equal(ruleHe(4, mul(-2)), 'סימנים שונים ← שלילי');
  assert.equal(ruleHe(-4, mul(-2)), 'אותו סימן ← חיובי');
  assert.equal(ruleHe(-12, div(-4)), 'אותו סימן ← חיובי');
  assert.match(ruleHe(-2, sub(-3)), /חיבור הנגדי/);
  assert.match(ruleHe(3, add(-5)), /יורדים/);
});

test('misconceptions predict the classic wrong results', () => {
  assert.equal(misconceivedApply('minusMinusIsMinus', sub(-3), -2), -5);
  assert.equal(misconceivedApply('negTimesNegIsNeg', mul(-2), -4), -8);
  assert.equal(misconceivedApply('addNegMovesUp', add(-5), 3), 8);
  assert.equal(misconceivedApply('negSquareIsNeg', sq(), -3), -9);
  assert.equal(misconceivedApply('minusMinusIsMinus', add(3), 1), null);
});

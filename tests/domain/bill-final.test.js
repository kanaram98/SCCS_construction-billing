import test from 'node:test';
import assert from 'node:assert/strict';
import { finalizeBill, reopenBill, isFinal } from '../../src/domain/bill-final.js';
import { getBillTotals } from '../../src/domain/calculations.js';
import { duplicateBill } from '../../src/domain/factories.js';

const rate = (price) => ({ id: 'r1', name: 'Tiles', unit: 'sqft', type: 'count', rate: price });
const bill = () => ({
  id: 'b1', number: '1', discount: '', taxRate: 0, gstEnabled: false, advance: '', payments: [],
  sections: [{ id: 's', name: 'F', areas: [{ id: 'a', name: 'R', items: [{ id: 'i', rateId: 'r1', name: 'Tiles', unit: 'sqft', type: 'count', rate: 100, count: 10 }] }] }]
});

test('a final bill keeps its prices when the rate changes; reopening follows the rate again', () => {
  const final = finalizeBill(bill(), [rate(100)]);
  assert.equal(isFinal(final), true);
  assert.equal(final.sections[0].areas[0].items[0].rateId, undefined);
  assert.equal(final.sections[0].areas[0].items[0].sourceRateId, 'r1');
  assert.equal(getBillTotals(final, [rate(100)]).total, 1000);
  assert.equal(getBillTotals(final, [rate(150)]).total, 1000); // rate went up: the final bill stays
  assert.equal(getBillTotals(bill(), [rate(150)]).total, 1500); // an open bill follows it

  const reopened = reopenBill(final, [rate(150)]);
  assert.equal(isFinal(reopened), false);
  assert.equal(getBillTotals(reopened, [rate(150)]).total, 1500);
});

test('finalizing freezes what the bill showed at that moment', () => {
  const final = finalizeBill(bill(), [rate(120)]); // live rate is 120 while the item remembers 100
  assert.equal(getBillTotals(final, [rate(999)]).total, 1200);
});

test('a copy of a final bill is open, follows the rates and has no payments or adjustments', () => {
  const source = { ...finalizeBill(bill(), [rate(100)]), advanceAdjustments: [{ id: 'j', advanceId: 'a', amount: 5, date: '2026-11-01' }] };
  const copy = duplicateBill(source, '2');
  assert.equal(isFinal(copy), false);
  assert.deepEqual(copy.advanceAdjustments, []);
  assert.equal(copy.sections[0].areas[0].items[0].rateId, 'r1');
  assert.equal(copy.sections[0].areas[0].items[0].sourceRateId, undefined);
});

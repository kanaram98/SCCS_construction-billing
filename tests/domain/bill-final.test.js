import test from 'node:test';
import assert from 'node:assert/strict';
import { markReady, backToDraft, isFinal, firmForBill } from '../../src/domain/bill-final.js';
import { getBillTotals } from '../../src/domain/calculations.js';
import { duplicateBill } from '../../src/domain/factories.js';

const rate = (price) => ({ id: 'r1', name: 'Tiles', unit: 'sqft', type: 'count', rate: price });
const bill = () => ({
  id: 'b1', number: '1', discount: '', taxRate: 0, gstEnabled: false, advance: '', payments: [],
  sections: [{ id: 's', name: 'F', areas: [{ id: 'a', name: 'R', items: [{ id: 'i', rateId: 'r1', name: 'Tiles', unit: 'sqft', type: 'count', rate: 100, count: 10 }] }] }]
});

test('an entry keeps the price it was made with when the rate changes; a ready bill also detaches from the rate', () => {
  const ready = markReady(bill(), [rate(100)]);
  assert.equal(isFinal(ready), true);
  assert.equal(ready.status, 'ready');
  assert.equal(ready.sections[0].areas[0].items[0].rateId, undefined);
  assert.equal(ready.sections[0].areas[0].items[0].sourceRateId, 'r1');
  assert.equal(getBillTotals(ready, [rate(100)]).total, 1000);
  assert.equal(getBillTotals(ready, [rate(150)]).total, 1000); // rate went up: the ready bill stays
  assert.equal(getBillTotals(bill(), [rate(150)]).total, 1000); // so does a draft: the price is part of the entry

  const draft = backToDraft(ready, [rate(150)]);
  assert.equal(isFinal(draft), false);
  assert.equal(draft.sections[0].areas[0].items[0].rateId, 'r1');
  assert.equal(getBillTotals(draft, [rate(150)]).total, 1000); // still the price it had
});

test('an entry with no saved price follows the live rate', () => {
  const open = bill();
  delete open.sections[0].areas[0].items[0].rate;
  assert.equal(getBillTotals(open, [rate(150)]).total, 1500);
});

test('marking ready freezes what the bill showed at that moment', () => {
  const ready = markReady(bill(), [rate(120)]); // live rate is 120 while the entry remembers 100
  assert.equal(getBillTotals(ready, [rate(999)]).total, 1000);
});

test('a ready bill keeps the firm details as they were, and going back to draft drops them', () => {
  const firm = { name: 'SCCS', address: 'Old road', phone: '1', gstin: '', gstRegistered: false, bankName: 'X', logo: 'data:image/png;base64,AA' };
  const ready = markReady(bill(), [rate(100)], new Date(), firm);
  assert.deepEqual(ready.firmSnapshot, { name: 'SCCS', address: 'Old road', phone: '1', gstin: '', gstRegistered: false });
  assert.equal(firmForBill(ready, { ...firm, address: 'New road' }).address, 'Old road');
  assert.equal(firmForBill(ready, { ...firm, address: 'New road' }).bankName, 'X'); // only the printed header is frozen
  assert.equal(firmForBill(bill(), { ...firm, address: 'New road' }).address, 'New road');
  assert.equal(backToDraft(ready, [rate(100)]).firmSnapshot, undefined);
});

test('a copy of a ready bill is a draft, follows the rates and has no payments or adjustments', () => {
  const source = { ...markReady(bill(), [rate(100)]), advanceAdjustments: [{ id: 'j', advanceId: 'a', amount: 5, date: '2026-11-01' }], submittedAt: 'x' };
  const copy = duplicateBill(source, '2');
  assert.equal(isFinal(copy), false);
  assert.equal(copy.status, 'draft');
  assert.deepEqual(copy.advanceAdjustments, []);
  assert.equal(copy.sections[0].areas[0].items[0].rateId, 'r1');
  assert.equal(copy.sections[0].areas[0].items[0].sourceRateId, undefined);
});

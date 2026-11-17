import test from 'node:test';
import assert from 'node:assert/strict';
import {
  billLabel,
  convertEstimateToBill,
  createNextRunningBill,
  getRunningAccount,
  getSeries,
  nextNumberFor
} from '../../src/domain/bill-kinds.js';
import { makeTranslator } from '../../src/i18n/translate.js';

const t = makeTranslator('en');
const rates = [{ id: 'r', type: 'count', rate: 1000 }];
const withCount = (count) => [{ id: 's', name: 'GF', areas: [{ id: 'a', name: 'Hall', items: [{ id: 'i', rateId: 'r', count }] }] }];

test('estimates and bills are numbered separately', () => {
  const bills = [{ number: '4' }, { number: '7', kind: 'estimate' }, { number: '2', kind: 'estimate' }];
  assert.equal(nextNumberFor(bills, 'bill'), '5');
  assert.equal(nextNumberFor(bills, 'estimate'), '8');
  assert.equal(billLabel({ number: '3', kind: 'estimate' }, t), 'Estimate 3');
  assert.equal(billLabel({ number: '9', raNumber: 2 }, t), 'Bill 9 · RA 2');
});

test('converting an estimate creates a new bill with fresh ids', () => {
  const estimate = { id: 'e1', kind: 'estimate', number: '3', projectName: 'Villa', advance: '500', payments: [{ amount: 1 }], sections: withCount(2) };
  const bill = convertEstimateToBill(estimate, [estimate, { number: '6' }]);
  assert.equal(bill.kind, 'bill');
  assert.equal(bill.number, '7');
  assert.equal(bill.sourceEstimateId, 'e1');
  assert.deepEqual(bill.payments, []);
  assert.equal(bill.advance, '');
  assert.notEqual(bill.sections[0].areas[0].items[0].id, 'i');
  assert.equal(bill.sections[0].areas[0].items[0].count, 2);
});

test('next running bill keeps project details and room structure without entries', () => {
  const first = { id: 'b1', number: '1', projectName: 'Tower', client: 'Ravi', taxRate: '18', gstEnabled: true, sections: withCount(3) };
  const { bill: second, sourcePatch } = createNextRunningBill([first], first);
  assert.deepEqual(sourcePatch, { raSeriesId: 'b1', raNumber: 1 });
  assert.equal(second.raSeriesId, 'b1');
  assert.equal(second.raNumber, 2);
  assert.equal(second.number, '2');
  assert.equal(second.projectName, 'Tower');
  assert.equal(second.taxRate, '18');
  assert.equal(second.sections[0].areas[0].name, 'Hall');
  assert.deepEqual(second.sections[0].areas[0].items, []);

  const firstAsRa = { ...first, ...sourcePatch };
  const { bill: third, sourcePatch: noChange } = createNextRunningBill([firstAsRa, second], second);
  assert.equal(third.raNumber, 3);
  assert.deepEqual(noChange, {});
  assert.deepEqual(getSeries([third, firstAsRa, second], second).map((bill) => bill.raNumber), [1, 2, 3]);
});

test('running account adds up work and payments to date', () => {
  const ra1 = { id: 'b1', raSeriesId: 'b1', raNumber: 1, advance: '2000', sections: withCount(3) };
  const ra2 = { id: 'b2', raSeriesId: 'b1', raNumber: 2, payments: [{ amount: 500 }], sections: withCount(2) };
  const ra3 = { id: 'b3', raSeriesId: 'b1', raNumber: 3, sections: withCount(10) };
  const account = getRunningAccount([ra1, ra2, ra3], ra2, rates);
  assert.deepEqual(account, {
    raNumber: 2,
    previousCount: 1,
    thisTotal: 2000,
    previousTotal: 3000,
    totalToDate: 5000,
    receivedToDate: 2500,
    balanceToDate: 2500
  });
  assert.equal(getRunningAccount([ra1], { id: 'x', sections: [] }, rates), null);
});

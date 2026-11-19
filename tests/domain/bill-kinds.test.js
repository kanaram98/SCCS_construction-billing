import test from 'node:test';
import assert from 'node:assert/strict';
import {
  billLabel,
  convertEstimateToBill,
  createNextRunningBill,
  nextRunningBlocker,
  projectCode,
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
  assert.equal(billLabel({ number: '9', raNumber: 2 }, t), 'Bill 9 R2');
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

test('next running bill keeps project details and name but starts completely empty', () => {
  const first = { id: 'b1', number: '1', projectId: 'p1', projectName: 'Tower', client: 'Ravi', taxRate: '18', gstEnabled: true, sections: withCount(3) };
  const { bill: second, sourcePatch } = createNextRunningBill([first], first);
  assert.deepEqual(sourcePatch, { raSeriesId: 'b1', raNumber: 1 });
  assert.equal(second.raSeriesId, 'b1');
  assert.equal(second.raNumber, 2);
  assert.equal(second.number, '1'); // a running series keeps the number of its first bill
  assert.equal(second.projectName, 'Tower');
  assert.equal(second.projectId, 'p1'); // stays linked to the same project, so reports include it
  assert.equal(second.taxRate, '18');
  assert.deepEqual(second.sections, []);

  const firstAsRa = { ...first, ...sourcePatch };
  const { bill: third, sourcePatch: noChange } = createNextRunningBill([firstAsRa, second], second);
  assert.equal(third.raNumber, 3);
  assert.deepEqual(noChange, {});
  assert.deepEqual(getSeries([third, firstAsRa, second], second).map((bill) => bill.raNumber), [1, 2, 3]);
});

test('a next running bill starts from the latest ready or submitted bill of a single chain', () => {
  const ready = (extra) => ({ id: 'b1', status: 'ready', ...extra });
  assert.equal(nextRunningBlocker([], { id: 'd', status: 'draft' }), 'not-ready');
  assert.equal(nextRunningBlocker([], { id: 's', status: 'submitted' }), '');
  assert.equal(nextRunningBlocker([], ready({ kind: 'estimate' })), 'estimate');
  assert.equal(nextRunningBlocker([], ready({ cancelled: true })), 'cancelled');
  assert.equal(nextRunningBlocker([], ready()), '');
  const r1 = ready({ id: 'r1', raSeriesId: 'r1', raNumber: 1 });
  const r2 = ready({ id: 'r2', raSeriesId: 'r1', raNumber: 2 });
  assert.equal(nextRunningBlocker([r1, r2], r1), 'not-latest');
  assert.equal(nextRunningBlocker([r1, r2], r2), '');
});

test('running account adds up work and payments to date', () => {
  const ra1 = { id: 'b1', raSeriesId: 'b1', raNumber: 1, advance: '2000', sections: withCount(3) };
  const ra2 = { id: 'b2', raSeriesId: 'b1', raNumber: 2, payments: [{ amount: 500 }], sections: withCount(2) };
  const ra3 = { id: 'b3', raSeriesId: 'b1', raNumber: 3, sections: withCount(10) };
  const account = getRunningAccount([ra1, ra2, ra3], ra2, rates);
  assert.deepEqual(account.trail.map((entry) => [entry.raNumber, entry.total, entry.current]), [[1, 3000, false], [2, 2000, true]]);
  delete account.trail;
  assert.equal(account.discountToDate, 0);
  delete account.discountToDate;
  assert.equal(account.dueApartToDate, 0);
  delete account.dueApartToDate;
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

test('bills of a project read like site references', () => {
  const t = (text, params = {}) => text.replace(/\{(\w+)\}/g, (_m, key) => params[key]);
  assert.equal(projectCode('Lake View Villa'), 'LVV');
  assert.equal(projectCode('Tower'), 'TOW');
  assert.equal(projectCode(''), 'PRJ');
  assert.equal(billLabel({ projectId: 'p', projectName: 'Lake View Villa', number: '3' }, t), 'LVV/003');
  assert.equal(billLabel({ projectId: 'p', projectName: 'Lake View Villa', number: '3', raNumber: 2 }, t), 'LVV/003 R2');
  assert.equal(billLabel({ projectId: 'p', projectName: 'Tower', number: '2', kind: 'estimate' }, t), 'TOW/EST-002');
  assert.equal(billLabel({ number: '5' }, t), 'Bill 5'); // no project: plain
});

test('a bill left as due keeps its balance apart; a carried one rolls into the next bill', () => {
  const make = (id, n, extra) => ({ id, raSeriesId: 'a', raNumber: n, status: 'submitted', sections: [{ areas: [{ items: [{ rateId: 'c', count: 1 }] }] }], gstEnabled: false, ...extra });
  const rates = [{ id: 'c', type: 'count', rate: 1000 }];
  const next = make('b', 2, { status: 'ready' });
  const apart = getRunningAccount([make('a', 1, { advance: '600', settlement: { kind: 'due', amount: 400 } }), next], next, rates);
  assert.equal(apart.dueApartToDate, 400);
  assert.equal(apart.balanceToDate, 1000); // only this bill's own 1,000
  const carried = getRunningAccount([make('a', 1, { advance: '600', settlement: { kind: 'carry', amount: 400 } }), next], next, rates);
  assert.equal(carried.balanceToDate, 1400);
  const discounted = getRunningAccount([make('a', 1, { advance: '600', settlement: { kind: 'discount', amount: 400 } }), next], next, rates);
  assert.equal(discounted.balanceToDate, 1000);
  assert.equal(discounted.discountToDate, 400);
});

test('numbers count within a project, a series keeps its number, and a deleted draft frees its R number', () => {
  const a1 = { id: 'a1', projectId: 'pa', number: '1' };
  const a2 = { id: 'a2', projectId: 'pa', number: '2' };
  const b1 = { id: 'b1', projectId: 'pb', number: '1' };
  assert.equal(nextNumberFor([a1, a2, b1], 'bill', 'pa'), '3');
  assert.equal(nextNumberFor([a1, a2, b1], 'bill', 'pb'), '2');
  assert.equal(nextNumberFor([a1, a2, b1], 'bill', 'pc'), '1'); // a new project starts at 001
  const r1 = { ...a1, raSeriesId: 'a1', raNumber: 1, status: 'ready' };
  const r2 = createNextRunningBill([r1], r1).bill;
  assert.equal(r2.number, '1');
  assert.equal(r2.raNumber, 2);
  const r3 = createNextRunningBill([r1, { ...r2, status: 'ready' }], { ...r2, status: 'ready' }).bill;
  assert.equal(r3.raNumber, 3);
  // the draft R3 is deleted: the next running bill takes R3 again
  assert.equal(createNextRunningBill([r1, { ...r2, status: 'ready' }], { ...r2, status: 'ready' }).bill.raNumber, 3);
  assert.equal(billLabel({ ...r3, projectId: 'pa', projectName: 'One' }, t), 'ONE/001 R3');
});

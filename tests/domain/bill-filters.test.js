import test from 'node:test';
import assert from 'node:assert/strict';
import { EMPTY_BILL_FILTERS, billStage, filterBills } from '../../src/domain/bill-filters.js';

const bills = [
  { id: 'a', number: '1', name: 'Marble work', projectName: 'Villa', client: 'Sharma', date: '2026-01-01', status: 'draft' },
  { id: 'b', number: '2', projectName: 'Office', client: 'Verma', date: '2026-02-01', status: 'ready', quotationLabel: 'Q-0007 v2' },
  { id: 'c', number: '3', projectName: 'Shop', client: 'Rao', date: '2026-03-01', status: 'submitted' },
  { id: 'd', number: '4', projectName: 'Home', client: 'Jain', date: '2026-04-01', status: 'ready', cancelled: true },
  { id: 'e', number: '1', kind: 'estimate', projectName: 'Mall', client: 'Gupta', date: '2026-05-01' }
];
const ids = (filters) => filterBills(bills, { ...EMPTY_BILL_FILTERS, ...filters }, () => 'unpaid').map((bill) => bill.id);

test('a bill’s stage: estimate, cancelled, or draft / ready / submitted', () => {
  assert.deepEqual(bills.map(billStage), ['draft', 'ready', 'submitted', 'cancelled', 'estimate']);
});

test('search finds a bill by number, name, client, project or quotation', () => {
  assert.deepEqual(ids({ search: 'marble' }), ['a']);
  assert.deepEqual(ids({ search: 'verma' }), ['b']);
  assert.deepEqual(ids({ search: 'q-0007' }), ['b']);
  assert.deepEqual(ids({ search: 'shop' }), ['c']);
  assert.deepEqual(ids({ search: '3' }).includes('c'), true);
});

test('the stage filter narrows to one stage, and combines with search', () => {
  assert.deepEqual(ids({ stage: 'ready' }), ['b']);
  assert.deepEqual(ids({ stage: 'cancelled' }), ['d']);
  assert.deepEqual(ids({ stage: 'estimate' }), ['e']);
  assert.deepEqual(ids({ stage: 'submitted', search: 'rao' }), ['c']);
  assert.deepEqual(ids({ stage: 'draft', search: 'rao' }), []);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { getDashboardSummary } from '../../src/domain/dashboard.js';

const rates = [{ id: 'r', type: 'count', rate: 1000 }];
const items = (count) => [{ id: 's', areas: [{ id: 'a', items: [{ id: 'i', rateId: 'r', count }] }] }];
const now = new Date('2026-11-17T10:00:00Z');

const bills = [
  // 5,000 billed this month, 1,000 advance (counts as received this month), 500 paid this month
  { id: 'a', number: '1', date: '2026-11-05', client: 'Ravi', advance: '1000', payments: [{ date: '2026-11-10', amount: 500 }], sections: items(5) },
  // old bill, unpaid → overdue
  { id: 'b', number: '2', date: '2026-09-01', client: 'Meera', sections: items(3) },
  // fully paid last month
  { id: 'c', number: '3', date: '2026-10-20', client: 'Ravi', advance: '2000', sections: items(2) },
  // open estimate, and a converted one
  { id: 'e1', number: '1', kind: 'estimate', date: '2026-11-01', sections: items(7) },
  { id: 'e2', number: '2', kind: 'estimate', date: '2026-10-01', convertedBillId: 'c', sections: items(1) }
];

test('money totals count bills only', () => {
  const summary = getDashboardSummary(bills, rates, now);
  assert.equal(summary.billCount, 3);
  assert.equal(summary.totalBilled, 10000);
  assert.equal(summary.totalReceived, 3500);
  assert.equal(summary.outstanding, 6500);
  assert.equal(summary.billedThisMonth, 5000);
  assert.equal(summary.receivedThisMonth, 1500);
  assert.deepEqual([summary.unpaidCount, summary.partialCount, summary.paidCount], [1, 1, 1]);
  assert.equal(summary.openEstimateCount, 1);
  assert.equal(summary.openEstimateValue, 7000);
});

test('overdue bills, clients with dues and recent activity', () => {
  const summary = getDashboardSummary(bills, rates, now);
  assert.deepEqual(summary.overdue.map(({ bill, balance, days }) => [bill.id, balance, days]), [['b', 3000, 77]]);
  assert.deepEqual(summary.topClients.map(({ client, balance, bills: count }) => [client, balance, count]), [['Ravi', 3500, 1], ['Meera', 3000, 1]]);
  assert.deepEqual(summary.recent.map((bill) => bill.id), ['a', 'e1', 'c', 'e2', 'b']);
});

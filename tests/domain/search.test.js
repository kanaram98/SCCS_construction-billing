import test from 'node:test';
import assert from 'node:assert/strict';
import { searchAll } from '../../src/domain/search.js';

const data = {
  bills: [{ id: 'b1', number: '12', date: '2026-11-01', projectName: 'Lake villa', client: 'Mehta', clientPhone: '98', sections: [] }],
  projects: [{ id: 'p1', name: 'Lake villa', client: 'Mehta', clientPhone: '98', address: 'Udaipur', notes: '' }, { id: 'p2', name: 'Shop', client: 'Rao', clientPhone: '', address: '', notes: '' }],
  labour: { workers: [{ id: 'w1', name: 'Mehtab', role: 'Mason', phone: '', active: false }, { id: 'w2', name: 'Gone', role: '', phone: '', active: true, deletedAt: '2026-11-01T00:00:00Z' }] },
  expenses: [{ id: 'e1', projectId: 'p1', date: '2026-11-03', amount: 250, category: 'food', note: 'Mehta site lunch' }],
  advances: [{ id: 'a1', projectId: 'p2', date: '2026-11-02', amount: 5000, note: '' }],
  rates: [{ id: 'r1', name: 'Floor tiles', unit: 'sqft', rate: 85 }]
};

test('finds across bills, projects, workers and notes, and says where each result goes', () => {
  const found = searchAll(data, 'mehta');
  assert.deepEqual(Object.keys(found), ['bills', 'projects', 'workers', 'expenses']);
  assert.equal(found.projects.items[0].view, 'projects');
  assert.equal(found.projects.items[0].focus.projectId, 'p1');
  assert.equal(found.bills.items[0].focus.billId, 'b1');
  assert.equal(found.workers.items[0].subtitle, 'Mason · Left'); // a worker who left can still be found
  assert.equal(found.expenses.items[0].focus.month, '2026-11');
});

test('ignores deleted workers, short queries and finds amounts and rates', () => {
  assert.deepEqual(searchAll(data, 'm'), {});
  assert.equal(searchAll(data, 'gone').workers, undefined);
  assert.equal(searchAll(data, '5000').advances.items[0].focus.projectId, 'p2');
  assert.equal(searchAll(data, 'tiles').rates.items[0].view, 'rates');
});

test('limits each group but reports the full count', () => {
  const many = { ...data, bills: Array.from({ length: 10 }, (_u, i) => ({ id: `b${i}`, number: String(i), projectName: 'Same', client: '', date: '', sections: [] })) };
  const result = searchAll(many, 'same', { limit: 3 });
  assert.equal(result.bills.items.length, 3);
  assert.equal(result.bills.total, 10);
});

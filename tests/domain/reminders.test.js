import test from 'node:test';
import assert from 'node:assert/strict';
import { buildReminders } from '../../src/domain/reminders.js';

const labour = (extra = {}) => ({
  workers: [{ id: 'w1', active: true }, { id: 'w2', active: true }, { id: 'w3', active: false }],
  attendance: {}, payments: [], closedMonths: {}, ...extra
});

test('reminds about workers with no attendance today, not about those who left', () => {
  const none = buildReminders({ bills: [], labour: labour() }, '2026-11-18');
  assert.deepEqual(none, [{ id: 'attendance', count: 2, of: 2 }]);
  const some = buildReminders({ bills: [], labour: labour({ attendance: { '2026-11-18': { w1: { units: 1 } } } }) }, '2026-11-18');
  assert.deepEqual(some, [{ id: 'attendance', count: 1, of: 2 }]);
  assert.deepEqual(buildReminders({ bills: [], labour: labour({ attendance: { '2026-11-18': { w1: { units: 1 }, w2: { units: 0 } } } }) }, '2026-11-18'), []);
});

test('reminds about bills without a project (not samples or estimates)', () => {
  const bills = [{ id: 'a' }, { id: 'b', projectId: 'p' }, { id: 'c', isSample: true }, { id: 'd', kind: 'estimate' }];
  assert.deepEqual(buildReminders({ bills, labour: { workers: [], attendance: {}, payments: [], closedMonths: {} } }, '2026-11-18'), [{ id: 'unlinked', count: 1 }]);
});

test('reminds to close last month from the 3rd, only if it had labour records', () => {
  const worked = labour({ workers: [], attendance: { '2026-10-20': { w1: { units: 1 } } } });
  assert.deepEqual(buildReminders({ bills: [], labour: worked }, '2026-11-02'), []);
  assert.deepEqual(buildReminders({ bills: [], labour: worked }, '2026-11-03'), [{ id: 'monthOpen', month: '2026-10' }]);
  assert.deepEqual(buildReminders({ bills: [], labour: { ...worked, closedMonths: { '2026-10': {} } } }, '2026-11-10'), []);
  assert.deepEqual(buildReminders({ bills: [], labour: labour({ workers: [] }) }, '2026-11-10'), []);
});

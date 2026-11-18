import test from 'node:test';
import assert from 'node:assert/strict';
import { createLabourState, createWorker, liveLabour, normalizeLabour, workerBalance, workerMonth } from '../../src/domain/labour.js';
import * as ops from '../../src/domain/labour-ops.js';
import { describeEntry, entryInvolves } from '../../src/domain/labour-log.js';
import { makeTranslator } from '../../src/i18n/translate.js';

const at = (day, hour = 10) => new Date(`2026-11-${String(day).padStart(2, '0')}T${String(hour).padStart(2, '0')}:00:00Z`);
const t = makeTranslator('en');

function setup() {
  const ramesh = createWorker({ id: 'w1', name: 'Ramesh', dailyWage: 600 }, at(1));
  const suresh = createWorker({ id: 'w2', name: 'Suresh', dailyWage: 500 }, at(1));
  let labour = createLabourState();
  labour = ops.addWorker(labour, ramesh, at(1));
  labour = ops.addWorker(labour, suresh, at(1));
  return { labour, ramesh, suresh };
}

test('marking attendance logs one entry with before and after', () => {
  const { labour: start, ramesh, suresh } = setup();
  let labour = ops.markAttendance(start, '2026-11-02', [{ worker: ramesh, units: 1 }, { worker: suresh, units: 1 }], at(2));
  labour = ops.markAttendance(labour, '2026-11-02', [{ worker: ramesh, units: 0 }], at(2, 11));
  const entry = labour.log.at(-1);
  assert.equal(entry.entity, 'attendance');
  assert.deepEqual(entry.changes.map((change) => [change.workerId, change.before.units, change.after.units]), [['w1', 1, 0]]);
  // Same value again: nothing changes, nothing logged.
  assert.equal(ops.markAttendance(labour, '2026-11-02', [{ worker: ramesh, units: 0 }], at(2, 12)), labour);
  const info = describeEntry(entry, { names: new Map([['w1', 'Ramesh']]), t });
  assert.deepEqual(info.lines, ['Ramesh: 1P → A']);
});

test('undo restores the earlier attendance and is logged; it cannot be undone twice', () => {
  const { labour: start, ramesh } = setup();
  let labour = ops.markAttendance(start, '2026-11-02', [{ worker: ramesh, units: 1 }], at(2));
  labour = ops.markAttendance(labour, '2026-11-02', [{ worker: ramesh, units: 0 }], at(2, 11));
  const mistake = labour.log.at(-1);
  labour = ops.revertEntry(labour, mistake.id, at(2, 12));
  assert.equal(labour.attendance['2026-11-02'].w1.units, 1);
  assert.equal(labour.log.at(-1).revertOf, mistake.id);
  assert.equal(ops.revertBlocker(labour, mistake), 'reverted');
});

test('payments: edits keep the old values, deletes go to the recycle bin and can be restored', () => {
  const { labour: start } = setup();
  let labour = ops.addPayment(start, { workerId: 'w1', date: '2026-11-03', amount: 2000, mode: 'cash', note: 'Advance' }, at(3));
  const id = labour.payments[0].id;
  assert.equal(labour.payments[0].version, 1);
  labour = ops.updatePayment(labour, id, { workerId: 'w1', date: '2026-11-03', amount: 1500, mode: 'upi', note: 'Advance' }, at(4));
  assert.deepEqual([labour.payments[0].amount, labour.payments[0].version], [1500, 2]);
  const edit = labour.log.at(-1);
  assert.deepEqual([edit.before.amount, edit.after.amount], [2000, 1500]);
  assert.deepEqual(describeEntry(edit, { names: new Map([['w1', 'Ramesh']]), t }).lines, ['Ramesh', '₹2,000 → ₹1,500', 'Cash → UPI']);

  labour = ops.deletePayment(labour, id, at(5));
  assert.ok(labour.payments[0].deletedAt);
  assert.equal(liveLabour(labour).payments.length, 0);
  assert.deepEqual(ops.recycleBin(labour).map((item) => [item.type, item.workerName]), [['payment', 'Ramesh']]);
  labour = ops.restorePayment(labour, id, at(6));
  assert.equal(liveLabour(labour).payments.length, 1);

  labour = ops.revertEntry(labour, edit.id, at(7)); // undo the edit
  assert.equal(labour.payments[0].amount, 2000);
});

test('a deleted worker and their records leave reports until restored', () => {
  const { labour: start, ramesh } = setup();
  let labour = ops.markAttendance(start, '2026-11-02', [{ worker: ramesh, units: 2 }], at(2));
  labour = ops.addPayment(labour, { workerId: 'w1', date: '2026-11-02', amount: 300 }, at(2));
  labour = ops.deleteWorker(labour, 'w1', at(3));
  const live = liveLabour(labour);
  assert.deepEqual(live.workers.map((worker) => worker.id), ['w2']);
  assert.equal(live.attendance['2026-11-02'], undefined);
  assert.equal(workerMonth(live, 'w1', '2026-11').earned, 0);
  labour = ops.restoreWorker(labour, 'w1', at(4));
  assert.equal(workerBalance(liveLabour(labour), 'w1'), 900);
  assert.ok(labour.log.some((entry) => entry.entity === 'worker' && entry.action === 'restore'));
  assert.ok(entryInvolves(labour.log.at(-1), 'w1'));
});

test('a closed month blocks attendance and payment changes until unlocked', () => {
  const { labour: start, ramesh } = setup();
  let labour = ops.addPayment(start, { workerId: 'w1', date: '2026-11-03', amount: 500 }, at(3));
  const id = labour.payments[0].id;
  labour = ops.closeMonth(labour, '2026-11', at(30));
  assert.equal(ops.markAttendance(labour, '2026-11-04', [{ worker: ramesh, units: 1 }], at(30)), labour);
  assert.equal(ops.addPayment(labour, { workerId: 'w1', date: '2026-11-20', amount: 1 }, at(30)), labour);
  assert.equal(ops.deletePayment(labour, id, at(30)), labour);
  assert.equal(ops.updatePayment(labour, id, { workerId: 'w1', date: '2026-11-03', amount: 9 }, at(30)), labour);
  // Moving a payment from an open month into a closed one is blocked too.
  const december = ops.addPayment(labour, { workerId: 'w1', date: '2026-12-01', amount: 100 }, at(30));
  const decId = december.payments.at(-1).id;
  assert.equal(ops.updatePayment(december, decId, { workerId: 'w1', date: '2026-11-30', amount: 100 }, at(30)), december);

  labour = ops.unlockMonth(labour, '2026-11', at(30, 11));
  assert.notEqual(ops.markAttendance(labour, '2026-11-04', [{ worker: ramesh, units: 1 }], at(30, 12)), labour);
  assert.deepEqual(labour.log.slice(-2).map((entry) => entry.action), ['close', 'unlock']);
});

test('the recycle bin empties after 30 days and the log is trimmed', () => {
  const { labour: start } = setup();
  let labour = ops.addPayment(start, { workerId: 'w1', date: '2026-11-03', amount: 500 }, at(3));
  labour = ops.deletePayment(labour, labour.payments[0].id, at(3));
  labour = ops.deleteWorker(labour, 'w2', at(3));
  assert.equal(normalizeLabour(labour, at(20)).payments.length, 1); // still in the bin
  const later = normalizeLabour(labour, new Date('2026-12-10T00:00:00Z'));
  assert.equal(later.payments.length, 0);
  assert.deepEqual(later.workers.map((worker) => worker.id), ['w1']);
  const old = { ...labour, log: [{ id: 'x', at: '2025-01-01T00:00:00Z', entity: 'month', action: 'close', month: '2024-12' }, ...labour.log] };
  assert.equal(normalizeLabour(old, at(10)).log.some((entry) => entry.id === 'x'), false);
});

test('purging from the recycle bin is final and logged', () => {
  const { labour: start } = setup();
  let labour = ops.deleteWorker(start, 'w2', at(3));
  const deletion = labour.log.at(-1);
  labour = ops.purgeDeletedWorker(labour, 'w2', at(4));
  assert.equal(labour.workers.some((worker) => worker.id === 'w2'), false);
  assert.equal(labour.log.at(-1).action, 'purge');
  assert.equal(ops.revertBlocker(labour, deletion), 'missing');
  assert.equal(ops.revertBlocker(labour, labour.log.at(-1)), 'final');
});

test('a worker who left keeps their records; deleting one with records is detected', async () => {
  const { workerHasRecords, workersForMonth } = await import('../../src/domain/labour.js');
  const { labour: start, ramesh, suresh } = setup();
  assert.equal(start.workers[0].joinedOn.length, 10);
  assert.equal(workerHasRecords(start, 'w1'), false);
  let labour = ops.markAttendance(start, '2026-11-02', [{ worker: ramesh, units: 1 }], at(2));
  labour = ops.addPayment(labour, { workerId: 'w1', date: '2026-11-05', amount: 200 }, at(5));
  assert.equal(workerHasRecords(labour, 'w1'), true);
  assert.equal(workerHasRecords(labour, suresh.id), false);

  labour = ops.updateWorker(labour, 'w1', { active: false, leftOn: '2026-11-10' }, at(10));
  const left = labour.workers.find((worker) => worker.id === 'w1');
  assert.deepEqual([left.active, left.leftOn], [false, '2026-11-10']);
  // Still in the November report, with the earned wages and the payment.
  assert.ok(workersForMonth(labour, '2026-11').some((worker) => worker.id === 'w1'));
  assert.equal(workerBalance(labour, 'w1'), 400);

  labour = ops.updateWorker(labour, 'w1', { active: true, leftOn: '', joinedOn: '2026-12-01' }, at(11));
  assert.deepEqual([labour.workers[0].active, labour.workers[0].leftOn, labour.workers[0].joinedOn], [true, '', '2026-12-01']);
});

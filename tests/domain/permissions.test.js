import test from 'node:test';
import assert from 'node:assert/strict';
import { ADMIN_ONLY, can, canEditAttendanceDate, canRestore, canUndo } from '../../src/domain/permissions.js';

const TODAY = '2026-11-18';

test('contractor does daily work; edits and deletes of rates, workers and payments are admin-only', () => {
  for (const action of ['editBill', 'deleteBill', 'addRate', 'addWorker', 'addPayment', 'markAttendance', 'closeMonth']) {
    assert.equal(can('contractor', action), true, action);
  }
  for (const action of ADMIN_ONLY) {
    assert.equal(can('contractor', action), false, action);
    assert.equal(can('admin', action), true, action);
  }
  for (const action of ['editRate', 'deleteRate', 'editWorker', 'deleteWorker', 'editPayment', 'deletePayment', 'unlockMonth']) {
    assert.ok(ADMIN_ONLY.includes(action), action);
  }
});

test('timesheet: the contractor can change today and the 2 days before, the admin any day', () => {
  for (const date of ['2026-11-18', '2026-11-17', '2026-11-16']) assert.equal(canEditAttendanceDate('contractor', date, TODAY), true, date);
  for (const date of ['2026-11-15', '2026-10-30', '2026-11-19']) assert.equal(canEditAttendanceDate('contractor', date, TODAY), false, date);
  assert.equal(canEditAttendanceDate('admin', '2026-01-01', TODAY), true);
  assert.equal(canEditAttendanceDate('contractor', '2026-12-01', '2026-12-02'), true, 'works across month ends');
  assert.equal(canEditAttendanceDate('contractor', '2026-11-29', '2026-12-01'), true);
  assert.equal(canEditAttendanceDate('contractor', '2026-11-28', '2026-12-01'), false);
  assert.equal(canEditAttendanceDate(undefined, TODAY, TODAY), false);
});

test('undo and restore follow the same limits', () => {
  const entry = (entity, action, extra = {}) => ({ entity, action, ...extra });
  // Bills, clients, templates and the quotation stay open to him.
  for (const entity of ['bills', 'clients', 'templates', 'quotation']) assert.equal(canUndo('contractor', entry(entity, 'update'), TODAY), true, entity);
  // Rates, payments, firm details and months do not.
  for (const entity of ['rates', 'payment', 'firm', 'month']) assert.equal(canUndo('contractor', entry(entity, 'update'), TODAY), false, entity);
  // Workers: only left / working.
  assert.equal(canUndo('contractor', entry('worker', 'update', { before: { name: 'A', active: true }, after: { name: 'A', active: false } }), TODAY), true);
  assert.equal(canUndo('contractor', entry('worker', 'update', { before: { name: 'A', dailyWage: 1 }, after: { name: 'A', dailyWage: 2 } }), TODAY), false);
  assert.equal(canUndo('contractor', entry('worker', 'update', { before: { name: 'A', active: true, leftOn: '' }, after: { name: 'A', active: false, leftOn: '2026-11-10' } }), TODAY), true);
  assert.equal(canUndo('contractor', entry('worker', 'delete'), TODAY), false);
  // Attendance: by the day.
  assert.equal(canUndo('contractor', entry('attendance', 'update', { date: '2026-11-17' }), TODAY), true);
  assert.equal(canUndo('contractor', entry('attendance', 'update', { date: '2026-11-01' }), TODAY), false);
  assert.equal(canUndo('admin', entry('rates', 'update'), TODAY), true);

  for (const entity of ['bills', 'clients', 'templates']) assert.equal(canRestore('contractor', entity), true, entity);
  for (const entity of ['rates', 'worker', 'payment']) assert.equal(canRestore('contractor', entity), false, entity);
  assert.equal(canRestore('admin', 'rates'), true);
});

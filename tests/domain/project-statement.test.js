import test from 'node:test';
import assert from 'node:assert/strict';
import { createProject, createAdvance, createExpense } from '../../src/domain/projects.js';
import { projectStatement, labourForProject, periodRange, inPeriod } from '../../src/domain/project-statement.js';
import { statementTables } from '../../src/documents/statement-tables.js';
import { markAttendance } from '../../src/domain/labour-ops.js';
import { createLabourState } from '../../src/domain/labour.js';

const rates = [{ id: 'r', type: 'count', rate: 1000 }];
const project = createProject({ id: 'p1', name: 'Villa', client: 'Asha', agreedAmount: '100000' });
const bill = (extra) => ({ id: 'b1', status: 'submitted', number: '1', date: '2026-11-05', projectId: 'p1', advance: '500', payments: [{ id: 'x', amount: 300 }], taxRate: 0, sections: [{ areas: [{ items: [{ rateId: 'r', count: 10 }] }] }], ...extra });
const worker = (id, wage) => ({ id, name: id.toUpperCase(), dailyWage: wage, active: true });

function labourWith(entries) {
  let labour = { ...createLabourState(), workers: [worker('a', 500), worker('b', 800)] };
  for (const [date, workerId, units, projectId] of entries) {
    labour = markAttendance(labour, date, [{ worker: labour.workers.find((w) => w.id === workerId), units, projectId }], new Date('2026-11-20T10:00:00Z'));
  }
  return labour;
}

test('labour cost only counts marks made at the project; others are unassigned', () => {
  const labour = labourWith([['2026-11-02', 'a', 1, 'p1'], ['2026-11-03', 'a', 2, 'p1'], ['2026-11-03', 'b', 1, 'p2'], ['2026-11-04', 'b', 1, ''], ['2026-11-05', 'b', 0, 'p1']]);
  const mine = labourForProject(labour, 'p1');
  assert.equal(mine.cost, 1500); // 3 P × 500; the absent mark costs nothing
  assert.equal(mine.rows.length, 1);
  assert.equal(mine.rows[0].days, 2);
  assert.equal(labourForProject(labour, '').cost, 800);
  assert.equal(labourForProject(labour, 'p1', { from: '2026-11-03', to: '2026-11-30' }).cost, 1000);
});

test('statement adds up billing, money in, costs, earning and cash', () => {
  const labour = labourWith([['2026-11-02', 'a', 2, 'p1']]);
  const state = {
    bills: [bill(), bill({ id: 'est', kind: 'estimate' }), bill({ id: 'other', projectId: 'p2' })],
    advances: [createAdvance({ projectId: 'p1', amount: 2000, date: '2026-11-01' })],
    expenses: [createExpense({ projectId: 'p1', amount: 700, date: '2026-11-06' }), createExpense({ projectId: 'p2', amount: 99, date: '2026-11-06' })],
    rates, labour
  };
  const s = projectStatement(project, state);
  assert.equal(s.billed, 10000);
  assert.equal(s.paidOnBills, 800);
  assert.equal(s.received, 2800); // 800 on the bill + 2000 advance
  assert.equal(s.receivable, 7200);
  assert.equal(s.expenseTotal, 700);
  assert.equal(s.labour.cost, 1000);
  assert.equal(s.costs, 1700);
  assert.equal(s.earning, 8300);
  assert.equal(s.cash, 1100);
  const tables = statementTables(s, (text) => text, (n) => `₹${n}`);
  assert.deepEqual(tables.map((table) => table.title), ['Summary', 'Bills by stage', 'Bills', 'Advances from the client', 'Site expenses', 'Labour cost']);
});

test('a period limits every part of the statement', () => {
  const state = {
    bills: [bill({ date: '2026-10-05' })],
    advances: [createAdvance({ projectId: 'p1', amount: 2000, date: '2026-11-01' })],
    expenses: [createExpense({ projectId: 'p1', amount: 700, date: '2026-10-06' })],
    rates, labour: createLabourState()
  };
  const november = projectStatement(project, state, { from: '2026-11-01', to: '2026-11-31' });
  assert.equal(november.billed, 0);
  assert.equal(november.advanceTotal, 2000);
  assert.equal(november.expenseTotal, 0);
  assert.equal(projectStatement(project, state).expenseTotal, 700);
});

test('period choices', () => {
  assert.deepEqual(periodRange('all', { today: '2026-11-18' }), { from: '', to: '' });
  assert.deepEqual(periodRange('month', { today: '2026-11-18' }), { from: '2026-11-01', to: '2026-11-31' });
  assert.deepEqual(periodRange('lastMonth', { today: '2026-01-10' }), { from: '2025-12-01', to: '2025-12-31' });
  assert.equal(inPeriod('2026-11-05', { from: '2026-11-01', to: '2026-11-31' }), true);
  assert.equal(inPeriod('2026-12-01', { from: '2026-11-01', to: '2026-11-31' }), false);
});

test('advance applied to a bill lowers the bill balance but is not counted as new money', async () => {
  const { getBillTotals } = await import('../../src/domain/calculations.js');
  const { advanceRemaining, createAdjustment } = await import('../../src/domain/payments.js');
  const { projectSummary } = await import('../../src/domain/project-report.js');
  const advance = createAdvance({ id: 'a1', projectId: 'p1', amount: 6000, date: '2026-11-01' });
  const adjusted = bill({ advance: '0', payments: [], advanceAdjustments: [createAdjustment({ advanceId: 'a1', amount: 4000 })] });
  const totals = getBillTotals(adjusted, rates);
  assert.equal(totals.total, 10000);
  assert.equal(totals.paid, 4000);
  assert.equal(totals.balance, 6000);
  assert.equal(totals.cashPaid, 0);
  assert.equal(advanceRemaining(advance, [adjusted]), 2000);

  const state = { bills: [adjusted], advances: [advance], expenses: [], rates, labour: createLabourState() };
  for (const s of [projectStatement(project, state), projectSummary(project, state)]) {
    assert.equal(s.received, 6000); // the advance only: the 4000 applied is not added again
    assert.equal(s.receivable, 4000);
  }
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  billFieldsFromProject, createAdvance, createExpense, createProject, expensesByCategory, projectsFromBills, expensesByDay, getAdvanceErrors, getExpenseErrors, getProjectErrors, hasErrors
} from '../../src/domain/projects.js';
import { projectSummary, projectsByClient } from '../../src/domain/project-report.js';
import { recordChanges, liveState, recycleBin, restoreRecord } from '../../src/domain/history.js';
import { createInitialState } from '../../src/domain/app-state.js';

const rates = [{ id: 'r', type: 'count', rate: 1000 }];
const bill = (extra) => ({ id: 'b1', number: '1', projectId: 'p1', advance: '500', payments: [{ id: 'x', amount: 300 }], sections: [{ areas: [{ items: [{ rateId: 'r', count: 2 }] }] }], ...extra });

test('validators ask for a project, a date and an amount', () => {
  assert.equal(hasErrors(getProjectErrors(createProject({ name: 'Villa' }))), false);
  assert.ok(getProjectErrors(createProject({ name: '  ' })).name);
  assert.ok(getProjectErrors(createProject({ name: 'V', agreedAmount: '-5' })).agreedAmount);
  assert.deepEqual(Object.keys(getExpenseErrors(createExpense({ projectId: '', amount: 0 }))).filter((key) => getExpenseErrors(createExpense({ projectId: '', amount: 0 }))[key]).sort(), ['amount', 'projectId']);
  assert.equal(hasErrors(getExpenseErrors(createExpense({ projectId: 'p1', amount: 250, category: 'food' }))), false);
  assert.ok(getExpenseErrors(createExpense({ projectId: 'p1', amount: 5, category: 'gold' })).category);
  assert.ok(getAdvanceErrors(createAdvance({ projectId: 'p1', amount: 10, mode: 'crypto' })).mode);
});

test('expenses are grouped by day with a total for each day and a total by category', () => {
  const expenses = [
    createExpense({ projectId: 'p1', date: '2026-11-03', amount: 100, category: 'food' }),
    createExpense({ projectId: 'p1', date: '2026-11-03', amount: 50, category: 'travel' }),
    createExpense({ projectId: 'p2', date: '2026-11-01', amount: 20, category: 'food' }),
    createExpense({ projectId: 'p1', date: '2026-10-30', amount: 999, category: 'fuel' })
  ];
  const days = expensesByDay(expenses, { month: '2026-11' });
  assert.deepEqual(days.map((day) => [day.date, day.total, day.items.length]), [['2026-11-01', 20, 1], ['2026-11-03', 150, 2]]);
  assert.deepEqual(expensesByDay(expenses, { projectId: 'p1', month: '2026-11' }).map((day) => day.total), [150]);
  assert.deepEqual(expensesByCategory(expenses.slice(0, 3)).map((entry) => [entry.category, entry.total]), [['food', 120], ['travel', 50]]);
});

test('project summary: billed, received (bills + advances), receivable, expenses and cash', () => {
  const project = createProject({ id: 'p1', name: 'Villa', agreedAmount: '5000' });
  const summary = projectSummary(project, {
    rates,
    bills: [bill(), bill({ id: 'b2', projectId: 'other' }), bill({ id: 'est', kind: 'estimate' })],
    advances: [createAdvance({ projectId: 'p1', amount: 1000 }), createAdvance({ projectId: 'other', amount: 77 })],
    expenses: [createExpense({ projectId: 'p1', amount: 250 })]
  });
  assert.deepEqual(
    [summary.billCount, summary.billed, summary.paidOnBills, summary.advances, summary.received, summary.receivable, summary.expenses, summary.cash, summary.agreed],
    [1, 2000, 800, 1000, 1800, 200, 250, 1550, 5000]
  );
  const ahead = projectSummary(project, { rates, bills: [bill()], advances: [createAdvance({ projectId: 'p1', amount: 5000 })], expenses: [] });
  assert.equal(ahead.receivable, -3800); // the client has paid ahead
});

test('projects are grouped by client for per-client reports', () => {
  const groups = projectsByClient([
    createProject({ name: 'A', clientId: 'c1', client: 'Asha' }),
    createProject({ name: 'B', clientId: 'c1', client: 'Asha' }),
    createProject({ name: 'C', client: 'Ravi ' }),
    createProject({ name: 'D', client: 'ravi' })
  ]);
  assert.deepEqual(groups.map((group) => [group.client, group.projects.length]), [['Asha', 2], ['Ravi ', 2]]);
});

test('projects, advances and expenses use the same history and recycle bin as bills', () => {
  let raw = createInitialState();
  const apply = (change, minute) => { raw = recordChanges(raw, change(liveState(raw)), new Date(Date.UTC(2026, 10, 18, 9, minute))); };
  apply((live) => ({ ...live, projects: [createProject({ id: 'p1', name: 'Villa' })] }), 0);
  apply((live) => ({ ...live, expenses: [createExpense({ id: 'e1', projectId: 'p1', amount: 250, category: 'food' })] }), 1);
  assert.deepEqual(raw.log.map((entry) => [entry.entity, entry.action]), [['projects', 'create'], ['expenses', 'create']]);
  assert.equal(raw.expenses[0].version, 1);
  apply((live) => ({ ...live, expenses: [] }), 2);
  assert.ok(raw.expenses[0].deletedAt);
  assert.deepEqual(recycleBin(raw).map((item) => item.entity), ['expenses']);
  raw = restoreRecord(raw, 'expenses', 'e1', new Date(Date.UTC(2026, 10, 18, 9, 3)));
  assert.equal(liveState(raw).expenses.length, 1);
});

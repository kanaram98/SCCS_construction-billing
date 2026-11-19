/**
 * The full statement of one project: what was billed, what came in, what it
 * cost (site expenses and labour) and what is left. Everything can be limited
 * to a period (`from` / `to`, both optional, YYYY-MM-DD).
 *
 *   earning   billed before tax − expenses − labour   (what the work made)
 *   cash      received − expenses − labour            (money actually in hand)
 *
 * Labour is wages earned on attendance marked "at" this project (see Attendance).
 */
import { getBillTotals } from './calculations.js';
import { billsInScope, DEFAULT_REPORT_SCOPE, stageBreakdown } from './report-scope.js';
import { expensesByCategory, totalAmount } from './projects.js';
import { roundTo2 } from './formatters.js';

export const PERIOD_LABELS = Object.freeze({ all: 'All time', month: 'This month', lastMonth: 'Last month', custom: 'Choose dates' });

export const inPeriod = (date, { from = '', to = '' } = {}) => Boolean(date) && (!from || date >= from) && (!to || date <= to);

/** Wages earned per worker on marks for `projectId` ('' = marks with no site). */
export function labourForProject(labour, projectId, period = {}) {
  const rows = new Map();
  for (const [date, marks] of Object.entries(labour.attendance || {})) {
    if (!inPeriod(date, period)) continue;
    for (const [workerId, mark] of Object.entries(marks)) {
      if ((mark.projectId || '') !== projectId || !(mark.units > 0)) continue;
      const row = rows.get(workerId) || { workerId, name: labour.workers.find((worker) => worker.id === workerId)?.name || '', days: 0, units: 0, cost: 0 };
      row.days += 1;
      row.units += mark.units;
      row.cost += mark.units * mark.wage;
      rows.set(workerId, row);
    }
  }
  const list = [...rows.values()].map((row) => ({ ...row, units: roundTo2(row.units), cost: roundTo2(row.cost) })).sort((a, b) => b.cost - a.cost);
  return { rows: list, units: roundTo2(list.reduce((sum, row) => sum + row.units, 0)), cost: roundTo2(list.reduce((sum, row) => sum + row.cost, 0)) };
}

/**
 * `scope` says which bills the money figures count (see report-scope.js): only submitted ones, submitted +
 * ready (pending), or all including drafts. `byStage` always shows every stage, whatever the scope.
 */
export function projectStatement(project, { bills = [], advances = [], expenses = [], rates = [], labour = { attendance: {}, workers: [] } }, period = {}, { scope = DEFAULT_REPORT_SCOPE } = {}) {
  const projectBills = bills.filter((bill) => bill.projectId === project.id && inPeriod(bill.date, period));
  const billRows = billsInScope(projectBills, scope)
    .sort((a, b) => a.date.localeCompare(b.date))
    .map((bill) => ({ bill, number: bill.number, date: bill.date, ...getBillTotals(bill, rates) }));
  const sum = (field) => roundTo2(billRows.reduce((total, row) => total + row[field], 0));
  const projectAdvances = advances.filter((advance) => advance.projectId === project.id && inPeriod(advance.date, period)).sort((a, b) => a.date.localeCompare(b.date));
  const projectExpenses = expenses.filter((expense) => expense.projectId === project.id && inPeriod(expense.date, period));
  const work = labourForProject(labour, project.id, period);

  const billed = sum('total');
  const tax = sum('tax');
  const paidOnBills = sum('cashPaid'); // advance applied to bills is already in the project advances
  const advanceApplied = sum('adjusted');
  const advanceTotal = totalAmount(projectAdvances);
  const received = roundTo2(paidOnBills + advanceTotal);
  const expenseTotal = totalAmount(projectExpenses);
  const costs = roundTo2(expenseTotal + work.cost);
  return {
    project,
    period,
    scope,
    byStage: stageBreakdown(projectBills, rates),
    agreed: Number(project.agreedAmount) || 0,
    bills: billRows,
    billed,
    tax,
    billedBeforeTax: roundTo2(billed - tax),
    paidOnBills,
    advanceApplied,
    advances: projectAdvances,
    advanceTotal,
    received,
    discounts: sum('writtenOff'),
    receivable: roundTo2(billed - received - sum('writtenOff')),
    expenseTotal,
    expensesByCategory: expensesByCategory(projectExpenses),
    labour: work,
    costs,
    earning: roundTo2(billed - tax - costs),
    cash: roundTo2(received - costs),
    unassignedLabour: labourForProject(labour, '', period)
  };
}

/** Period choices for the report: all time, this month, last month or a custom range. */
export function periodRange(kind, { today, from = '', to = '' }) {
  const month = today.slice(0, 7);
  if (kind === 'month') return { from: `${month}-01`, to: `${month}-31` };
  if (kind === 'lastMonth') {
    const [year, mon] = month.split('-').map(Number);
    const last = mon === 1 ? `${year - 1}-12` : `${year}-${String(mon - 1).padStart(2, '0')}`;
    return { from: `${last}-01`, to: `${last}-31` };
  }
  if (kind === 'custom') return { from, to };
  return { from: '', to: '' };
}


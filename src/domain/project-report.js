/**
 * Money in and out of a project, from the bills, advances and expenses that
 * point at it. Used by the Projects screen and (later) the full report.
 *
 *   billed       total of the project's bills (estimates are not counted)
 *   paidOnBills  received on those bills (their own advance + payments)
 *   advances     advances received from the client under the project
 *   received     paidOnBills + advances
 *   receivable   billed − received (negative = the client has paid ahead)
 *   expenses     site expenses (food, travel…)
 *   cash         received − expenses (before labour)
 */
import { getBillTotals } from './calculations.js';
import { billsInScope } from './report-scope.js';
import { expensesByCategory, totalAmount } from './projects.js';
import { roundTo2 } from './formatters.js';

/** The quick figures on the Projects screen: bills billed so far (submitted and ready) unless `scope` says otherwise. */
export function projectSummary(project, { bills = [], advances = [], expenses = [], rates = [] }, { scope = 'ready' } = {}) {
  const projectBills = billsInScope(bills.filter((bill) => bill.projectId === project.id), scope);
  const totals = projectBills.map((bill) => getBillTotals(bill, rates));
  const sum = (field) => roundTo2(totals.reduce((total, item) => total + item[field], 0));
  const applied = sum('adjusted');
  const projectAdvances = advances.filter((advance) => advance.projectId === project.id);
  const projectExpenses = expenses.filter((expense) => expense.projectId === project.id);
  const billed = sum('total');
  const paidOnBills = sum('cashPaid'); // advance applied to bills is already in the project advances
  const advanceTotal = totalAmount(projectAdvances);
  const received = roundTo2(paidOnBills + advanceTotal);
  const expenseTotal = totalAmount(projectExpenses);
  return {
    billCount: projectBills.length,
    billed,
    paidOnBills,
    advances: advanceTotal,
    advanceApplied: applied,
    received,
    receivable: roundTo2(billed - received),
    expenses: expenseTotal,
    expensesByCategory: expensesByCategory(projectExpenses),
    cash: roundTo2(received - expenseTotal),
    agreed: Number(project.agreedAmount) || 0
  };
}

/** Projects grouped by client (by saved client id, otherwise by name), for per-client reports. */
export function projectsByClient(projects) {
  const groups = new Map();
  for (const project of projects) {
    const key = project.clientId || `name:${(project.client || '').trim().toLowerCase()}`;
    if (!groups.has(key)) groups.set(key, { key, client: project.client || '—', projects: [] });
    groups.get(key).projects.push(project);
  }
  return [...groups.values()];
}

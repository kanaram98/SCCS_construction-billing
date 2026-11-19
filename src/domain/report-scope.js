/**
 * Which bills a money report counts. Cancelled bills and estimates never count.
 *
 *   submitted  only closed bills: the settled books
 *   ready      submitted and ready bills: billed so far, including what is still waiting for payment
 *   all        everything, drafts (work in progress) too
 */
import { billStatus, isCounted } from './bill-guard.js';
import { isEstimate } from './bill-kinds.js';
import { getBillTotals } from './calculations.js';
import { roundTo2 } from './formatters.js';

export const REPORT_SCOPES = Object.freeze({
  submitted: 'Submitted bills only',
  ready: 'Submitted + Ready (pending)',
  all: 'All bills including drafts'
});

const STAGES = Object.freeze({
  submitted: ['submitted'],
  ready: ['submitted', 'ready'],
  all: ['submitted', 'ready', 'draft']
});

export const DEFAULT_REPORT_SCOPE = 'submitted';

/** The real bills (not estimates, not cancelled) that fall in `scope`. */
export function billsInScope(bills, scope = DEFAULT_REPORT_SCOPE) {
  const stages = STAGES[scope] || STAGES[DEFAULT_REPORT_SCOPE];
  return bills.filter((bill) => !isEstimate(bill) && isCounted(bill) && stages.includes(billStatus(bill)));
}

/** Count, billed total and balance of the bills at each stage, whatever the scope. */
export function stageBreakdown(bills, rates) {
  const result = { submitted: { count: 0, total: 0, balance: 0 }, ready: { count: 0, total: 0, balance: 0 }, draft: { count: 0, total: 0, balance: 0 } };
  for (const bill of bills.filter((entry) => !isEstimate(entry) && isCounted(entry))) {
    const totals = getBillTotals(bill, rates);
    const stage = result[billStatus(bill)];
    stage.count += 1;
    stage.total = roundTo2(stage.total + totals.total);
    stage.balance = roundTo2(stage.balance + totals.balance);
  }
  return result;
}

import { text } from './formatters.js';
import { billStatus, isCancelled } from './bill-guard.js';
import { isEstimate } from './bill-kinds.js';

export const EMPTY_BILL_FILTERS = Object.freeze({
  search: '',
  client: '',
  projectId: '',
  dateFrom: '',
  dateTo: '',
  payment: '',
  stage: ''
});

/** 'estimate' | 'cancelled' | 'draft' | 'ready' | 'submitted' */
export function billStage(bill) {
  if (isEstimate(bill)) return 'estimate';
  if (isCancelled(bill)) return 'cancelled';
  return billStatus(bill);
}

/**
 * Filters bills for the dashboard.
 * @param {(bill) => string} getStatus payment status lookup, so callers can reuse cached summaries
 */
export function filterBills(bills, filters, getStatus) {
  const query = filters.search.trim().toLowerCase();
  return bills.filter((bill) =>
    `${bill.number} ${bill.name || ''} ${bill.projectName} ${bill.client} ${bill.date} ${bill.quotationLabel || ''}`.toLowerCase().includes(query) &&
    (!filters.stage || billStage(bill) === filters.stage) &&
    (!filters.client || bill.client === filters.client) &&
    (!filters.projectId || bill.projectId === filters.projectId) &&
    (!filters.dateFrom || bill.date >= filters.dateFrom) &&
    (!filters.dateTo || bill.date <= filters.dateTo) &&
    (!filters.payment || getStatus(bill) === filters.payment));
}

/** Distinct, sorted client names used on bills. */
export function getBillClientNames(bills) {
  return [...new Set(bills.map((bill) => text(bill.client)).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right));
}

export const BILL_SORTS = Object.freeze({
  newest: 'Newest first',
  oldest: 'Oldest first',
  number: 'Bill number',
  amount: 'Highest amount',
  balance: 'Highest balance due'
});

const billNumber = (bill) => Number.parseInt(bill.number, 10) || 0;

/**
 * Sorts bills for the dashboard.
 * @param {(bill) => { totals: { total: number, balance: number } }} getSummary cached per-bill totals
 */
export function sortBills(bills, sort, getSummary) {
  const byDate = (left, right) => String(left.date).localeCompare(String(right.date)) || billNumber(left) - billNumber(right);
  const comparators = {
    newest: (left, right) => byDate(right, left),
    oldest: byDate,
    number: (left, right) => billNumber(left) - billNumber(right),
    amount: (left, right) => getSummary(right).totals.total - getSummary(left).totals.total,
    balance: (left, right) => getSummary(right).totals.balance - getSummary(left).totals.balance
  };
  return [...bills].sort(comparators[sort] || comparators.newest);
}

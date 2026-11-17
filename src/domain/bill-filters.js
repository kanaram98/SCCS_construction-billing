import { text } from './formatters.js';

export const EMPTY_BILL_FILTERS = Object.freeze({
  search: '',
  client: '',
  dateFrom: '',
  dateTo: '',
  payment: ''
});

export function hasActiveFilters(filters) {
  return Object.values(filters).some(Boolean);
}

/**
 * Filters bills for the dashboard.
 * @param {(bill) => string} getStatus payment status lookup, so callers can reuse cached summaries
 */
export function filterBills(bills, filters, getStatus) {
  const query = filters.search.trim().toLowerCase();
  return bills.filter((bill) =>
    `${bill.number} ${bill.projectName} ${bill.client} ${bill.date}`.toLowerCase().includes(query) &&
    (!filters.client || bill.client === filters.client) &&
    (!filters.dateFrom || bill.date >= filters.dateFrom) &&
    (!filters.dateTo || bill.date <= filters.dateTo) &&
    (!filters.payment || getStatus(bill) === filters.payment));
}

/** Distinct, sorted client names used on bills. */
export function getBillClientNames(bills) {
  return [...new Set(bills.map((bill) => text(bill.client)).filter(Boolean))]
    .sort((left, right) => left.localeCompare(right));
}

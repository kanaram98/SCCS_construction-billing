/**
 * Business summary for the Home screen. Only real bills count towards money
 * figures; estimates are reported separately.
 */
import { getBillTotals } from './calculations.js';
import { getPayments } from './payments.js';
import { isEstimate } from './bill-kinds.js';
import { text } from './formatters.js';

/** Bills with a balance this many days after the bill date are overdue. */
export const OVERDUE_DAYS = 30;
const DAY_MS = 24 * 60 * 60 * 1000;

const monthKey = (date) => String(date || '').slice(0, 7);

/**
 * @param {object[]} bills all bills and estimates
 * @param {object[]} rates
 * @param {Date} [now]
 */
export function getDashboardSummary(bills, rates, now = new Date()) {
  const today = now.toISOString().slice(0, 10);
  const thisMonth = today.slice(0, 7);
  const real = bills.filter((bill) => !isEstimate(bill)).map((bill) => ({ bill, totals: getBillTotals(bill, rates) }));
  const estimates = bills.filter(isEstimate).map((bill) => ({ bill, totals: getBillTotals(bill, rates) }));
  const sum = (list, pick) => list.reduce((total, entry) => total + pick(entry), 0);

  // Money received this month: dated payments, plus advances on bills dated this month.
  const receivedThisMonth = real.reduce((total, { bill, totals }) =>
    total +
    getPayments(bill).filter((payment) => monthKey(payment.date) === thisMonth).reduce((s, payment) => s + (Number(payment.amount) || 0), 0) +
    (monthKey(bill.date) === thisMonth ? totals.advance : 0), 0);

  const withBalance = real.filter(({ totals }) => totals.balance > 0);
  const ageInDays = (bill) => Math.floor((Date.parse(today) - Date.parse(bill.date)) / DAY_MS);
  const overdue = withBalance
    .filter(({ bill }) => Number.isFinite(ageInDays(bill)) && ageInDays(bill) > OVERDUE_DAYS)
    .map(({ bill, totals }) => ({ bill, balance: totals.balance, days: ageInDays(bill) }))
    .sort((left, right) => right.balance - left.balance);

  const clientDues = new Map();
  withBalance.forEach(({ bill, totals }) => {
    const name = text(bill.client) || '—';
    const entry = clientDues.get(name) || { client: name, balance: 0, bills: 0, phone: bill.clientPhone };
    entry.balance += totals.balance;
    entry.bills += 1;
    clientDues.set(name, entry);
  });

  const openEstimates = estimates.filter(({ bill }) => !bill.convertedBillId);

  return {
    billCount: real.length,
    totalBilled: sum(real, ({ totals }) => totals.total),
    totalReceived: sum(real, ({ totals }) => Math.min(totals.paid, totals.total)),
    outstanding: sum(withBalance, ({ totals }) => totals.balance),
    billedThisMonth: sum(real.filter(({ bill }) => monthKey(bill.date) === thisMonth), ({ totals }) => totals.total),
    receivedThisMonth,
    unpaidCount: real.filter(({ totals }) => totals.total > 0 && totals.paid <= 0).length,
    partialCount: real.filter(({ totals }) => totals.paid > 0 && totals.balance > 0).length,
    paidCount: real.filter(({ totals }) => totals.total > 0 && totals.balance <= 0).length,
    openEstimateCount: openEstimates.length,
    openEstimateValue: sum(openEstimates, ({ totals }) => totals.total),
    overdue,
    topClients: [...clientDues.values()].sort((left, right) => right.balance - left.balance).slice(0, 5),
    recent: [...bills].sort((left, right) => String(right.date).localeCompare(String(left.date))).slice(0, 5)
  };
}

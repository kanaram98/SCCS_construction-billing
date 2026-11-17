/**
 * Labour: workers, daily attendance and wages.
 *
 * Attendance is counted in "P" (presence) units, the way contractors write it
 * in a muster register: A = absent, 0.5P = half day, 1P = full day,
 * 1.5P = day and a half, 2P = double. Each mark saves the worker's daily wage
 * at that time, so changing a wage later does not rewrite past months.
 *
 * Shape:
 *   labour = {
 *     workers:    [{ id, name, phone, role, dailyWage, active }],
 *     attendance: { 'YYYY-MM-DD': { [workerId]: { units, wage } } },
 *     payments:   [{ id, workerId, date, amount, mode, note }]   // advances and wage payments
 *   }
 */
import { newId } from './ids.js';
import { formatCurrency, roundTo2, text } from './formatters.js';
import { tr } from '../i18n/translate.js';
import { PAYMENT_MODES } from './payments.js';

/** Labour is usually paid in cash. */
export const DEFAULT_LABOUR_PAYMENT_MODE = 'cash';

/** Attendance choices shown as buttons. */
export const ATTENDANCE_UNITS = Object.freeze([0, 0.5, 1, 1.5, 2]);
export const MAX_UNITS = 3;

export function createLabourState() {
  return { workers: [], attendance: {}, payments: [] };
}

export function createWorker(values = {}) {
  return { id: newId(), name: '', phone: '', role: '', dailyWage: '', active: true, ...values };
}

const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

/** Fills in missing parts of saved labour data and drops anything malformed. */
export function normalizeLabour(saved) {
  if (!isObject(saved)) return createLabourState();
  const attendance = {};
  if (isObject(saved.attendance)) {
    for (const [date, marks] of Object.entries(saved.attendance)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !isObject(marks)) continue;
      const day = {};
      for (const [workerId, mark] of Object.entries(marks)) {
        const units = Number(mark?.units);
        if (Number.isFinite(units) && units >= 0) day[workerId] = { units, wage: Number(mark.wage) || 0 };
      }
      if (Object.keys(day).length) attendance[date] = day;
    }
  }
  return {
    workers: Array.isArray(saved.workers) ? saved.workers.filter((worker) => worker?.id).map((worker) => createWorker(worker)) : [],
    attendance,
    payments: Array.isArray(saved.payments)
      ? saved.payments.filter((payment) => payment?.id && payment.workerId).map((payment) => ({ ...payment, mode: PAYMENT_MODES[payment.mode] ? payment.mode : DEFAULT_LABOUR_PAYMENT_MODE, note: payment.note || '' }))
      : []
  };
}

/** "A", "0.5P", "1P", "1.5P", "2P". */
export function formatUnits(units) {
  const value = Number(units) || 0;
  return value === 0 ? 'A' : `${roundTo2(value)}P`;
}

/** Short mark for screens: "A", "½P", "1P", "1½P", "2P". */
export function markLabel(units) {
  const value = Number(units) || 0;
  if (value === 0) return 'A';
  const whole = Math.floor(value);
  return value - whole === 0.5 ? `${whole || ''}½P` : `${roundTo2(value)}P`;
}

/** Register cell: "" (not marked), "A", "1", "1.5", "2". */
export function registerCell(mark) {
  if (!mark) return '';
  return mark.units === 0 ? 'A' : String(roundTo2(mark.units));
}

/**
 * Reads what a contractor types: "2P", "1.5p", "½", "0.5", "A".
 * Returns units, or null when it can't be understood.
 */
export function parseUnits(input) {
  const value = text(input).toUpperCase().replace('½', '.5').replace(/P$/, '').trim();
  if (value === 'A' || value === '') return value === 'A' ? 0 : null;
  const units = Number(value.startsWith('.') ? `0${value}` : value);
  if (!Number.isFinite(units) || units < 0 || units > MAX_UNITS) return null;
  return Math.round(units * 2) / 2;
}

export function getWorkerErrors(values) {
  const wage = Number(values.dailyWage);
  return {
    name: text(values.name) ? '' : tr('Enter the worker’s name.'),
    dailyWage: text(values.dailyWage) === '' ? tr('Enter the daily wage.') : (!Number.isFinite(wage) || wage < 0 ? tr('Enter a valid amount.') : '')
  };
}

// ── Dates ─────────────────────────────────────────────────────────────

const pad = (value) => String(value).padStart(2, '0');

/** Today's date on this phone (not UTC), as YYYY-MM-DD. */
export function localToday(now = new Date()) {
  return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
}

export function shiftDate(isoDate, days) {
  const [year, month, day] = isoDate.split('-').map(Number);
  const date = new Date(year, month - 1, day + days);
  return localToday(date);
}

/** "2026-11" for a date. */
export const monthOf = (isoDate) => isoDate.slice(0, 7);

export function shiftMonth(month, delta) {
  const [year, value] = month.split('-').map(Number);
  const date = new Date(year, value - 1 + delta, 1);
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}

/** Every date of a month, e.g. ['2026-11-01', … '2026-11-30']. */
export function daysOfMonth(month) {
  const [year, value] = month.split('-').map(Number);
  const count = new Date(year, value, 0).getDate();
  return Array.from({ length: count }, (_unused, index) => `${month}-${pad(index + 1)}`);
}

/** The month as calendar weeks (Sunday first), with null for blank cells. */
export function calendarWeeks(month) {
  const cells = [...Array(firstWeekday(month)).fill(null), ...daysOfMonth(month)];
  while (cells.length % 7) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_unused, index) => cells.slice(index * 7, index * 7 + 7));
}

/** Weekday of the 1st of a month (0 = Sunday), for laying out a calendar. */
export function firstWeekday(month) {
  const [year, value] = month.split('-').map(Number);
  return new Date(year, value - 1, 1).getDay();
}

/** Short weekday names starting Sunday, e.g. ['S', 'M', …] / ['र', 'सो', …]. */
export function weekdayNames(language = 'en') {
  return Array.from({ length: 7 }, (_unused, index) => new Date(2023, 0, 1 + index)
    .toLocaleDateString(language === 'hi' ? 'hi-IN' : 'en-IN', { weekday: 'narrow' }));
}

/** "Tue, 17 Nov" / "मंगल, 17 नव॰". */
export function dayLabel(isoDate, language = 'en') {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(year, month - 1, day).toLocaleDateString(language === 'hi' ? 'hi-IN' : 'en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
}

// ── Attendance ────────────────────────────────────────────────────────

/** Returns attendance with one worker's mark for a day set (or cleared with `units === null`). */
export function setMark(attendance, date, worker, units) {
  const day = { ...(attendance[date] || {}) };
  if (units === null || units === undefined) delete day[worker.id];
  else day[worker.id] = { units, wage: Number(worker.dailyWage) || 0 };
  const next = { ...attendance };
  if (Object.keys(day).length) next[date] = day;
  else delete next[date];
  return next;
}

/** Totals for one day: workers present, P units and wage cost. */
export function daySummary(labour, date) {
  const marks = Object.values(labour.attendance[date] || {});
  return {
    present: marks.filter((mark) => mark.units > 0).length,
    marked: marks.length,
    units: roundTo2(marks.reduce((sum, mark) => sum + mark.units, 0)),
    cost: roundTo2(marks.reduce((sum, mark) => sum + mark.units * mark.wage, 0))
  };
}

const inMonth = (date, month) => date.startsWith(`${month}-`);
const before = (date, month) => date < `${month}-01`;

function earnedWhere(labour, workerId, test) {
  let units = 0;
  let earned = 0;
  let days = 0;
  for (const [date, marks] of Object.entries(labour.attendance)) {
    const mark = marks[workerId];
    if (!mark || !test(date)) continue;
    units += mark.units;
    earned += mark.units * mark.wage;
    if (mark.units > 0) days += 1;
  }
  return { units: roundTo2(units), earned: roundTo2(earned), days };
}

const paidWhere = (labour, workerId, test) => roundTo2(labour.payments
  .filter((payment) => payment.workerId === workerId && test(payment.date))
  .reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0));

/**
 * One worker's month: attendance, wages earned, money paid, and the balance
 * carried in from earlier months. A negative balance means the worker was
 * paid in advance and owes work or money.
 */
export function workerMonth(labour, workerId, month) {
  const current = earnedWhere(labour, workerId, (date) => inMonth(date, month));
  const opening = roundTo2(earnedWhere(labour, workerId, (date) => before(date, month)).earned - paidWhere(labour, workerId, (date) => before(date, month)));
  const paid = paidWhere(labour, workerId, (date) => inMonth(date, month));
  const counts = countMarks(Object.entries(labour.attendance)
    .filter(([date, marks]) => inMonth(date, month) && marks[workerId])
    .map(([, marks]) => marks[workerId].units));
  const absent = counts[0] || 0;
  return {
    workerId,
    month,
    days: current.days,
    absent,
    counts,
    units: current.units,
    earned: current.earned,
    opening,
    paid,
    balance: roundTo2(opening + current.earned - paid),
    marks: daysOfMonth(month).map((date) => labour.attendance[date]?.[workerId] ?? null),
    payments: labour.payments.filter((payment) => payment.workerId === workerId && inMonth(payment.date, month))
      .sort((a, b) => a.date.localeCompare(b.date))
  };
}

/** How many times each mark was given, keyed by units: { 0: 2, 1: 20, 2: 3 } (A ×2, 1P ×20, 2P ×3). */
export function countMarks(unitsList) {
  const counts = {};
  unitsList.forEach((units) => { counts[units] = (counts[units] || 0) + 1; });
  return counts;
}

/** Marks to list in a count summary: the standard ones, plus any unusual value that was used. */
export function countedUnits(counts) {
  const extra = Object.keys(counts).map(Number).filter((units) => !ATTENDANCE_UNITS.includes(units)).sort((a, b) => a - b);
  return [...ATTENDANCE_UNITS, ...extra];
}

/** Every advance / payment made in a month, oldest first, with the worker's name. */
export function monthPayments(labour, month) {
  const names = new Map(labour.workers.map((worker) => [worker.id, worker.name]));
  return labour.payments
    .filter((payment) => inMonth(payment.date, month))
    .map((payment) => ({ ...payment, workerName: names.get(payment.workerId) || '' }))
    .sort((a, b) => a.date.localeCompare(b.date) || a.workerName.localeCompare(b.workerName));
}

/** Workers to show in a month: active ones plus anyone with attendance or payments that month. */
export function workersForMonth(labour, month) {
  return labour.workers.filter((worker) => worker.active ||
    Object.entries(labour.attendance).some(([date, marks]) => inMonth(date, month) && marks[worker.id]) ||
    labour.payments.some((payment) => payment.workerId === worker.id && inMonth(payment.date, month)));
}

/** Month report for every relevant worker, plus totals. */
export function monthReport(labour, month) {
  const rows = workersForMonth(labour, month).map((worker) => ({ worker, ...workerMonth(labour, worker.id, month) }));
  const sum = (field) => roundTo2(rows.reduce((total, row) => total + row[field], 0));
  const counts = {};
  rows.forEach((row) => Object.entries(row.counts).forEach(([units, count]) => { counts[units] = (counts[units] || 0) + count; }));
  return { month, rows, payments: monthPayments(labour, month), totals: { units: sum('units'), earned: sum('earned'), paid: sum('paid'), balance: sum('balance'), days: sum('days'), counts } };
}

/** What each worker is owed today, across all months. */
export function workerBalance(labour, workerId) {
  return roundTo2(earnedWhere(labour, workerId, () => true).earned - paidWhere(labour, workerId, () => true));
}

/** Removes a worker and everything recorded for them. */
export function removeWorker(labour, workerId) {
  const attendance = {};
  for (const [date, marks] of Object.entries(labour.attendance)) {
    const { [workerId]: _removed, ...rest } = marks;
    if (Object.keys(rest).length) attendance[date] = rest;
  }
  return {
    workers: labour.workers.filter((worker) => worker.id !== workerId),
    attendance,
    payments: labour.payments.filter((payment) => payment.workerId !== workerId)
  };
}

/** Month name for display, e.g. "November 2026" / "नवंबर 2026". */
export function monthLabel(month, language = 'en') {
  const [year, value] = month.split('-').map(Number);
  return new Date(year, value - 1, 1).toLocaleDateString(language === 'hi' ? 'hi-IN' : 'en-IN', { month: 'long', year: 'numeric' });
}

/** WhatsApp text with a worker's month summary. */
export function workerMonthMessage({ worker, summary, firm, t, language }) {
  const payments = (summary.payments || []).map((payment) => `• ${payment.date} · ${formatCurrency(payment.amount)} · ${t(PAYMENT_MODES[payment.mode] || 'Cash')}${payment.note ? ` · ${payment.note}` : ''}`);
  return [
    `${worker.name} · ${monthLabel(summary.month, language)}`,
    t('Attendance: {units} ({days} days)', { units: formatUnits(summary.units), days: summary.days }),
    countedUnits(summary.counts || {}).filter((units) => summary.counts[units]).map((units) => `${markLabel(units)} × ${summary.counts[units]}`).join(', '),
    t('Wages: {amount}', { amount: formatCurrency(summary.earned) }),
    summary.opening !== 0 && t('Previous balance: {amount}', { amount: formatCurrency(summary.opening) }),
    t('Paid / advance: {amount}', { amount: formatCurrency(summary.paid) }),
    ...payments,
    t('Balance: {amount}', { amount: formatCurrency(summary.balance) }),
    firm?.name && `— ${firm.name}`
  ].filter(Boolean).join('\n');
}

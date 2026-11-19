/**
 * Labour: workers, daily attendance and wages.
 *
 * Attendance is counted in "P" (presence) units, the way contractors write it
 * in a muster register: A = absent, 0.5P = half day, 1P = full day,
 * 1.5P = day and a half, 2P = double. Each mark saves the worker's daily wage
 * at that time, so changing a wage later does not rewrite past months.
 *
 * Shape (records carry createdAt / updatedAt / deletedAt / version so they can
 * be synced to a server later):
 *   labour = {
 *     workers:      [{ id, name, phone, role, dailyWage, active, ...meta }],
 *     attendance:   { 'YYYY-MM-DD': { [workerId]: { units, wage, at } } },
 *     payments:     [{ id, workerId, date, amount, mode, note, ...meta }],  // advances and wage payments
 *     closedMonths: { 'YYYY-MM': { closedAt } },                            // locked after wages are paid
 *     log:          [{ id, at, entity, action, … }]                        // append-only activity log
 *   }
 * Deleting only sets deletedAt (recycle bin); screens read `liveLabour(labour)`.
 * All changes go through labour-ops.js, which also writes the activity log.
 */
import { newId } from './ids.js';
import { formatCurrency, roundTo2, text } from './formatters.js';
import { tr } from '../i18n/translate.js';
import { PAYMENT_MODES } from './payments.js';

/** Labour is usually paid in cash. */
export const DEFAULT_LABOUR_PAYMENT_MODE = 'cash';

/** Attendance choices shown as buttons. */
export const ATTENDANCE_UNITS = Object.freeze([0, 0.5, 1, 1.5, 2]);

/** Deleted workers and payments can be restored for this many days. */
export const RECYCLE_DAYS = 30;
/** The activity log keeps this many days (and at most LOG_MAX entries) on the phone. */
export const LOG_DAYS = 180;
export const LOG_MAX = 5000;
const DAY_MS = 24 * 60 * 60 * 1000;

export function createLabourState() {
  return { workers: [], attendance: {}, payments: [], closedMonths: {}, log: [] };
}

/** Sync metadata for a new record. */
export function recordMeta(now = new Date()) {
  const at = now.toISOString();
  return { createdAt: at, updatedAt: at, deletedAt: null, version: 1 };
}

export function createWorker(values = {}, now = new Date()) {
  return { id: newId(), name: '', phone: '', role: '', dailyWage: '', active: true, joinedOn: localToday(now), leftOn: '', projectIds: [], ...recordMeta(now), ...values };
}

/** Fills in sync metadata on records saved before it existed. */
const withMeta = (record) => ({
  ...record,
  createdAt: record.createdAt || '',
  updatedAt: record.updatedAt || record.createdAt || '',
  deletedAt: record.deletedAt || null,
  version: Number(record.version) || 1
});

const isObject = (value) => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

/**
 * Fills in missing parts of saved labour data, drops anything malformed,
 * empties the recycle bin of items older than RECYCLE_DAYS and trims the log.
 */
export function normalizeLabour(saved, now = new Date()) {
  if (!isObject(saved)) return createLabourState();
  const attendance = {};
  if (isObject(saved.attendance)) {
    for (const [date, marks] of Object.entries(saved.attendance)) {
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !isObject(marks)) continue;
      const day = {};
      for (const [workerId, mark] of Object.entries(marks)) {
        const units = Number(mark?.units);
        if (Number.isFinite(units) && units >= 0) day[workerId] = { units, wage: Number(mark.wage) || 0, at: mark.at || '' };
      }
      if (Object.keys(day).length) attendance[date] = day;
    }
  }
  const labour = {
    workers: Array.isArray(saved.workers)
      ? saved.workers.filter((worker) => worker?.id).map((worker) => withMeta({ name: '', phone: '', role: '', dailyWage: '', active: true, joinedOn: '', leftOn: '', ...worker, projectIds: Array.isArray(worker.projectIds) ? worker.projectIds.filter((id) => typeof id === 'string' && id) : [] }))
      : [],
    attendance,
    payments: Array.isArray(saved.payments)
      ? saved.payments.filter((payment) => payment?.id && payment.workerId).map((payment) => withMeta({ ...payment, mode: PAYMENT_MODES[payment.mode] ? payment.mode : DEFAULT_LABOUR_PAYMENT_MODE, note: payment.note || '' }))
      : [],
    closedMonths: isObject(saved.closedMonths)
      ? Object.fromEntries(Object.entries(saved.closedMonths).filter(([month, value]) => /^\d{4}-\d{2}$/.test(month) && isObject(value)))
      : {},
    log: Array.isArray(saved.log) ? saved.log.filter((entry) => entry?.id && entry.at && entry.entity) : []
  };
  return { ...emptyExpiredBin(labour, now), log: pruneLog(labour.log, now) };
}

const expired = (record, now) => Boolean(record.deletedAt) && now - Date.parse(record.deletedAt) > RECYCLE_DAYS * DAY_MS;

/** Permanently removes workers and payments deleted more than RECYCLE_DAYS ago. */
export function emptyExpiredBin(labour, now = new Date()) {
  const gone = labour.workers.filter((worker) => expired(worker, now)).map((worker) => worker.id);
  const purged = gone.reduce(purgeWorker, labour);
  return { ...purged, payments: purged.payments.filter((payment) => !expired(payment, now)) };
}

/** Keeps the last LOG_DAYS days of activity, at most LOG_MAX entries. */
export function pruneLog(log, now = new Date()) {
  const since = now - LOG_DAYS * DAY_MS;
  return log.filter((entry) => Date.parse(entry.at) >= since).slice(-LOG_MAX);
}

/**
 * What the screens and documents show: deleted workers and payments (and the
 * deleted workers' attendance) left out.
 */
export function liveLabour(labour) {
  // Only the attendance and payments of workers who exist and are not deleted count: a mark left behind by a
  // worker who was deleted forever (for instance one in a month that was locked at the time) is not shown.
  const alive = new Set(labour.workers.filter((worker) => !worker.deletedAt).map((worker) => worker.id));
  const attendance = {};
  for (const [date, marks] of Object.entries(labour.attendance)) {
    const kept = Object.fromEntries(Object.entries(marks).filter(([workerId]) => alive.has(workerId)));
    if (Object.keys(kept).length) attendance[date] = kept;
  }
  return {
    ...labour,
    workers: labour.workers.filter((worker) => !worker.deletedAt),
    attendance,
    payments: labour.payments.filter((payment) => !payment.deletedAt && alive.has(payment.workerId))
  };
}

/** Whether a month has been closed (its attendance and payments are locked). */
export const isMonthClosed = (labour, month) => Boolean(labour.closedMonths?.[month]);
export const isDateClosed = (labour, date) => Boolean(date) && isMonthClosed(labour, date.slice(0, 7));

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

/** `requireProject`: a new worker must belong to at least one project (older workers without one can still be edited). */
export function getWorkerErrors(values, { requireProject = false } = {}) {
  const wage = Number(values.dailyWage);
  return {
    name: text(values.name) ? '' : tr('Enter the worker’s name.'),
    dailyWage: text(values.dailyWage) === '' ? tr('Enter the daily wage.') : (!Number.isFinite(wage) || wage < 0 ? tr('Enter a valid amount.') : ''),
    projectIds: requireProject && !(values.projectIds || []).length ? tr('Choose the project this worker works on.') : ''
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

/** Returns attendance with a worker's mark for a day replaced by `mark` (or removed when null). */
export function putMark(attendance, date, workerId, mark) {
  const day = { ...(attendance[date] || {}) };
  if (!mark) delete day[workerId];
  else day[workerId] = mark;
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

/** Whether a worker has any attendance or payments (so deleting them would lose history). */
export function workerHasRecords(labour, workerId) {
  return Object.values(labour.attendance).some((marks) => marks[workerId]) ||
    labour.payments.some((payment) => payment.workerId === workerId && !payment.deletedAt);
}

/** Permanently removes a worker and everything recorded for them. */
export function purgeWorker(labour, workerId) {
  const attendance = {};
  for (const [date, marks] of Object.entries(labour.attendance)) {
    const { [workerId]: _removed, ...rest } = marks;
    if (Object.keys(rest).length) attendance[date] = rest;
  }
  return {
    ...labour,
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

/**
 * Attendance seen for one project (site) only: its marks, plus older marks that were saved with
 * no project (so nothing disappears). Marks of other projects are left out.
 * With no `siteId` the labour is returned unchanged.
 */
export function labourForSite(labour, siteId) {
  if (!siteId) return labour;
  const attendance = {};
  for (const [date, marks] of Object.entries(labour.attendance || {})) {
    const kept = Object.fromEntries(Object.entries(marks).filter(([, mark]) => !mark.projectId || mark.projectId === siteId));
    if (Object.keys(kept).length) attendance[date] = kept;
  }
  return { ...labour, attendance };
}

/**
 * Whether a worker belongs on a project's sheet: they are assigned to it, or have already been marked there.
 * A worker assigned to no project yet shows only in the Workers tab, under "not on any project", until assigned.
 */
export function workerOnSite(labour, worker, siteId) {
  if (!siteId) return true;
  const assigned = worker.projectIds || [];
  if (assigned.includes(siteId)) return true;
  return Object.values(labour.attendance || {}).some((marks) => marks[worker.id]?.projectId === siteId);
}

/** Workers not assigned to any project yet. */
export const unassignedWorkers = (labour) => labour.workers.filter((worker) => worker.active && !(worker.projectIds || []).length);

/** The labour data of one project: its workers, their marks at it, and their payments. */
export function labourOfSite(labour, siteId) {
  if (!siteId) return labour;
  const workers = labour.workers.filter((worker) => workerOnSite(labour, worker, siteId));
  const ids = new Set(workers.map((worker) => worker.id));
  const attendance = {};
  for (const [date, marks] of Object.entries(labourForSite(labour, siteId).attendance)) {
    const kept = Object.fromEntries(Object.entries(marks).filter(([workerId]) => ids.has(workerId)));
    if (Object.keys(kept).length) attendance[date] = kept;
  }
  return { ...labour, workers, attendance, payments: labour.payments.filter((payment) => ids.has(payment.workerId)) };
}

/** Wages earned on a project: the attendance marked at it, at the wage each was marked with. */
export function labourCostOfProject(labour, projectId) {
  let cost = 0;
  for (const marks of Object.values(labour?.attendance || {})) {
    for (const mark of Object.values(marks)) if (mark.projectId === projectId) cost += mark.units * mark.wage;
  }
  return roundTo2(cost);
}

/** Wages for everyone marked on one day, across all projects. */
export const labourCostOfDay = (labour, date) => daySummary(labour || { attendance: {} }, date).cost;

/** The project a worker is already marked at on `date`, when it is not `siteId` ('' when free to mark). */
export function markedElsewhere(labour, date, workerId, siteId) {
  const mark = labour.attendance?.[date]?.[workerId];
  return siteId && mark?.projectId && mark.projectId !== siteId ? mark.projectId : '';
}

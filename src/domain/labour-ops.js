/**
 * Every change to labour data, as pure functions `(labour, …, now) → labour`.
 *
 * Each change is checked against closed months, stamps the record's
 * updatedAt / version, and appends an entry to the activity log, so mistakes
 * can be seen and reverted. Nothing is removed outright: deleting sets
 * deletedAt (recycle bin) until the user empties it or RECYCLE_DAYS pass.
 *
 * Log entries are plain data, ready to send to a server later:
 *   { id, at, entity: 'attendance'|'payment'|'worker'|'month',
 *     action: 'create'|'update'|'delete'|'restore'|'purge'|'close'|'unlock',
 *     refId?, workerId?, date?, month?, before?, after?, changes?, revertOf? }
 */
import { newId } from './ids.js';
import { isDateClosed, isMonthClosed, purgeWorker, putMark, recordMeta } from './labour.js';

const WORKER_FIELDS = ['name', 'phone', 'role', 'dailyWage', 'active'];
const PAYMENT_FIELDS = ['workerId', 'date', 'amount', 'mode', 'note'];

const pick = (record, fields) => Object.fromEntries(fields.map((field) => [field, record[field]]));
const sameMark = (a, b) => (!a && !b) || (a && b && a.units === b.units && a.wage === b.wage);

function addLog(labour, entry, now) {
  return { ...labour, log: [...(labour.log || []), { id: newId(), at: now.toISOString(), ...entry }] };
}

/** Bumps a record's version and updatedAt. */
const touch = (record, patch, now) => ({ ...record, ...patch, updatedAt: now.toISOString(), version: (Number(record.version) || 1) + 1 });

// ── Attendance ────────────────────────────────────────────────────────

/**
 * Sets attendance for one day: `changes` is [{ worker, units }] with units
 * null to clear. Logged as one entry. Ignored when the month is closed.
 */
export function markAttendance(labour, date, changes, now = new Date(), extra = {}) {
  if (isDateClosed(labour, date)) return labour;
  return applyMarks(labour, date, changes.map(({ worker, units }) => ({
    workerId: worker.id,
    mark: units === null || units === undefined ? null : { units, wage: Number(worker.dailyWage) || 0, at: now.toISOString() }
  })), now, extra);
}

function applyMarks(labour, date, marks, now, extra) {
  let attendance = labour.attendance;
  const changes = [];
  for (const { workerId, mark } of marks) {
    const before = attendance[date]?.[workerId] ?? null;
    if (sameMark(before, mark)) continue;
    attendance = putMark(attendance, date, workerId, mark);
    changes.push({ workerId, before, after: mark });
  }
  if (!changes.length) return labour;
  return addLog({ ...labour, attendance }, { entity: 'attendance', action: 'update', date, changes, ...extra }, now);
}

// ── Workers ───────────────────────────────────────────────────────────

export function addWorker(labour, worker, now = new Date()) {
  return addLog({ ...labour, workers: [...labour.workers, worker] },
    { entity: 'worker', action: 'create', refId: worker.id, workerId: worker.id, after: pick(worker, WORKER_FIELDS) }, now);
}

export function updateWorker(labour, workerId, patch, now = new Date(), extra = {}) {
  const worker = labour.workers.find((entry) => entry.id === workerId);
  if (!worker) return labour;
  const before = pick(worker, WORKER_FIELDS);
  const after = { ...before, ...pick({ ...worker, ...patch }, WORKER_FIELDS) };
  if (WORKER_FIELDS.every((field) => before[field] === after[field])) return labour;
  return addLog({ ...labour, workers: labour.workers.map((entry) => entry.id === workerId ? touch(entry, patch, now) : entry) },
    { entity: 'worker', action: 'update', refId: workerId, workerId, before, after, ...extra }, now);
}

/** Moves a worker (with their attendance and payments) to the recycle bin. */
export function deleteWorker(labour, workerId, now = new Date(), extra = {}) {
  return setWorkerDeleted(labour, workerId, now.toISOString(), now, 'delete', extra);
}

export function restoreWorker(labour, workerId, now = new Date(), extra = {}) {
  return setWorkerDeleted(labour, workerId, null, now, 'restore', extra);
}

function setWorkerDeleted(labour, workerId, deletedAt, now, action, extra) {
  const worker = labour.workers.find((entry) => entry.id === workerId);
  if (!worker || Boolean(worker.deletedAt) === Boolean(deletedAt)) return labour;
  return addLog({ ...labour, workers: labour.workers.map((entry) => entry.id === workerId ? touch(entry, { deletedAt }, now) : entry) },
    { entity: 'worker', action, refId: workerId, workerId, before: pick(worker, WORKER_FIELDS), ...extra }, now);
}

/** Permanently removes a deleted worker and their records (from the recycle bin). */
export function purgeDeletedWorker(labour, workerId, now = new Date()) {
  const worker = labour.workers.find((entry) => entry.id === workerId);
  if (!worker?.deletedAt) return labour;
  return addLog(purgeWorker(labour, workerId), { entity: 'worker', action: 'purge', refId: workerId, workerId, before: pick(worker, WORKER_FIELDS) }, now);
}

// ── Payments ──────────────────────────────────────────────────────────

const paymentValues = (values) => ({ ...values, amount: Number(values.amount) || 0, note: values.note || '' });

/** Adds an advance / payment. Ignored when its date is in a closed month. */
export function addPayment(labour, values, now = new Date()) {
  const payment = { id: newId(), mode: 'cash', ...paymentValues(values), ...recordMeta(now) };
  if (isDateClosed(labour, payment.date)) return labour;
  return addLog({ ...labour, payments: [...labour.payments, payment] },
    { entity: 'payment', action: 'create', refId: payment.id, workerId: payment.workerId, date: payment.date, after: pick(payment, PAYMENT_FIELDS) }, now);
}

export function updatePayment(labour, paymentId, values, now = new Date(), extra = {}) {
  const payment = labour.payments.find((entry) => entry.id === paymentId);
  if (!payment || payment.deletedAt) return labour;
  const next = { ...payment, ...paymentValues(values) };
  if (isDateClosed(labour, payment.date) || isDateClosed(labour, next.date)) return labour;
  const before = pick(payment, PAYMENT_FIELDS);
  const after = pick(next, PAYMENT_FIELDS);
  if (PAYMENT_FIELDS.every((field) => before[field] === after[field])) return labour;
  return addLog({ ...labour, payments: labour.payments.map((entry) => entry.id === paymentId ? touch(entry, after, now) : entry) },
    { entity: 'payment', action: 'update', refId: paymentId, workerId: payment.workerId, date: next.date, before, after, ...extra }, now);
}

/** Moves a payment to the recycle bin. */
export function deletePayment(labour, paymentId, now = new Date(), extra = {}) {
  return setPaymentDeleted(labour, paymentId, now.toISOString(), now, 'delete', extra);
}

export function restorePayment(labour, paymentId, now = new Date(), extra = {}) {
  return setPaymentDeleted(labour, paymentId, null, now, 'restore', extra);
}

function setPaymentDeleted(labour, paymentId, deletedAt, now, action, extra) {
  const payment = labour.payments.find((entry) => entry.id === paymentId);
  if (!payment || Boolean(payment.deletedAt) === Boolean(deletedAt) || isDateClosed(labour, payment.date)) return labour;
  return addLog({ ...labour, payments: labour.payments.map((entry) => entry.id === paymentId ? touch(entry, { deletedAt }, now) : entry) },
    { entity: 'payment', action, refId: paymentId, workerId: payment.workerId, date: payment.date, before: pick(payment, PAYMENT_FIELDS), ...extra }, now);
}

/** Permanently removes a deleted payment (from the recycle bin). */
export function purgeDeletedPayment(labour, paymentId, now = new Date()) {
  const payment = labour.payments.find((entry) => entry.id === paymentId);
  if (!payment?.deletedAt) return labour;
  return addLog({ ...labour, payments: labour.payments.filter((entry) => entry.id !== paymentId) },
    { entity: 'payment', action: 'purge', refId: paymentId, workerId: payment.workerId, date: payment.date, before: pick(payment, PAYMENT_FIELDS) }, now);
}

// ── Months ────────────────────────────────────────────────────────────

/** Closes a month after wages are settled: its attendance and payments can no longer change. */
export function closeMonth(labour, month, now = new Date()) {
  if (isMonthClosed(labour, month)) return labour;
  return addLog({ ...labour, closedMonths: { ...labour.closedMonths, [month]: { closedAt: now.toISOString() } } },
    { entity: 'month', action: 'close', month }, now);
}

export function unlockMonth(labour, month, now = new Date()) {
  if (!isMonthClosed(labour, month)) return labour;
  const { [month]: _removed, ...closedMonths } = labour.closedMonths;
  return addLog({ ...labour, closedMonths }, { entity: 'month', action: 'unlock', month }, now);
}

// ── Reverting a logged change ─────────────────────────────────────────

/**
 * Why a log entry can't be reverted, or '' when it can:
 * 'reverted' | 'closed' | 'missing' | 'final' (purges and month changes).
 */
export function revertBlocker(labour, entry) {
  if (entry.action === 'purge' || entry.entity === 'month') return 'final';
  if ((labour.log || []).some((other) => other.revertOf === entry.id)) return 'reverted';
  if (entry.entity === 'attendance' && isDateClosed(labour, entry.date)) return 'closed';
  if (entry.entity === 'payment') {
    const payment = labour.payments.find((item) => item.id === entry.refId);
    if (!payment) return 'missing';
    if (isDateClosed(labour, payment.date) || (entry.before && isDateClosed(labour, entry.before.date))) return 'closed';
  }
  if (entry.entity === 'worker' && !labour.workers.some((item) => item.id === entry.refId)) return 'missing';
  return '';
}

/** Undoes one logged change (logged as a new entry with `revertOf`). */
export function revertEntry(labour, entryId, now = new Date()) {
  const entry = (labour.log || []).find((item) => item.id === entryId);
  if (!entry || revertBlocker(labour, entry)) return labour;
  const extra = { revertOf: entry.id };
  if (entry.entity === 'attendance') {
    return applyMarks(labour, entry.date, entry.changes.map(({ workerId, before }) => ({ workerId, mark: before })), now, extra);
  }
  if (entry.entity === 'payment') {
    if (entry.action === 'create' || entry.action === 'restore') return deletePayment(labour, entry.refId, now, extra);
    if (entry.action === 'delete') return restorePayment(labour, entry.refId, now, extra);
    if (entry.action === 'update') return updatePayment(labour, entry.refId, entry.before, now, extra);
  }
  if (entry.entity === 'worker') {
    if (entry.action === 'create' || entry.action === 'restore') return deleteWorker(labour, entry.refId, now, extra);
    if (entry.action === 'delete') return restoreWorker(labour, entry.refId, now, extra);
    if (entry.action === 'update') return updateWorker(labour, entry.refId, entry.before, now, extra);
  }
  return labour;
}

/** Items in the recycle bin, newest first. */
export function recycleBin(labour) {
  const names = new Map(labour.workers.map((worker) => [worker.id, worker.name]));
  return [
    ...labour.workers.filter((worker) => worker.deletedAt).map((worker) => ({ type: 'worker', id: worker.id, deletedAt: worker.deletedAt, record: worker })),
    ...labour.payments.filter((payment) => payment.deletedAt).map((payment) => ({ type: 'payment', id: payment.id, deletedAt: payment.deletedAt, record: payment, workerName: names.get(payment.workerId) || '' }))
  ].sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
}

/**
 * The life of a bill, and what may be done to it at each stage.
 *
 *   draft      being worked on: everything editable, no payments yet (printed with a DRAFT stamp)
 *   ready      finished and given to the client: prices, measurements, client, GST and number are
 *              frozen; payments and advances can be recorded. Back to draft = the contractor edits again
 *   submitted  payment entered, bill closed: read-only, listed under Submitted. Only the admin reopens it
 *   cancelled  voided by the admin (a flag, not a stage): kept for the record, counted nowhere
 *
 * An estimate has the same stages but no payments: Draft, then Ready (shown as "Final"), then it is
 * converted into a bill. A bill's `audit` list records every change of stage with its reason.
 *
 * Older data used `final` / `settled` flags; billStatus() reads those too.
 */
import { getAdjustments, getPayments } from './payments.js';

export const STATUSES = Object.freeze(['draft', 'ready', 'submitted']);

/** 'draft' | 'ready' | 'submitted' */
export function billStatus(bill) {
  if (STATUSES.includes(bill?.status)) return bill.status;
  if (bill?.settled) return 'submitted';
  if (bill?.final) return 'ready';
  return 'draft';
}

export const isDraft = (bill) => billStatus(bill) === 'draft';
export const isReady = (bill) => billStatus(bill) === 'ready';
export const isSubmitted = (bill) => billStatus(bill) === 'submitted';
export const isCancelled = (bill) => Boolean(bill?.cancelled);
/** Past the draft stage: ready or submitted. */
export const isFinal = (bill) => !isDraft(bill);

/** Bills that still count in totals and reports. */
export const isCounted = (bill) => !isCancelled(bill);

/** Measurements, prices and client details cannot change. */
export const isEntryLocked = (bill) => isFinal(bill) || isCancelled(bill);

/** Nothing at all can change, payments included. */
export const isFrozen = (bill) => isSubmitted(bill) || isCancelled(bill);

export const hasMoney = (bill) => getPayments(bill || {}).length > 0 || getAdjustments(bill || {}).length > 0 || Number(bill?.advance) > 0;

/** Payments and advances can be recorded only while a bill is ready (the client is paying it). */
export const canTakePayment = (bill) => isReady(bill) && !isCancelled(bill);

/** 'cancelled' | 'submitted' | 'ready' | '' (draft) */
export function lockState(bill) {
  if (isCancelled(bill)) return 'cancelled';
  const status = billStatus(bill);
  return status === 'draft' ? '' : status;
}

/** True when no later bill follows this one in its running series. */
function isLastOfSeries(bills, bill) {
  return bills.filter((entry) => entry.raSeriesId === bill.raSeriesId && !entry.cancelled && !entry.deletedAt && entry.id !== bill.id)
    .every((entry) => (entry.raNumber || 0) < (bill.raNumber || 0));
}

/**
 * Why a bill cannot simply be deleted ('cancelled', 'submitted', 'ready', 'money', 'series'), or '' when it can.
 * Pass all `bills` to allow the one exception: the LAST running bill of a series, draft or ready, with no money on it.
 * Bills in the middle of a series stay (cancel them instead), so the running account never has a gap.
 */
export function deleteBlocker(bill, bills = null) {
  if (isCancelled(bill)) return 'cancelled';
  if (isSubmitted(bill)) return 'submitted';
  if (hasMoney(bill)) return 'money';
  if (bill?.raSeriesId) return bills && (bill.raNumber || 0) > 1 && isLastOfSeries(bills, bill) ? '' : 'series';
  return lockState(bill);
}

/** The bill number is part of what the client holds: fixed once the bill is ready or has money on it. */
export const isNumberLocked = (bill) => isEntryLocked(bill) || hasMoney(bill);

const CLIENT_FIELDS = ['projectId', 'projectName', 'client', 'clientId', 'clientPhone', 'clientAddress', 'clientGstin'];
const READY_FIELDS = [...CLIENT_FIELDS, 'firstLevelName', 'secondLevelName', 'discount', 'taxRate', 'gstEnabled', 'gstType', 'quotationId', 'quotationLabel'];
const MONEY_FIELDS = ['payments', 'advance', 'advanceAdjustments'];
const FROZEN_FIELDS = ['footer', 'name'];

/** Fields `bills.update` refuses to change for this bill. */
export function lockedFields(bill) {
  const fields = ['date'];
  if (bill?.projectId) fields.push(...CLIENT_FIELDS);
  if (isEntryLocked(bill)) fields.push(...READY_FIELDS);
  if (isNumberLocked(bill)) fields.push('number');
  // Payments and advances only while ready; before that nothing is owed yet, afterwards the bill is closed.
  if (!canTakePayment(bill)) fields.push(...MONEY_FIELDS);
  if (isFrozen(bill)) fields.push(...FROZEN_FIELDS);
  return fields;
}

export function auditEntry(action, reason = '', now = new Date()) {
  return { at: now.toISOString(), action, reason: String(reason || '').trim() };
}

export const withAudit = (bill, action, reason, now) => ({
  ...bill,
  audit: [...(Array.isArray(bill.audit) ? bill.audit : []), auditEntry(action, reason, now)].slice(-100)
});

/** What stops a bill or estimate from being marked ready ([] when nothing does). */
export function readyBlockers(bill, quotation = null) {
  const blockers = [];
  const items = (bill.sections || []).reduce((count, section) => count + (section.areas || []).reduce((sum, area) => sum + (area.items || []).length, 0), 0);
  if (!items) blockers.push('empty');
  if (bill.quotationId && quotation && quotation.status !== 'final') blockers.push('quotation-draft');
  if (bill.kind === 'estimate' && !bill.quotationId) blockers.push('quotation-missing');
  return blockers;
}

/** Whether `bill` may go back to draft: the contractor only before any money is on it; the admin always. */
export function canMoveToDraft(bill, { admin = false } = {}) {
  if (!isReady(bill) || isCancelled(bill)) return false;
  return admin || !hasMoney(bill);
}

/** Closes a ready bill after its payment is entered. `reason` explains a balance left unpaid. */
export function submitBill(bill, { reason = '', now = new Date() } = {}) {
  if (!isReady(bill) || isCancelled(bill)) return bill;
  return withAudit({ ...bill, status: 'submitted', submittedAt: now.toISOString() }, reason ? 'submitted-unpaid' : 'submitted', reason, now);
}

/** The admin reopens a submitted bill (it goes back to ready); the reason is kept. */
export function reopenSubmitted(bill, reason, now = new Date()) {
  if (!isSubmitted(bill)) return bill;
  const { submittedAt: _at, ...rest } = bill;
  return withAudit({ ...rest, status: 'ready' }, 'reopened', reason, now);
}

/** Voids a bill that cannot be deleted; its payments stay on record. */
export function cancelBill(bill, reason, now = new Date()) {
  if (isCancelled(bill)) return bill;
  return withAudit({ ...bill, cancelled: true, cancelledAt: now.toISOString(), cancelReason: String(reason || '').trim() }, 'cancelled', reason, now);
}

export function restoreCancelled(bill, reason, now = new Date()) {
  if (!isCancelled(bill)) return bill;
  const { cancelled: _cancelled, cancelledAt: _at, cancelReason: _reason, ...rest } = bill;
  return withAudit(rest, 'restored', reason, now);
}

/** Why `bill` cannot become a running bill of `source` ('same', 'estimate', 'project', 'series', 'locked'), or ''. */
export function seriesBlocker(bill, source) {
  if (!bill || !source || bill.id === source.id) return 'same';
  if (bill.kind === 'estimate' || source.kind === 'estimate') return 'estimate';
  if (!bill.projectId || bill.projectId !== source.projectId) return 'project';
  if (bill.raSeriesId) return 'series';
  if (isEntryLocked(bill) || isCancelled(source)) return 'locked';
  return '';
}

/**
 * Makes `bill` the next running bill after the last bill of `source`'s series.
 * Returns `{ bill, sourcePatch }` (sourcePatch is null when `source` already has a series) or null.
 */
export function attachToSeries(bills, bill, source, now = new Date()) {
  if (seriesBlocker(bill, source)) return null;
  const seriesId = source.raSeriesId || source.id;
  const series = bills.filter((entry) => entry.raSeriesId === seriesId);
  const raNumber = Math.max(source.raSeriesId ? 0 : 1, ...series.map((entry) => entry.raNumber || 1)) + 1;
  return {
    bill: withAudit({ ...bill, raSeriesId: seriesId, raNumber }, 'running-bill', `RA ${raNumber}`, now),
    sourcePatch: source.raSeriesId ? null : { raSeriesId: seriesId, raNumber: 1 }
  };
}

/** Moves bills saved with the older `final` / `settled` flags to a status. */
export function withStatus(bill) {
  const legacy = bill && (bill.final !== undefined || bill.settled !== undefined || bill.finalizedAt !== undefined || bill.settledAt !== undefined);
  if (!legacy) return bill;
  const { final: _final, finalizedAt, settled: _settled, settledAt, ...rest } = bill;
  const status = billStatus(bill);
  return {
    ...rest,
    status,
    ...(status !== 'draft' && (finalizedAt || rest.readyAt) ? { readyAt: rest.readyAt || finalizedAt } : {}),
    ...(status === 'submitted' && (settledAt || rest.submittedAt) ? { submittedAt: rest.submittedAt || settledAt } : {})
  };
}

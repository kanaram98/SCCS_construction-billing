/**
 * Bill kinds and running (RA) bills.
 *
 * - An estimate (quotation) has the same structure as a bill but no payments;
 *   it can be converted into a bill.
 * - Running bills share a `raSeriesId`; each has an `raNumber` (RA 1, RA 2…)
 *   and prints a running account of work and payments to date.
 */
import { cloneSections, createBill, getNextBillNumber } from './factories.js';
import { getBillTotals } from './calculations.js';
import { newId } from './ids.js';
import { getPrintDocument } from './print-settings.js';
import { billStatus } from './bill-guard.js';

export function isEstimate(bill) {
  return bill.kind === 'estimate';
}

export function billKind(bill) {
  return isEstimate(bill) ? 'estimate' : 'bill';
}

/** Bills of the same kind (numbering and duplicate checks are per kind). */
export function billsOfKind(bills, kind) {
  return bills.filter((bill) => billKind(bill) === kind);
}

export function nextNumberFor(bills, kind) {
  return getNextBillNumber(billsOfKind(bills, kind));
}

/**
 * A short code for a project, from its name: "Lake View Villa" → "LVV", "Tower" → "TOW".
 * Bills of a project are numbered with it, the way a site would: LVV/003.
 */
export function projectCode(name) {
  const words = String(name || '').toUpperCase().split(/[^A-Z0-9]+/).filter(Boolean);
  if (!words.length) return 'PRJ';
  return words.length === 1 ? words[0].slice(0, 3) : words.map((word) => word[0]).join('').slice(0, 4);
}

const padNumber = (number) => (/^\d+$/.test(String(number)) ? String(number).padStart(3, '0') : String(number));

/**
 * Display name. A bill of a project reads like a site reference: "LVV/003", "LVV/EST-002", "LVV/003 · RA 2".
 * A bill with no project keeps the plain "Bill 12" / "Estimate 3".
 * @param {(text: string, params?: object) => string} t translator
 */
export function billLabel(bill, t) {
  const linked = Boolean(bill.projectId) && !bill.isSample;
  const base = linked
    ? `${projectCode(bill.projectName)}/${isEstimate(bill) ? 'EST-' : ''}${padNumber(bill.number)}`
    : (isEstimate(bill) ? t('Estimate {number}', { number: bill.number }) : t('Bill {number}', { number: bill.number }));
  return bill.raNumber ? `${base} · ${t('RA {number}', { number: bill.raNumber })}` : base;
}

/** New bill from an estimate: same content, next bill number, no payments. */
export function convertEstimateToBill(estimate, bills) {
  return {
    ...estimate,
    id: newId(),
    kind: 'bill',
    number: nextNumberFor(bills, 'bill'),
    sections: cloneSections(estimate.sections),
    payments: [],
    advanceAdjustments: [],
    status: 'draft',
    readyAt: undefined,
    submittedAt: undefined,
    firmSnapshot: undefined,
    audit: undefined,
    advance: '',
    isSample: false,
    convertedBillId: undefined,
    sourceEstimateId: estimate.id
  };
}

export function getSeries(bills, bill) {
  if (!bill.raSeriesId) return [bill];
  return bills
    .filter((entry) => entry.raSeriesId === bill.raSeriesId)
    .sort((left, right) => (left.raNumber || 0) - (right.raNumber || 0));
}

/**
 * Why a bill cannot have a next running bill started from it ('' when it can). A running series is one
 * chain, RA 1 → RA 2 → RA 3: the next bill is started from the latest bill, and only once that bill is
 * ready (given to the client), so a draft never spawns more drafts and the series never forks.
 */
export function nextRunningBlocker(bills, bill) {
  if (bill.kind === 'estimate') return 'estimate';
  if (bill.cancelled) return 'cancelled';
  if (billStatus(bill) !== 'ready') return 'not-ready';
  if (bill.raSeriesId) {
    const latest = Math.max(...getSeries(bills, bill).filter((entry) => !entry.cancelled && !entry.deletedAt).map((entry) => entry.raNumber || 1));
    if ((bill.raNumber || 1) < latest) return 'not-latest';
  }
  return '';
}

/**
 * Starts the next running bill after `source`: same project, client, name and settings, but a
 * fresh empty bill: no floors, rooms or entries (each running bill is only the work done since the last).
 * @returns {{ bill: object, sourcePatch: object }} sourcePatch turns a plain bill into RA 1
 */
export function createNextRunningBill(bills, source) {
  const seriesId = source.raSeriesId || source.id;
  const series = source.raSeriesId ? getSeries(bills, source) : [source];
  const raNumber = Math.max(...series.map((entry) => entry.raNumber || 1)) + 1;
  const bill = {
    ...createBill(nextNumberFor(bills, 'bill'), { gstEnabled: source.gstEnabled !== false }),
    projectId: source.projectId || '',
    projectName: source.projectName,
    clientId: source.clientId,
    client: source.client,
    clientPhone: source.clientPhone,
    clientAddress: source.clientAddress,
    clientGstin: source.clientGstin,
    firstLevelName: source.firstLevelName,
    secondLevelName: source.secondLevelName,
    discount: '',
    taxRate: source.taxRate,
    gstType: source.gstType,
    footer: source.footer,
    quotationId: source.quotationId,
    quotationLabel: source.quotationLabel,
    name: source.name,
    raSeriesId: seriesId,
    raNumber,
    sections: []
  };
  return { bill, sourcePatch: source.raSeriesId ? {} : { raSeriesId: seriesId, raNumber: 1 } };
}

/**
 * Running account for an RA bill: work and payments of this and earlier bills.
 * @returns {null | { raNumber, previousCount, thisTotal, previousTotal, totalToDate, receivedToDate, balanceToDate }}
 */
export function getRunningAccount(bills, bill, rates) {
  if (!bill.raSeriesId || !bill.raNumber) return null;
  const upToThis = getSeries(bills, bill).filter((entry) => (entry.raNumber || 0) <= bill.raNumber && (entry.id === bill.id || !entry.cancelled));
  const totals = upToThis.map((entry) => ({ entry, totals: getBillTotals(entry, rates) }));
  const thisTotal = getBillTotals(bill, rates).total;
  const totalToDate = totals.reduce((sum, { totals: value }) => sum + value.total, 0);
  const receivedToDate = totals.reduce((sum, { totals: value }) => sum + value.paid, 0);
  return {
    raNumber: bill.raNumber,
    trail: totals.map(({ entry, totals: value }) => ({ id: entry.id, raNumber: entry.raNumber, number: entry.number, date: entry.date, total: value.total, paid: value.paid, current: entry.id === bill.id })),
    previousCount: upToThis.length - 1,
    thisTotal,
    previousTotal: totalToDate - thisTotal,
    totalToDate,
    receivedToDate,
    balanceToDate: totalToDate - receivedToDate
  };
}

/**
 * Title of a printed document. Estimates print their bill and summary as
 * "Estimate" / "Estimate summary"; `pdf` picks the short PDF heading.
 */
export function documentTitle(documentType, bill, { pdf = false } = {}) {
  if (isEstimate(bill) && documentType === 'bill') return 'Detailed estimate';
  if (isEstimate(bill) && documentType === 'summary') return 'Estimate summary';
  const document = getPrintDocument(documentType);
  return pdf ? document?.pdfTitle : document?.label;
}

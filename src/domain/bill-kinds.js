/**
 * Bill kinds and running (RA) bills.
 *
 * - An estimate (quotation) has the same structure as a bill but no payments;
 *   it can be converted into a bill.
 * - Running bills share a `raSeriesId`; each has an `raNumber` (RA 1, RA 2…)
 *   and prints a running account of work and payments to date.
 */
import { cloneSections, createArea, createBill, createSection, getNextBillNumber } from './factories.js';
import { getBillTotals } from './calculations.js';
import { newId } from './ids.js';
import { getPrintDocument } from './print-settings.js';

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
 * Display name such as "Bill 12", "Estimate 3" or "Bill 12 · RA 2".
 * @param {(text: string, params?: object) => string} t translator
 */
export function billLabel(bill, t) {
  const base = isEstimate(bill) ? t('Estimate {number}', { number: bill.number }) : t('Bill {number}', { number: bill.number });
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
    final: undefined,
    finalizedAt: undefined,
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
 * Starts the next running bill after `source`: same project, client and
 * settings, the same floors/rooms with no entries yet.
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
    raSeriesId: seriesId,
    raNumber,
    sections: (source.sections || []).map((section) =>
      createSection(section.name, (section.areas || []).map((area) => createArea(area.name))))
  };
  return { bill, sourcePatch: source.raSeriesId ? {} : { raSeriesId: seriesId, raNumber: 1 } };
}

/**
 * Running account for an RA bill: work and payments of this and earlier bills.
 * @returns {null | { raNumber, previousCount, thisTotal, previousTotal, totalToDate, receivedToDate, balanceToDate }}
 */
export function getRunningAccount(bills, bill, rates) {
  if (!bill.raSeriesId || !bill.raNumber) return null;
  const upToThis = getSeries(bills, bill).filter((entry) => (entry.raNumber || 0) <= bill.raNumber);
  const totals = upToThis.map((entry) => ({ entry, totals: getBillTotals(entry, rates) }));
  const thisTotal = getBillTotals(bill, rates).total;
  const totalToDate = totals.reduce((sum, { totals: value }) => sum + value.total, 0);
  const receivedToDate = totals.reduce((sum, { totals: value }) => sum + value.paid, 0);
  return {
    raNumber: bill.raNumber,
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

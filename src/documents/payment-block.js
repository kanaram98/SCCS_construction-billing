/**
 * The "Payment details" block printed below money documents (bill and summary):
 * bank/UPI lines plus an optional UPI QR code for the balance due.
 */
import { getBillTotals } from '../domain/calculations.js';
import { buildUpiUri, canMakeUpiQr, createQrMatrix, getPaymentLines, hasPaymentDetails } from '../domain/payment-details.js';

/** Documents that show an amount to pay. */
export const PAYMENT_DOCUMENTS = new Set(['bill', 'summary']);

/**
 * @returns {null | { lines: string[], qr: null | { matrix: boolean[][], amount: number } }}
 */
export function buildPaymentBlock(documentType, bill, rates, firm, settings, translate = (value) => value, { runningAccount = null } = {}) {
  if (bill.kind === 'estimate') return null; // nothing to pay on an estimate
  if (!settings.paymentDetails || !PAYMENT_DOCUMENTS.has(documentType) || !hasPaymentDetails(firm)) return null;
  const { balance } = getBillTotals(bill, rates);
  const amount = Math.max(0, runningAccount && documentType === 'summary' ? runningAccount.balanceToDate : balance);
  const qr = settings.upiQr && canMakeUpiQr(firm) && amount > 0
    ? {
        amount,
        matrix: createQrMatrix(buildUpiUri({
          upiId: firm.upiId,
          payeeName: firm.accountName || firm.name,
          amount,
          note: `Bill ${bill.number}`
        }))
      }
    : null;
  return { lines: getPaymentLines(firm, translate), qr };
}

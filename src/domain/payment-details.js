/**
 * Bank / UPI payment details printed on bills, and the UPI QR code
 * (a standard `upi://pay` link that any UPI app can scan).
 */
import qrcode from 'qrcode-generator';
import { text } from './formatters.js';
import { tr } from '../i18n/translate.js';

export const PAYMENT_FIELDS = Object.freeze([
  { key: 'bankName', label: 'Bank name' },
  { key: 'accountName', label: 'Account holder' },
  { key: 'accountNumber', label: 'Account number' },
  { key: 'ifsc', label: 'IFSC' },
  { key: 'upiId', label: 'UPI ID' }
]);

const PRINT_LABELS = { bankName: 'Bank', accountName: 'A/c name', accountNumber: 'A/c no.', ifsc: 'IFSC', upiId: 'UPI' };

export function hasPaymentDetails(firm) {
  return PAYMENT_FIELDS.some(({ key }) => text(firm?.[key]));
}

/** Printable lines such as "IFSC: SBIN0001234", skipping empty fields. `translate` localises the labels. */
export function getPaymentLines(firm, translate = (value) => value) {
  return PAYMENT_FIELDS
    .filter(({ key }) => text(firm?.[key]))
    .map(({ key }) => `${translate(PRINT_LABELS[key])}: ${text(firm[key])}`);
}

const UPI_ID_PATTERN = /^[\w.-]{2,}@[a-zA-Z][\w]{1,}$/;
const IFSC_PATTERN = /^[A-Z]{4}0[A-Z0-9]{6}$/;
const ACCOUNT_PATTERN = /^\d{9,18}$/;

/** Format warnings for the payment fields ('' when fine or empty). */
export function getPaymentFieldErrors(firm) {
  const upiId = text(firm?.upiId);
  const ifsc = text(firm?.ifsc).toUpperCase();
  const account = text(firm?.accountNumber).replace(/\s/g, '');
  return {
    upiId: upiId && !UPI_ID_PATTERN.test(upiId) ? tr('Check the UPI ID, e.g. name@okbank.') : '',
    ifsc: ifsc && !IFSC_PATTERN.test(ifsc) ? tr('IFSC is 11 characters, e.g. SBIN0001234.') : '',
    accountNumber: account && !ACCOUNT_PATTERN.test(account) ? tr('Account number should be 9–18 digits.') : ''
  };
}

/** Standard UPI payment link; the amount is pre-filled when given. */
export function buildUpiUri({ upiId, payeeName, amount, note }) {
  const params = [
    ['pa', text(upiId)],
    ['pn', text(payeeName)],
    ...(amount > 0 ? [['am', Number(amount).toFixed(2)]] : []),
    ['cu', 'INR'],
    ...(text(note) ? [['tn', text(note)]] : [])
  ].filter(([, value]) => value);
  return `upi://pay?${params.map(([key, value]) => `${key}=${encodeURIComponent(value)}`).join('&')}`;
}

/** QR code as a square grid of booleans (true = dark module). */
export function createQrMatrix(data) {
  const qr = qrcode(0, 'M');
  qr.addData(data);
  qr.make();
  const size = qr.getModuleCount();
  return Array.from({ length: size }, (_row, y) => Array.from({ length: size }, (_col, x) => qr.isDark(y, x)));
}

/** Whether a UPI ID looks usable for a QR code. */
export function canMakeUpiQr(firm) {
  return Boolean(text(firm?.upiId)) && !getPaymentFieldErrors(firm).upiId;
}

/** Payments received against a bill (in addition to the advance). */
import { newId } from './ids.js';
import { text, todayIso } from './formatters.js';
import { tr } from '../i18n/translate.js';

export const PAYMENT_MODES = Object.freeze({
  upi: 'UPI',
  cash: 'Cash',
  bank: 'Bank transfer',
  cheque: 'Cheque'
});

export function paymentModeLabel(mode) {
  return PAYMENT_MODES[mode] || 'Other';
}

export function getPayments(bill) {
  return Array.isArray(bill.payments) ? bill.payments : [];
}

/** Sum of recorded payments (ignores invalid amounts). */
export function sumPayments(bill) {
  return getPayments(bill).reduce((sum, payment) => {
    const amount = Number(payment.amount);
    return sum + (Number.isFinite(amount) && amount > 0 ? amount : 0);
  }, 0);
}

export function createPayment(values) {
  return {
    id: newId(),
    date: values.date || todayIso(),
    amount: Number(values.amount),
    mode: values.mode || 'upi',
    note: text(values.note)
  };
}

/** Field errors for the payment form ('' when valid). */
export function getPaymentErrors(values) {
  const amount = Number(values.amount);
  return {
    date: text(values.date) ? '' : tr('Choose the payment date.'),
    amount: text(values.amount) && Number.isFinite(amount) && amount > 0 ? '' : tr('Enter an amount greater than zero.')
  };
}

/** Payments, newest first. */
export function sortPayments(payments) {
  return [...payments].sort((left, right) => String(right.date).localeCompare(String(left.date)));
}

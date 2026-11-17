/**
 * WhatsApp messages for sharing a bill and reminding a client to pay.
 * Messages use the translator for the bill's language.
 */
import { formatCurrency, text } from './formatters.js';
import { billLabel } from './bill-kinds.js';

/** Indian mobile number as WhatsApp expects it (country code, digits only), or '' if unusable. */
export function whatsappNumber(phone) {
  let digits = text(phone).replace(/\D/g, '');
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  if (digits.length === 10) return `91${digits}`;
  if (digits.length === 12 && digits.startsWith('91')) return digits;
  return '';
}

/** wa.me link that opens a chat (with the client when the number is known) and fills the message. */
export function whatsappUrl(phone, message) {
  const number = whatsappNumber(phone);
  return `https://wa.me/${number}?text=${encodeURIComponent(message)}`;
}

const lines = (...parts) => parts.filter(Boolean).join('\n');

/** Short summary sent with a bill. */
export function billShareMessage({ bill, firm, totals, t }) {
  return lines(
    `${billLabel(bill, t)}${bill.projectName ? ` · ${bill.projectName}` : ''}`,
    t('Total: {amount}', { amount: formatCurrency(totals.total) }),
    totals.paid > 0 && t('Paid: {amount}', { amount: formatCurrency(totals.paid) }),
    totals.paid > 0 && t('Balance due: {amount}', { amount: formatCurrency(Math.max(0, totals.balance)) }),
    bill.kind !== 'estimate' && totals.balance > 0 && text(firm.upiId) && t('Pay by UPI: {upi}', { upi: text(firm.upiId) }),
    text(firm.name) && `— ${text(firm.name)}${text(firm.phone) ? `, ${text(firm.phone)}` : ''}`
  );
}

/** Polite reminder for the balance due. */
export function paymentReminderMessage({ bill, firm, totals, t }) {
  return lines(
    t('Namaste {client},', { client: text(bill.client) || t('Sir/Madam') }),
    t('This is a gentle reminder that {amount} is pending for Bill {number}{project}.', {
      amount: formatCurrency(Math.max(0, totals.balance)),
      number: bill.number,
      project: bill.projectName ? ` (${bill.projectName})` : ''
    }),
    text(firm.upiId) && t('Pay by UPI: {upi}', { upi: text(firm.upiId) }),
    t('Thank you.'),
    text(firm.name) && `— ${text(firm.name)}${text(firm.phone) ? `, ${text(firm.phone)}` : ''}`
  );
}

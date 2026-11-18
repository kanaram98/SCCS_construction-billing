/**
 * Payment receipts: proof for the client that money was received.
 * A receipt is plain data (no language); `receiptLines` turns it into labelled rows.
 *
 *   kind 'bill'     a payment recorded on a bill
 *   kind 'advance'  an advance from the client under a project
 */
import { amountInWordsFor } from './amount-in-words.js';
import { PAYMENT_MODES } from './payments.js';
import { getBillTotals } from './calculations.js';
import { formatCurrency, text } from './formatters.js';

/** e.g. RCT-261102-A1B2 (kind, date, last 4 characters of the record id). */
export function receiptNumber(kind, record) {
  return `${kind === 'advance' ? 'ADV' : 'RCT'}-${String(record.date).replace(/-/g, '').slice(2)}-${String(record.id).slice(-4).toUpperCase()}`;
}

export function billPaymentReceipt({ bill, payment, rates }) {
  const totals = getBillTotals(bill, rates);
  return {
    kind: 'bill',
    number: receiptNumber('bill', payment),
    date: payment.date,
    amount: Number(payment.amount) || 0,
    mode: payment.mode,
    note: text(payment.note),
    client: text(bill.client),
    clientPhone: text(bill.clientPhone),
    projectName: text(bill.projectName),
    billNumber: text(bill.number),
    balanceDue: Math.max(0, totals.balance)
  };
}

export function advanceReceipt({ project, advance }) {
  return {
    kind: 'advance',
    number: receiptNumber('advance', advance),
    date: advance.date,
    amount: Number(advance.amount) || 0,
    mode: advance.mode,
    note: text(advance.note),
    client: text(project.client),
    clientPhone: text(project.clientPhone),
    projectName: text(project.name),
    billNumber: '',
    balanceDue: 0
  };
}

/** Labelled rows of a receipt in the document's language (`t`), amounts through `money`. */
export function receiptLines(receipt, t, language, money = formatCurrency) {
  return [
    [t('Receipt no.'), receipt.number],
    [t('Date'), receipt.date],
    [t('Received from'), receipt.client || '—'],
    receipt.projectName && [t('Project'), receipt.projectName],
    [t('Towards'), receipt.kind === 'bill' ? t('Payment for bill {number}', { number: receipt.billNumber }) : t('Advance payment')],
    [t('Paid by'), t(PAYMENT_MODES[receipt.mode] || 'Cash')],
    receipt.note && [t('Note'), receipt.note],
    [t('Amount received'), money(receipt.amount)],
    [t('In words'), amountInWordsFor(receipt.amount, language)],
    receipt.kind === 'bill' && [t('Balance due on this bill'), money(receipt.balanceDue)]
  ].filter(Boolean);
}

/** Short WhatsApp text for the receipt. */
export function receiptMessage(receipt, firm, t, language) {
  return [
    t('Payment receipt {number}', { number: receipt.number }),
    t('{amount} received from {client} on {date}', { amount: formatCurrency(receipt.amount), client: receipt.client || '—', date: receipt.date }),
    receipt.kind === 'bill' ? t('Towards bill {number}', { number: receipt.billNumber }) : t('Towards advance for {project}', { project: receipt.projectName }),
    receipt.kind === 'bill' && receipt.balanceDue > 0 && t('Balance due: {amount}', { amount: formatCurrency(receipt.balanceDue) }),
    amountInWordsFor(receipt.amount, language),
    text(firm.name) && `— ${text(firm.name)}${text(firm.phone) ? `, ${text(firm.phone)}` : ''}`
  ].filter(Boolean).join('\n');
}

import test from 'node:test';
import assert from 'node:assert/strict';
import { advanceReceipt, billPaymentReceipt, receiptLines, receiptMessage, receiptNumber } from '../../src/domain/receipt.js';
import { makeTranslator } from '../../src/i18n/translate.js';

const t = makeTranslator('en');
const rates = [{ id: 'r', type: 'count', rate: 1000 }];
const bill = { id: 'b1', number: '4', client: 'Asha', clientPhone: '9876543210', projectName: 'Villa', advance: '', payments: [{ id: 'pay-abcd', date: '2026-11-02', amount: 3000, mode: 'upi', note: 'first part' }], sections: [{ areas: [{ items: [{ rateId: 'r', count: 10 }] }] }] };

test('receipt numbers are stable and tell the kind', () => {
  assert.equal(receiptNumber('bill', { id: 'pay-abcd', date: '2026-11-02' }), 'RCT-261102-ABCD');
  assert.equal(receiptNumber('advance', { id: 'xx12', date: '2026-01-05' }), 'ADV-260105-XX12');
});

test('a bill payment receipt shows the amount, words and the balance still due', () => {
  const receipt = billPaymentReceipt({ bill, payment: bill.payments[0], rates });
  assert.equal(receipt.balanceDue, 7000);
  const rows = Object.fromEntries(receiptLines(receipt, t, 'en', (n) => `₹${n}`));
  assert.equal(rows['Received from'], 'Asha');
  assert.equal(rows['Amount received'], '₹3000');
  assert.match(rows['In words'], /Three Thousand/i);
  assert.equal(rows['Balance due on this bill'], '₹7000');
  assert.equal(rows['Towards'], 'Payment for bill 4');
  assert.match(receiptMessage(receipt, { name: 'SCCS', phone: '99' }, t, 'en'), /RCT-261102-ABCD[\s\S]*SCCS/);
});

test('an advance receipt has no bill balance', () => {
  const receipt = advanceReceipt({ project: { name: 'Villa', client: 'Asha', clientPhone: '' }, advance: { id: 'adv1', date: '2026-11-01', amount: 50000, mode: 'cash', note: '' } });
  const labels = receiptLines(receipt, t, 'en').map(([label]) => label);
  assert.ok(!labels.includes('Balance due on this bill'));
  assert.equal(receipt.kind, 'advance');
});

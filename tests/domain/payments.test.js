import test from 'node:test';
import assert from 'node:assert/strict';
import { createPayment, getPaymentErrors, sortPayments, sumPayments } from '../../src/domain/payments.js';
import { getBillTotals, getPaymentStatus } from '../../src/domain/calculations.js';
import { getAmountErrors } from '../../src/domain/validation.js';
import { duplicateBill } from '../../src/domain/factories.js';

const rates = [{ id: 'r', type: 'count', rate: 1000 }];
const bill = (extra = {}) => ({ advance: '200', sections: [{ areas: [{ items: [{ rateId: 'r', count: 1 }] }] }], ...extra });

test('payments add to the advance when working out the balance and status', () => {
  const payments = [createPayment({ date: '2026-11-01', amount: '300', mode: 'cash' }), createPayment({ date: '2026-11-05', amount: 500 })];
  const totals = getBillTotals(bill({ payments }), rates);
  assert.equal(totals.received, 800);
  assert.equal(totals.paid, 1000);
  assert.equal(totals.balance, 0);
  assert.equal(getPaymentStatus(bill({ payments }), rates), 'paid');
  assert.equal(getPaymentStatus(bill({ payments: payments.slice(0, 1) }), rates), 'partial');
  assert.equal(sumPayments({ payments: [{ amount: 'x' }, { amount: -5 }, { amount: 10 }] }), 10);
});

test('validates the payment form and flags overpayment', () => {
  assert.deepEqual(getPaymentErrors({ date: '', amount: '0' }), { date: 'Choose the payment date.', amount: 'Enter an amount greater than zero.' });
  assert.deepEqual(getPaymentErrors({ date: '2026-11-01', amount: '10' }), { date: '', amount: '' });
  const over = bill({ payments: [createPayment({ amount: 900 })] });
  assert.equal(getAmountErrors(over, rates).payments, 'Payments received exceed the bill total.');
});

test('sorts newest first and duplicates start without payments', () => {
  const sorted = sortPayments([{ date: '2026-01-01' }, { date: '2026-03-01' }]);
  assert.equal(sorted[0].date, '2026-03-01');
  const copy = duplicateBill({ ...bill({ payments: [createPayment({ amount: 5 })] }), id: 'b', number: '1', sections: [] }, '2');
  assert.deepEqual(copy.payments, []);
});

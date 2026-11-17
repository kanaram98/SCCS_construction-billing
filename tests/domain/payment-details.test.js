import test from 'node:test';
import assert from 'node:assert/strict';
import { buildUpiUri, createQrMatrix, getPaymentFieldErrors, getPaymentLines } from '../../src/domain/payment-details.js';
import { buildPaymentBlock } from '../../src/documents/payment-block.js';
import { createDefaultPrintSettings } from '../../src/domain/print-settings.js';
import { hydrateState } from '../../src/domain/app-state.js';

const firm = { name: 'Acme', bankName: 'SBI', accountNumber: '12345678901', ifsc: 'SBIN0001234', upiId: 'acme@oksbi', accountName: '' };

test('payment lines skip empty fields', () => {
  assert.deepEqual(getPaymentLines(firm), ['Bank: SBI', 'A/c no.: 12345678901', 'IFSC: SBIN0001234', 'UPI: acme@oksbi']);
});

test('format checks for UPI ID, IFSC and account number', () => {
  assert.deepEqual(getPaymentFieldErrors(firm), { upiId: '', ifsc: '', accountNumber: '' });
  const bad = getPaymentFieldErrors({ upiId: 'acme', ifsc: 'SBI123', accountNumber: '12ab' });
  assert.ok(bad.upiId && bad.ifsc && bad.accountNumber);
  assert.deepEqual(getPaymentFieldErrors({}), { upiId: '', ifsc: '', accountNumber: '' });
});

test('builds a UPI link with the amount and a scannable QR matrix', () => {
  const uri = buildUpiUri({ upiId: 'acme@oksbi', payeeName: 'Acme & Sons', amount: 1500, note: 'Bill 7' });
  assert.equal(uri, 'upi://pay?pa=acme%40oksbi&pn=Acme%20%26%20Sons&am=1500.00&cu=INR&tn=Bill%207');
  const matrix = createQrMatrix(uri);
  assert.ok(matrix.length >= 21 && matrix.every((row) => row.length === matrix.length));
  assert.equal(matrix[0][0], true); // finder pattern corner
});

test('payment block appears on money documents with a QR for the balance due', () => {
  const rates = [{ id: 'r', type: 'count', rate: 1000 }];
  const bill = { number: '7', advance: '400', sections: [{ areas: [{ items: [{ rateId: 'r', count: 1 }] }] }] };
  const settings = createDefaultPrintSettings();
  const block = buildPaymentBlock('bill', bill, rates, firm, settings);
  assert.equal(block.qr.amount, 600);
  assert.equal(buildPaymentBlock('measurement', bill, rates, firm, settings), null);
  assert.equal(buildPaymentBlock('bill', bill, rates, firm, { ...settings, paymentDetails: false }), null);
  assert.equal(buildPaymentBlock('bill', bill, rates, firm, { ...settings, upiQr: false }).qr, null);
  assert.equal(buildPaymentBlock('bill', { ...bill, advance: '1000' }, rates, firm, settings).qr, null);
});

test('legacy free-text bank field becomes the bank name', () => {
  const state = hydrateState({ bills: [{ id: 'b', sections: [] }], firm: { bank: 'HDFC, Pune' }, printSettings: {} });
  assert.equal(state.firm.bankName, 'HDFC, Pune');
});

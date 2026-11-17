import test from 'node:test';
import assert from 'node:assert/strict';
import { billShareMessage, paymentReminderMessage, whatsappNumber, whatsappUrl } from '../../src/domain/whatsapp.js';
import { makeTranslator } from '../../src/i18n/translate.js';

const t = makeTranslator('en');
const bill = { number: '12', projectName: 'Lake View Villa', client: 'Ravi' };
const firm = { name: 'Acme Interiors', phone: '98765 43210', upiId: 'acme@oksbi' };
const totals = { total: 13895, paid: 5000, balance: 8895 };

test('normalises Indian numbers for WhatsApp', () => {
  assert.equal(whatsappNumber('98765 43210'), '919876543210');
  assert.equal(whatsappNumber('+91-98765-43210'), '919876543210');
  assert.equal(whatsappNumber('098765 43210'), '919876543210');
  assert.equal(whatsappNumber('12345'), '');
  assert.equal(whatsappUrl('', 'Hi there'), 'https://wa.me/?text=Hi%20there');
  assert.equal(whatsappUrl('9876543210', 'Hi'), 'https://wa.me/919876543210?text=Hi');
});

test('bill message lists total, paid, balance and UPI', () => {
  assert.equal(billShareMessage({ bill, firm, totals, t }), [
    'Bill 12 · Lake View Villa',
    'Total: ₹13,895',
    'Paid: ₹5,000',
    'Balance due: ₹8,895',
    'Pay by UPI: acme@oksbi',
    '— Acme Interiors, 98765 43210'
  ].join('\n'));
  // Nothing paid yet: no paid/balance lines
  assert.equal(billShareMessage({ bill, firm: { name: 'A' }, totals: { total: 100, paid: 0, balance: 100 }, t }), 'Bill 12 · Lake View Villa\nTotal: ₹100\n— A');
});

test('reminder message in English and Hindi', () => {
  const english = paymentReminderMessage({ bill, firm, totals, t });
  assert.match(english, /^Namaste Ravi,\nThis is a gentle reminder that ₹8,895 is pending for Bill 12 \(Lake View Villa\)\./);
  const hindi = paymentReminderMessage({ bill, firm, totals, t: makeTranslator('hi') });
  assert.match(hindi, /^नमस्ते Ravi,/);
  assert.match(hindi, /₹8,895/);
});

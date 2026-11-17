import test from 'node:test';
import assert from 'node:assert/strict';
import { feetInchesError, parseFeetInches } from '../../src/domain/measurements.js';
import { getBillTotals, getItemQuantity, getLineAmount, getPaymentStatus } from '../../src/domain/calculations.js';
import { getBillValidation } from '../../src/domain/validation.js';
import {
  DEFAULT_SIGNATURE_LAYOUT,
  SIGNATURE_AREA,
  normalizeSignatureLayout
} from '../../src/domain/signature-layout.js';
import { createDefaultPrintSettings, normalizePrintSettings } from '../../src/domain/print-settings.js';

test('normalizes signature placement to the footer area', () => {
  assert.deepEqual(normalizeSignatureLayout(), DEFAULT_SIGNATURE_LAYOUT);
  assert.deepEqual(normalizeSignatureLayout(null), DEFAULT_SIGNATURE_LAYOUT);
  assert.deepEqual(normalizeSignatureLayout({ x: 100, y: -3, width: 100, height: 0 }), {
    x: 0,
    y: 0,
    width: SIGNATURE_AREA.width,
    height: 5
  });
  assert.deepEqual(normalizeSignatureLayout({ x: 44, y: 24, width: 20, height: 30 }), {
    x: 44,
    y: 0,
    width: 20,
    height: SIGNATURE_AREA.height
  });
});

test('normalizes print settings: invalid values fall back, order is de-duplicated', () => {
  const settings = normalizePrintSettings(
    { paper: 'invalid', margin: 80, documentOrder: ['items', 'bill', 'items'], documents: { items: true } }
  );
  assert.equal(settings.paper, 'a4');
  assert.equal(settings.margin, 30);
  assert.deepEqual(settings.documentOrder, ['items', 'bill', 'summary', 'measurement']);
  assert.equal(settings.documents.items, true);
  assert.deepEqual(Object.keys(settings.documents).sort(), ['bill', 'items', 'measurement', 'summary']);
  assert.equal(createDefaultPrintSettings().signatureMode, 'last');
});

test('parses feet.inches dimensions as feet and inches', () => {
  assert.equal(parseFeetInches('15.4'), 15 + 4 / 12);
  assert.equal(parseFeetInches('8.11'), 8 + 11 / 12);
});

test('rejects invalid feet-and-inches values instead of calculating them', () => {
  assert.equal(feetInchesError('15.4'), null);
  assert.match(feetInchesError('15.12'), /0 to 11/);
  assert.match(feetInchesError('15.123'), /feet\.inches/);
  assert.match(feetInchesError('-2'), /feet\.inches/);
  assert.equal(parseFeetInches('15.12'), 0);
});

test('calculates area quantity from feet, inches, and count', () => {
  const item = { length: '10.6', width: '8.0', count: 2 };
  assert.equal(getItemQuantity(item, { type: 'area' }), 168);
});

test('prevents negative quantities and rates from producing negative amounts', () => {
  const item = { length: '10.0', width: '10.0', count: -2 };
  assert.equal(getLineAmount(item, { type: 'area', rate: 20 }), 0);
  assert.equal(getLineAmount({ ...item, count: 1 }, { type: 'area', rate: -20 }), 0);
});

test('flags incomplete measurements and invalid bill amounts', () => {
  const bill = {
    discount: 100,
    taxRate: 101,
    advance: 500,
    sections: [{
      areas: [{
        items: [{
          name: 'Floor tiles',
          rateId: 'tile',
          length: '15.12',
          width: '8.0',
          count: 1
        }]
      }]
    }]
  };
  const errors = getBillValidation(bill, [{ id: 'tile', name: 'Floor tiles', unit: 'sqft', type: 'area', rate: 20 }]);
  assert.ok(errors.some((error) => error.toLowerCase().includes('length')));
  assert.ok(errors.some((error) => error.includes('GST')));
  assert.ok(errors.some((error) => error.includes('Discount')));
  assert.ok(errors.some((error) => error.includes('Advance')));
});

test('calculates bill totals with discount, tax, and advance', () => {
  const bill = {
    discount: 100,
    taxRate: 10,
    advance: 250,
    sections: [{
      areas: [{
        items: [{ rateId: 'tile', length: '10.0', width: '10.0', count: 1 }]
      }]
    }]
  };
  const totals = getBillTotals(bill, [{ id: 'tile', type: 'area', rate: 20 }]);
  assert.deepEqual(totals, {
    subtotal: 2000,
    discount: 100,
    tax: 190,
    total: 2090,
    advance: 250,
    received: 0,
    paid: 250,
    balance: 1840
  });
});

test('derives payment status from the bill total and advance amount', () => {
  const rates = [{ id: 'item', type: 'count', rate: 100 }];
  const baseBill = { discount: 0, taxRate: 0, sections: [{ areas: [{ items: [{ rateId: 'item', count: 1 }] }] }] };
  assert.equal(getPaymentStatus({ ...baseBill, advance: 0 }, rates), 'unpaid');
  assert.equal(getPaymentStatus({ ...baseBill, advance: 50 }, rates), 'partial');
  assert.equal(getPaymentStatus({ ...baseBill, advance: 100 }, rates), 'paid');
  assert.equal(getPaymentStatus({ discount: 0, taxRate: 0, advance: 1, sections: [] }, rates), 'unpaid');
});

test('splits GST into CGST/SGST or IGST without changing the total tax', async () => {
  const { getTaxLines } = await import('../../src/domain/calculations.js');
  const totals = { tax: 2121 };
  assert.deepEqual(getTaxLines({ taxRate: '18' }, totals), [
    { label: 'CGST (9%)', amount: 1061 },
    { label: 'SGST (9%)', amount: 1060 }
  ]);
  assert.deepEqual(getTaxLines({ taxRate: '5', gstType: 'inter' }, { tax: 50 }), [{ label: 'IGST (5%)', amount: 50 }]);
  assert.deepEqual(getTaxLines({ taxRate: '5' }, { tax: 50 }).map((line) => line.label), ['CGST (2.5%)', 'SGST (2.5%)']);
  assert.deepEqual(getTaxLines({ taxRate: '' }, { tax: 0 }), []);
});

test('bills without GST ignore the tax rate', async () => {
  const { getBillTotals, hasGst } = await import('../../src/domain/calculations.js');
  const { getAmountErrors } = await import('../../src/domain/validation.js');
  const { createBill } = await import('../../src/domain/factories.js');
  const rates = [{ id: 'r', type: 'count', rate: 1000 }];
  const bill = { taxRate: '18', sections: [{ areas: [{ items: [{ rateId: 'r', count: 1 }] }] }] };
  assert.equal(hasGst(bill), true); // older bills keep GST
  assert.equal(getBillTotals(bill, rates).total, 1180);
  assert.equal(getBillTotals({ ...bill, gstEnabled: false }, rates).total, 1000);
  assert.equal(getAmountErrors({ ...bill, gstEnabled: false, taxRate: '500' }, rates).taxRate, '');
  assert.equal(createBill('1').gstEnabled, false);
  assert.equal(createBill('1', { gstEnabled: true }).gstEnabled, true);
});

test('firms that already used GST are treated as GST registered', async () => {
  const { hydrateState } = await import('../../src/domain/app-state.js');
  assert.equal(hydrateState({ bills: [{ id: 'a', taxRate: '18', sections: [] }] }).firm.gstRegistered, true);
  assert.equal(hydrateState({ bills: [{ id: 'a', sections: [] }], firm: { gstin: '27ABCDE1234F1Z5' } }).firm.gstRegistered, true);
  assert.equal(hydrateState({ bills: [{ id: 'a', sections: [] }] }).firm.gstRegistered, false);
  assert.equal(hydrateState({ bills: [{ id: 'a', taxRate: '18', sections: [] }], firm: { gstRegistered: false } }).firm.gstRegistered, false);
});

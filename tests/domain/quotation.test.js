import test from 'node:test';
import assert from 'node:assert/strict';
import { createDefaultQuotation, normalizeQuotation, quotationRows, splitLines, validUntil } from '../../src/domain/quotation.js';
import { hydrateState } from '../../src/domain/app-state.js';

test('quotation defaults, validity and rows', () => {
  const q = createDefaultQuotation();
  assert.equal(splitLines(q.terms).length, 4);
  assert.equal(validUntil({ validDays: 30 }, '2026-11-17'), '2026-12-17');
  assert.equal(validUntil({ validDays: 0 }, '2026-11-17'), '');
  assert.equal(normalizeQuotation({ validDays: '-3' }).validDays, 30);
  assert.deepEqual(
    quotationRows([{ name: 'Tiles', type: 'area', unit: 'sqft', rate: 85 }], { t: (s) => s, money: (v) => `R${v}` }),
    [['1', 'Tiles', 'Length × breadth', 'sqft', 'R85']]
  );
});

test('saved data gets a quotation', () => {
  const state = hydrateState({ bills: [{ id: 'a', sections: [] }], quotation: { clientName: 'Ravi' } });
  assert.equal(state.quotation.clientName, 'Ravi');
  assert.equal(state.quotation.title, 'Rate quotation');
});

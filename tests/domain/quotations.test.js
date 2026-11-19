import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addLine, createQuotation, finalizeQuotation, itemIds, newQuotationVersion, nextQuotationNumber, quotationLabel, quotationRates, quotationUsage,
  quotationsOfProject, quotedRates, rateUsage, removeLine, repriceBill, repriceDrafts, setLinePrice
} from '../../src/domain/quotations.js';
import { getBillTotals } from '../../src/domain/calculations.js';

const rates = [
  { id: 'r1', name: 'Tiles', unit: 'sqft', type: 'count', rate: 100 },
  { id: 'r2', name: 'Skirting', unit: 'rft', type: 'count', rate: 30 },
  { id: 'r3', name: 'Old work', unit: 'nos', type: 'count', rate: 5, archived: true }
];
const item = (id, rateId, rate, count = 1) => ({ id, rateId, name: 'x', unit: 'u', type: 'count', rate, count });
const bill = (id, items, extra = {}) => ({ id, number: id, discount: '', taxRate: 0, gstEnabled: false, advance: '', payments: [], sections: [{ id: `s${id}`, name: 'F', areas: [{ id: `a${id}`, name: 'R', items }] }], ...extra });

test('a quotation is a numbered draft copy of today’s standard rates (retired items left out)', () => {
  const first = createQuotation({ projectId: 'p', name: ' Sharma ', rates, quotations: [] });
  assert.equal(first.number, 'Q-0001');
  assert.equal(first.status, 'draft');
  assert.equal(first.name, 'Sharma');
  assert.deepEqual(first.lines.map((entry) => [entry.rateId, entry.rate]), [['r1', 100], ['r2', 30]]);
  assert.equal(nextQuotationNumber([first, { number: 'Q-0009' }]), 'Q-0010');
  assert.equal(createQuotation({ projectId: 'p', rates, quotations: [first] }).number, 'Q-0002');
});

test('a draft can be edited; final freezes it; a new version keeps the number and goes up one revision', () => {
  let quotation = createQuotation({ projectId: 'p', name: 'v', rates, quotations: [] });
  quotation = setLinePrice(quotation, 'r1', 80);
  quotation = removeLine(quotation, 'r2');
  quotation = addLine(quotation, rates[1]);
  assert.deepEqual(quotationRates(quotation).map((rate) => [rate.id, rate.rate]), [['r1', 80], ['r2', 30]]);
  assert.equal(addLine(quotation, rates[1]), quotation); // already there

  const final = finalizeQuotation(quotation, new Date('2026-03-01T00:00:00Z'));
  assert.equal(final.status, 'final');
  assert.equal(final.finalizedAt, '2026-03-01T00:00:00.000Z');
  assert.equal(finalizeQuotation(final), final);
  assert.equal(quotationLabel(final), 'Q-0001');

  const next = newQuotationVersion([{ ...final, version: 3, createdAt: 'x' }], { ...final, version: 3, createdAt: 'x' });
  assert.equal(next.number, 'Q-0001');
  assert.equal(next.rev, 2);
  assert.equal(next.status, 'draft');
  assert.equal(next.finalizedAt, undefined);
  assert.equal(next.createdAt, undefined); // a fresh record
  assert.notEqual(next.id, final.id);
  assert.equal(quotationLabel(next), 'Q-0001 v2');
  assert.equal(newQuotationVersion([final, next], final).rev, 3);
});

test('a quotation prices the Rates list: its lines override, other items keep the standard price', () => {
  let quotation = createQuotation({ projectId: 'p', rates, quotations: [] });
  quotation = removeLine(setLinePrice(quotation, 'r1', 70), 'r2');
  assert.deepEqual(quotedRates(rates, quotation).map((rate) => rate.rate), [70, 30, 5]);
  assert.equal(quotedRates(rates, null), rates);
  // a work item deleted since is still there, from the quotation's own copy
  const gone = quotedRates(rates.slice(1), quotation);
  assert.ok(gone.some((rate) => rate.id === 'r1' && rate.rate === 70));
});

test('quotations of a project, and how many bills use one', () => {
  const list = [{ id: 'a', projectId: 'p', number: 'Q-0001', rev: 1, createdAt: '2026-01-01' }, { id: 'b', projectId: 'q', number: 'Q-0002', rev: 1 }, { id: 'c', projectId: 'p', number: 'Q-0003', rev: 1, createdAt: '2026-02-01' }];
  assert.deepEqual(quotationsOfProject(list, 'p').map((entry) => entry.id), ['c', 'a']);
  assert.equal(quotationUsage('a', [{ quotationId: 'a' }, { quotationId: 'a' }, {}]), 2);
});

test('usage counts entries and the draft bills among them', () => {
  const bills = [
    bill('1', [item('i1', 'r1', 100), item('i2', 'r1', 100), item('i3', 'r2', 30)]),
    bill('2', [item('i4', 'r1', 100)], { status: 'ready' }),
    bill('3', [item('i5', 'r2', 30)])
  ];
  assert.deepEqual(rateUsage('r1', bills), { entries: 3, bills: 2, drafts: 1 });
  assert.deepEqual(rateUsage('r2', bills), { entries: 2, bills: 2, drafts: 2 });
  assert.deepEqual(rateUsage('nope', bills), { entries: 0, bills: 0, drafts: 0 });
});

test('re-pricing touches draft bills only, never a ready, submitted or cancelled one', () => {
  const draft = bill('1', [item('i1', 'r1', 100, 10)]);
  const others = [{ status: 'ready' }, { status: 'submitted' }, { cancelled: true }].map((extra, index) => bill(`o${index}`, [item(`x${index}`, 'r1', 100, 10)], extra));
  const [d, ...rest] = repriceDrafts([draft, ...others], 'r1', () => 120);
  assert.equal(getBillTotals(d, rates).total, 1200);
  for (const untouched of rest) assert.equal(getBillTotals(untouched, rates).total, 1000);
});

test('attaching a quotation re-prices a bill’s entries; entries added later from a template take the current price', () => {
  const quotation = setLinePrice(createQuotation({ projectId: 'p', rates, quotations: [] }), 'r1', 60);
  const draft = bill('1', [item('old', 'r1', 100, 10)]);
  assert.equal(getBillTotals(repriceBill(draft, quotedRates(rates, quotation)), rates).total, 600);
  assert.equal(getBillTotals(repriceBill(draft, quotedRates(rates, null)), rates).total, 1000); // back to standard rates

  const after = { ...draft, sections: [{ ...draft.sections[0], areas: [{ ...draft.sections[0].areas[0], items: [...draft.sections[0].areas[0].items, item('new', 'r1', 100, 1)] }] }] };
  const fixed = repriceBill(after, quotedRates(rates, quotation), itemIds(draft));
  const items = fixed.sections[0].areas[0].items;
  assert.equal(items.find((entry) => entry.id === 'old').rate, 100);
  assert.equal(items.find((entry) => entry.id === 'new').rate, 60);
});

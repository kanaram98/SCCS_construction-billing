import test from 'node:test';
import assert from 'node:assert/strict';
import { fromDocuments, toDocuments } from '../../src/backend/mapping.js';
import { COLLECTIONS, validateDocument } from '../../src/backend/schema.js';
import { liveState } from '../../src/domain/history.js';
import { liveLabour } from '../../src/domain/labour.js';
import { buildSampleState } from './sample-state.js';

const now = new Date(Date.UTC(2026, 10, 10));

test('every document made from a real state passes its validator', () => {
  const docs = toDocuments(buildSampleState());
  const problems = docs.map((doc) => validateDocument(doc.collection, doc.data)).filter(Boolean);
  assert.deepEqual(problems, []);
  const counts = Object.fromEntries(Object.values(COLLECTIONS).map((name) => [name, docs.filter((doc) => doc.collection === name).length]));
  assert.deepEqual(counts, {
    bills: 5, rates: 3, // 4 bills + the starting blank bill, now in the recycle bin
    clients: 1, templates: 1, settings: 5, workers: 1, labourPayments: 1,
    attendance: 2, closedMonths: 1, history: counts.history, labourLog: counts.labourLog
  });
  assert.ok(counts.history > 0 && counts.labourLog > 0);
  for (const doc of docs) assert.equal(doc.data.id, doc.id);
});

test('state → documents → state keeps everything (order, deleted records, history, labour)', () => {
  const raw = buildSampleState();
  const back = fromDocuments(toDocuments(raw), now);
  assert.deepEqual(back.bills.map((bill) => bill.id), raw.bills.map((bill) => bill.id));
  assert.equal(back.bills.find((bill) => bill.id === 'bill-3').deletedAt, raw.bills.find((bill) => bill.id === 'bill-3').deletedAt);
  assert.deepEqual(back.bills[0].sections, raw.bills[0].sections);
  assert.deepEqual(back.bills[0].payments, raw.bills[0].payments);
  assert.deepEqual(back.rates.map((rate) => rate.id), raw.rates.map((rate) => rate.id));
  assert.deepEqual(back.log.map((entry) => entry.id), raw.log.map((entry) => entry.id));
  assert.deepEqual([back.firm.name, back.firm.upiId, back.firm.version], [raw.firm.name, raw.firm.upiId, raw.firm.version]);
  assert.equal(back.quotation.clientName, 'Asha Builders');
  assert.equal(back.activeBillId, raw.activeBillId);
  assert.deepEqual(back.labour.attendance, raw.labour.attendance);
  assert.deepEqual(back.labour.closedMonths, raw.labour.closedMonths);
  assert.deepEqual(back.labour.log.map((entry) => entry.id), raw.labour.log.map((entry) => entry.id));
  assert.deepEqual(liveLabour(back.labour).payments, liveLabour(raw.labour).payments);
  assert.deepEqual(liveState(back).bills.length, 3);
});

test('unknown leftover fields are not sent; undefined values are dropped', () => {
  const raw = buildSampleState();
  raw.firm = { ...raw.firm, bank: 'old free-text bank field' };
  raw.bills = [{ ...raw.bills[0], convertedBillId: undefined, someOldField: 1 }, ...raw.bills.slice(1)];
  const docs = toDocuments(raw);
  const firm = docs.find((doc) => doc.id === 'firm').data;
  const bill = docs.find((doc) => doc.id === 'bill-1').data;
  assert.equal('bank' in firm, false);
  assert.equal('someOldField' in bill, false);
  assert.equal('convertedBillId' in bill, false);
  assert.equal(validateDocument('settings', firm), '');
});

test('validators reject bad documents with a clear reason', () => {
  const bill = toDocuments(buildSampleState()).find((doc) => doc.id === 'bill-1').data;
  assert.match(validateDocument('bills', { ...bill, version: 0 }), /version/);
  assert.match(validateDocument('bills', { ...bill, gstType: 'other' }), /gstType/);
  assert.match(validateDocument('bills', { ...bill, hacked: true }), /hacked|Unrecognized/i);
  assert.match(validateDocument('bills', { ...bill, projectName: 'x'.repeat(201) }), /projectName/);
  assert.match(validateDocument('labourPayments', { id: 'p', workerId: 'w', date: '3 Nov', amount: 1, mode: 'cash', note: '', createdAt: '', updatedAt: '', deletedAt: null, version: 1 }), /date/);
  assert.match(validateDocument('attendance', { id: '2026-11', marks: { '02': { w1: { units: 9, wage: 1, at: '' } } } }), /units/);
  assert.match(validateDocument('settings', { id: 'firm', name: 'x', logo: 'javascript:alert(1)' }), /firm/);
  assert.match(validateDocument('settings', { id: 'other' }), /Unknown/);
});

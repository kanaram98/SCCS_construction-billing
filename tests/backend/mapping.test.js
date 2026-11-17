import test from 'node:test';
import assert from 'node:assert/strict';
import { fromDocuments, toDocuments } from '../../src/backend/mapping.js';
import { COLLECTIONS, validateDocument } from '../../src/backend/schema.js';
import { liveState } from '../../src/domain/history.js';
import { liveLabour } from '../../src/domain/labour.js';
import { ADMIN_ONLY, can } from '../../src/domain/permissions.js';
import { buildSampleState } from './sample-state.js';

const now = new Date(Date.UTC(2026, 10, 10));
const BY = 'admin-uid';

test('every document made from a real state passes its validator', () => {
  const docs = toDocuments(buildSampleState(), { by: BY });
  const problems = docs.map((doc) => validateDocument(doc.collection, doc.data)).filter(Boolean);
  assert.deepEqual(problems, []);
  const counts = Object.fromEntries(Object.values(COLLECTIONS).map((name) => [name, docs.filter((doc) => doc.collection === name).length]));
  assert.deepEqual(counts, {
    members: 0, invites: 0, // managed separately, not part of app data
    bills: 5, // 4 bills + the starting blank bill, now in the recycle bin
    rates: 3, clients: 1, templates: 1, settings: 3, workers: 1, labourPayments: 1,
    attendance: 2, closedMonths: 1, history: counts.history, labourLog: counts.labourLog
  });
  assert.ok(counts.history > 0 && counts.labourLog > 0);
  for (const doc of docs) assert.equal(doc.data.id, doc.id);
});

test('every record and history entry says who made the change', () => {
  const docs = toDocuments(buildSampleState(), { by: BY });
  for (const doc of docs.filter((entry) => ['bills', 'rates', 'workers', 'labourPayments'].includes(entry.collection))) assert.equal(doc.data.updatedBy, BY);
  for (const doc of docs.filter((entry) => ['history', 'labourLog'].includes(entry.collection))) assert.equal(doc.data.by, BY);
  assert.equal(docs.find((doc) => doc.collection === 'closedMonths').data.closedBy, BY);
  // A change recorded by another account keeps its author.
  const raw = buildSampleState();
  raw.rates = [{ ...raw.rates[0], updatedBy: 'father-uid' }, ...raw.rates.slice(1)];
  assert.equal(toDocuments(raw, { by: BY }).find((doc) => doc.id === raw.rates[0].id).data.updatedBy, 'father-uid');
  assert.throws(() => toDocuments(raw, {}), /signed-in account/);
});

test('state → documents → state keeps everything; device-only settings come from this device', () => {
  const raw = buildSampleState();
  const local = { preferences: { language: 'hi', textSize: 'large' }, meta: { lastBackupAt: '', onboarded: true }, activeBillId: 'est-1' };
  const back = fromDocuments(toDocuments(raw, { by: BY }), { local }, now);
  assert.deepEqual(back.bills.map((bill) => bill.id), raw.bills.map((bill) => bill.id));
  assert.equal(back.bills.find((bill) => bill.id === 'bill-3').deletedAt, raw.bills.find((bill) => bill.id === 'bill-3').deletedAt);
  assert.deepEqual(back.bills[0].sections, raw.bills[0].sections);
  assert.deepEqual(back.bills[0].payments, raw.bills[0].payments);
  assert.deepEqual(back.rates.map((rate) => rate.id), raw.rates.map((rate) => rate.id));
  assert.deepEqual(back.log.map((entry) => entry.id), raw.log.map((entry) => entry.id));
  assert.deepEqual([back.firm.name, back.firm.upiId, back.firm.version], [raw.firm.name, raw.firm.upiId, raw.firm.version]);
  assert.equal(back.quotation.clientName, 'Asha Builders');
  assert.deepEqual([back.preferences.language, back.activeBillId, back.meta.onboarded], ['hi', 'est-1', true]);
  assert.deepEqual(back.labour.attendance, raw.labour.attendance);
  assert.deepEqual(Object.keys(back.labour.closedMonths), Object.keys(raw.labour.closedMonths));
  assert.deepEqual(back.labour.log.map((entry) => entry.id), raw.labour.log.map((entry) => entry.id));
  assert.deepEqual(liveLabour(back.labour).payments.map((payment) => payment.id), liveLabour(raw.labour).payments.map((payment) => payment.id));
  assert.equal(liveState(back).bills.length, 3); // bill-3 and the starting blank bill are in the recycle bin
});

test('unknown leftover fields are not sent; undefined values are dropped', () => {
  const raw = buildSampleState();
  raw.firm = { ...raw.firm, bank: 'old free-text bank field' };
  raw.bills = [{ ...raw.bills[0], convertedBillId: undefined, someOldField: 1 }, ...raw.bills.slice(1)];
  const docs = toDocuments(raw, { by: BY });
  const firm = docs.find((doc) => doc.id === 'firm').data;
  const bill = docs.find((doc) => doc.id === raw.bills[0].id).data;
  assert.equal('bank' in firm, false);
  assert.equal('someOldField' in bill, false);
  assert.equal('convertedBillId' in bill, false);
  assert.equal(validateDocument('settings', firm), '');
});

test('validators reject bad documents with a clear reason', () => {
  const bill = toDocuments(buildSampleState(), { by: BY }).find((doc) => doc.id === 'bill-1').data;
  assert.match(validateDocument('bills', { ...bill, version: 0 }), /version/);
  assert.match(validateDocument('bills', { ...bill, gstType: 'other' }), /gstType/);
  assert.match(validateDocument('bills', { ...bill, hacked: true }), /hacked|Unrecognized/i);
  assert.match(validateDocument('bills', { ...bill, projectName: 'x'.repeat(201) }), /projectName/);
  assert.match(validateDocument('bills', { ...bill, updatedBy: undefined }), /updatedBy/);
  assert.match(validateDocument('labourPayments', { id: 'p', workerId: 'w', date: '3 Nov', amount: 1, mode: 'cash', note: '', createdAt: '', updatedAt: '', deletedAt: null, version: 1, updatedBy: BY }), /date/);
  assert.match(validateDocument('attendance', { id: '2026-11', marks: { '02': { w1: { units: 9, wage: 1, at: '' } } } }), /units/);
  assert.match(validateDocument('settings', { id: 'firm', name: 'x', logo: 'javascript:alert(1)' }), /firm/);
  assert.match(validateDocument('settings', { id: 'preferences' }), /Unknown/);
  assert.match(validateDocument('members', { uid: 'u', name: 'Papa', email: 'not-an-email', role: 'contractor', addedAt: '' }), /email/);
  assert.match(validateDocument('invites', { email: 'papa@gmail.com', role: 'boss', invitedAt: '', invitedBy: BY }), /role/);
});

test('roles: the contractor does daily work, admin-only tools stay with the admin', () => {
  for (const action of ['editBill', 'deleteBill', 'markAttendance', 'addPayment', 'editRates', 'undo', 'restore', 'closeMonth']) {
    assert.equal(can('contractor', action), true, action);
  }
  for (const action of ADMIN_ONLY) {
    assert.equal(can('contractor', action), false, action);
    assert.equal(can('admin', action), true, action);
  }
  assert.equal(can(undefined, 'editBill'), false);
});

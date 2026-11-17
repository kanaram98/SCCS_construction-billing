import fs from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { toDocuments } from '../../src/backend/mapping.js';
import { docPath } from '../../src/backend/schema.js';
import { buildSampleState } from '../backend/sample-state.js';

const OWNER = 'owner-uid';
let env;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-sccs',
    firestore: { rules: fs.readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8080 }
  });
});

afterAll(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled((context) => setDoc(doc(context.firestore(), `owners/${OWNER}`), { note: 'allowed account' }));
});

const owner = () => env.authenticatedContext(OWNER).firestore();
const stranger = () => env.authenticatedContext('someone-else').firestore();
const docs = () => toDocuments(buildSampleState());
const billDoc = () => docs().find((entry) => entry.id === 'bill-1');
/** Writes a document the way the sync layer will: data plus the server time. */
const put = (db, entry, data = entry.data) => setDoc(doc(db, docPath(OWNER, entry.collection, entry.id)), { ...data, syncedAt: serverTimestamp() });

describe('who can use the database', () => {
  it('lets the owner write and read every kind of document', async () => {
    const db = owner();
    await assertSucceeds(setDoc(doc(db, `users/${OWNER}`), { schemaVersion: 1, createdAt: '2026-11-17T00:00:00Z', syncedAt: serverTimestamp() }));
    for (const entry of docs()) await assertSucceeds(put(db, entry));
    const bills = await assertSucceeds(getDocs(collection(db, `users/${OWNER}/bills`)));
    expect(bills.size).toBe(5);
  });

  it('keeps out signed-in accounts that are not on the allow-list, even in their own space', async () => {
    const db = stranger();
    await assertFails(setDoc(doc(db, 'users/someone-else/bills/b'), { ...billDoc().data, syncedAt: serverTimestamp() }));
    await assertFails(getDocs(collection(db, `users/${OWNER}/bills`)));
  });

  it('keeps out visitors who are not signed in', async () => {
    const db = env.unauthenticatedContext().firestore();
    await assertFails(getDoc(doc(db, docPath(OWNER, 'bills', 'bill-1'))));
    await assertFails(put(db, billDoc()));
  });

  it('never lets the app write the allow-list', async () => {
    await assertFails(setDoc(doc(owner(), `owners/${OWNER}`), { note: 'changed' }));
    await assertFails(setDoc(doc(owner(), 'owners/new-account'), {}));
    await assertSucceeds(getDoc(doc(owner(), `owners/${OWNER}`)));
  });
});

describe('validation of every write', () => {
  it('requires the server time in syncedAt', async () => {
    const entry = billDoc();
    await assertFails(setDoc(doc(owner(), docPath(OWNER, 'bills', entry.id)), { ...entry.data, syncedAt: new Date() }));
  });

  it('requires the document id to match its path', async () => {
    const entry = billDoc();
    await assertFails(setDoc(doc(owner(), docPath(OWNER, 'bills', 'other-id')), { ...entry.data, syncedAt: serverTimestamp() }));
  });

  it('rejects unknown fields, wrong types and oversized text', async () => {
    const entry = billDoc();
    await assertFails(put(owner(), entry, { ...entry.data, hacked: true }));
    await assertFails(put(owner(), entry, { ...entry.data, gstEnabled: 'yes' }));
    await assertFails(put(owner(), entry, { ...entry.data, gstType: 'other' }));
    await assertFails(put(owner(), entry, { ...entry.data, projectName: 'x'.repeat(201) }));
    await assertFails(put(owner(), entry, { ...entry.data, version: 0 }));
  });

  it('checks labour payments, rates and settings too', async () => {
    const all = docs();
    const payment = all.find((entry) => entry.collection === 'labourPayments');
    await assertFails(put(owner(), payment, { ...payment.data, date: '3 Nov' }));
    await assertFails(put(owner(), payment, { ...payment.data, mode: 'crypto' }));
    await assertFails(put(owner(), payment, { ...payment.data, amount: -5 }));
    const rate = all.find((entry) => entry.collection === 'rates');
    await assertFails(put(owner(), rate, { ...rate.data, type: 'weight' }));
    const firm = all.find((entry) => entry.id === 'firm');
    await assertFails(put(owner(), firm, { ...firm.data, logo: 'https://example.com/logo.png' }));
    await assertFails(put(owner(), { collection: 'settings', id: 'secret' }, { id: 'secret' }));
    const prefs = all.find((entry) => entry.id === 'preferences');
    await assertFails(put(owner(), prefs, { ...prefs.data, language: 'fr' }));
  });
});

describe('protection against lost changes', () => {
  it('rejects a stale write from another device (versions only go up)', async () => {
    const entry = billDoc();
    await assertSucceeds(put(owner(), entry, { ...entry.data, version: 3 }));
    await assertSucceeds(put(owner(), entry, { ...entry.data, version: 4, client: 'Phone' }));
    // The laptop still has version 4 and tries to save its own edit as version 4.
    await assertFails(put(owner(), entry, { ...entry.data, version: 4, client: 'Laptop' }));
    const saved = await getDoc(doc(owner(), docPath(OWNER, 'bills', entry.id)));
    expect(saved.data().client).toBe('Phone');
  });

  it('lets records be deleted for real only from the recycle bin', async () => {
    const entry = billDoc();
    await assertSucceeds(put(owner(), entry));
    await assertFails(deleteDoc(doc(owner(), docPath(OWNER, 'bills', entry.id))));
    await assertSucceeds(put(owner(), entry, { ...entry.data, version: entry.data.version + 1, deletedAt: '2026-11-17T10:00:00Z' }));
    await assertSucceeds(deleteDoc(doc(owner(), docPath(OWNER, 'bills', entry.id))));
  });

  it('keeps history append-only', async () => {
    const entry = docs().find((item) => item.collection === 'history');
    await assertSucceeds(put(owner(), entry));
    await assertFails(updateDoc(doc(owner(), docPath(OWNER, 'history', entry.id)), { action: 'create', syncedAt: serverTimestamp() }));
    await assertSucceeds(deleteDoc(doc(owner(), docPath(OWNER, 'history', entry.id)))); // trimming old history
  });

  it('updates attendance mark by mark, so devices do not overwrite each other', async () => {
    const month = docs().find((item) => item.collection === 'attendance' && item.id === '2026-11');
    const ref = doc(owner(), docPath(OWNER, 'attendance', month.id));
    await assertSucceeds(put(owner(), month));
    await assertSucceeds(updateDoc(ref, { 'marks.04.w1': { units: 1, wage: 700, at: '2026-11-04T09:00:00Z' }, syncedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(ref, { 'marks.04.w2': { units: 0.5, wage: 500, at: '2026-11-04T09:05:00Z' }, syncedAt: serverTimestamp() }));
    const saved = (await getDoc(ref)).data();
    expect(Object.keys(saved.marks['04']).sort()).toEqual(['w1', 'w2']);
    expect(saved.marks['02'].w1.units).toBe(2);
    await assertFails(deleteDoc(ref));
  });

  it('lets a closed month be unlocked but not edited', async () => {
    const closed = docs().find((item) => item.collection === 'closedMonths');
    const ref = doc(owner(), docPath(OWNER, 'closedMonths', closed.id));
    await assertSucceeds(put(owner(), closed));
    await assertFails(updateDoc(ref, { closedAt: 'later', syncedAt: serverTimestamp() }));
    await assertSucceeds(deleteDoc(ref));
  });
});

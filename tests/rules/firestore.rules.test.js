import fs from 'node:fs';
import { afterAll, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, deleteDoc, doc, getDoc, getDocs, setDoc, serverTimestamp, updateDoc } from 'firebase/firestore';
import { toDocuments } from '../../src/backend/mapping.js';
import { docPath } from '../../src/backend/schema.js';
import { buildSampleState } from '../backend/sample-state.js';

const WS = 'sccs';
const ADMIN = { uid: 'admin-uid', email: 'admin@example.com' };
const FATHER = { uid: 'father-uid', email: 'father@example.com' };
const STRANGER = { uid: 'stranger-uid', email: 'stranger@example.com' };
const NOW = '2026-11-17T10:00:00Z';
let env;

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-sccs',
    firestore: { rules: fs.readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8180 } // test-only emulator (firebase.e2e.json)
  });
});

afterAll(async () => {
  await env?.cleanup();
});

beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled((context) => setDoc(doc(context.firestore(), `owners/${ADMIN.email}`), { note: 'may create a workspace' }));
});

const as = (person) => env.authenticatedContext(person.uid, { email: person.email, email_verified: true }).firestore();
const stamp = (data) => ({ ...data, syncedAt: serverTimestamp() });
const memberDoc = (person, role) => stamp({ uid: person.uid, name: person.uid, email: person.email, role, addedAt: NOW });

/** Workspace with the admin and the father (contractor), set up without rules. */
async function seedWorkspace() {
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, `workspaces/${WS}`), { name: 'SCCS', schemaVersion: 1, createdAt: NOW, createdBy: ADMIN.uid });
    await setDoc(doc(db, docPath(WS, 'members', ADMIN.uid)), { uid: ADMIN.uid, name: 'Admin', email: ADMIN.email, role: 'admin', addedAt: NOW });
    await setDoc(doc(db, docPath(WS, 'members', FATHER.uid)), { uid: FATHER.uid, name: 'Papa', email: FATHER.email, role: 'contractor', addedAt: NOW });
  });
}

const sampleDocs = (person) => toDocuments(buildSampleState(), { by: person.uid });
const find = (docs, collection, id) => docs.find((entry) => entry.collection === collection && (!id || entry.id === id));
/** Writes a document the way the sync layer will: data plus the server time. */
const put = (db, entry, data = entry.data) => setDoc(doc(db, docPath(WS, entry.collection, entry.id)), stamp(data));

describe('setting up the workspace and inviting your father', () => {
  it('lets an account listed in owners create the workspace and become its admin', async () => {
    const db = as(ADMIN);
    await assertSucceeds(setDoc(doc(db, `workspaces/${WS}`), stamp({ name: 'SCCS', schemaVersion: 1, createdAt: NOW, createdBy: ADMIN.uid })));
    await assertSucceeds(setDoc(doc(db, docPath(WS, 'members', ADMIN.uid)), memberDoc(ADMIN, 'admin')));
    await assertSucceeds(getDoc(doc(db, `workspaces/${WS}`)));
  });

  it('does not let other accounts create a workspace or make themselves admin', async () => {
    await assertFails(setDoc(doc(as(STRANGER), 'workspaces/mine'), stamp({ name: 'X', schemaVersion: 1, createdAt: NOW, createdBy: STRANGER.uid })));
    await seedWorkspace();
    await assertFails(setDoc(doc(as(STRANGER), docPath(WS, 'members', STRANGER.uid)), memberDoc(STRANGER, 'admin')));
    await assertFails(setDoc(doc(as(STRANGER), docPath(WS, 'members', STRANGER.uid)), memberDoc(STRANGER, 'contractor')));
  });

  it('lets an invited account join with the invited role only', async () => {
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, `workspaces/${WS}`), { name: 'SCCS', schemaVersion: 1, createdAt: NOW, createdBy: ADMIN.uid });
      await setDoc(doc(db, docPath(WS, 'members', ADMIN.uid)), { uid: ADMIN.uid, name: 'Admin', email: ADMIN.email, role: 'admin', addedAt: NOW });
    });
    const invite = { email: FATHER.email, role: 'contractor', invitedAt: NOW, invitedBy: ADMIN.uid };
    await assertSucceeds(setDoc(doc(as(ADMIN), docPath(WS, 'invites', FATHER.email)), stamp(invite)));

    const father = as(FATHER);
    await assertSucceeds(getDoc(doc(father, docPath(WS, 'invites', FATHER.email))));
    await assertFails(setDoc(doc(father, docPath(WS, 'members', FATHER.uid)), memberDoc(FATHER, 'admin')));
    await assertSucceeds(setDoc(doc(father, docPath(WS, 'members', FATHER.uid)), memberDoc(FATHER, 'contractor')));
    await assertSucceeds(deleteDoc(doc(father, docPath(WS, 'invites', FATHER.email))));
    await assertSucceeds(getDocs(collection(father, `workspaces/${WS}/bills`)));
  });

  it('keeps members management with the admin, without locking the admin out', async () => {
    await seedWorkspace();
    const invite = stamp({ email: STRANGER.email, role: 'contractor', invitedAt: NOW, invitedBy: FATHER.uid });
    await assertFails(setDoc(doc(as(FATHER), docPath(WS, 'invites', STRANGER.email)), invite));
    await assertFails(setDoc(doc(as(FATHER), docPath(WS, 'members', FATHER.uid)), memberDoc(FATHER, 'admin')));
    await assertFails(deleteDoc(doc(as(ADMIN), docPath(WS, 'members', ADMIN.uid))));
    await assertSucceeds(deleteDoc(doc(as(ADMIN), docPath(WS, 'members', FATHER.uid))));
    await assertFails(getDocs(collection(as(FATHER), `workspaces/${WS}/bills`))); // removed: no access any more
  });

  it('never lets the app write the owners list, and keeps out non-members', async () => {
    await seedWorkspace();
    await assertFails(setDoc(doc(as(ADMIN), `owners/${FATHER.email}`), {}));
    await assertFails(getDocs(collection(as(STRANGER), `workspaces/${WS}/bills`)));
    await assertFails(getDoc(doc(env.unauthenticatedContext().firestore(), docPath(WS, 'bills', 'bill-1'))));
  });
});

describe('what the contractor (your father) can and cannot do', () => {
  beforeEach(seedWorkspace);

  it('does all daily work: bills, rates, clients, templates, quotation, labour, history', async () => {
    const db = as(FATHER);
    const docs = sampleDocs(FATHER).filter((entry) => entry.id !== 'firm');
    for (const entry of docs) await assertSucceeds(put(db, entry));
    const bills = await getDocs(collection(db, `workspaces/${WS}/bills`));
    expect(bills.size).toBe(5);
  });

  it('cannot change firm/bank details, delete forever, unlock a month or trim history', async () => {
    const docs = sampleDocs(ADMIN);
    for (const entry of docs) await assertSucceeds(put(as(ADMIN), entry));
    const father = as(FATHER);
    const firm = find(docs, 'settings', 'firm');
    await assertFails(put(father, firm, { ...firm.data, version: firm.data.version + 1, updatedBy: FATHER.uid, name: 'Changed' }));
    const deleted = docs.find((entry) => entry.collection === 'bills' && entry.data.deletedAt);
    await assertFails(deleteDoc(doc(father, docPath(WS, 'bills', deleted.id))));
    await assertFails(deleteDoc(doc(father, docPath(WS, 'closedMonths', find(docs, 'closedMonths').id))));
    await assertFails(deleteDoc(doc(father, docPath(WS, 'history', find(docs, 'history').id))));
    // The admin can.
    await assertSucceeds(put(as(ADMIN), firm, { ...firm.data, version: firm.data.version + 1, name: 'Changed' }));
    await assertSucceeds(deleteDoc(doc(as(ADMIN), docPath(WS, 'bills', deleted.id))));
    await assertSucceeds(deleteDoc(doc(as(ADMIN), docPath(WS, 'closedMonths', find(docs, 'closedMonths').id))));
  });

  it('can add rates, workers and payments but not change or delete them', async () => {
    const docs = sampleDocs(FATHER);
    const father = as(FATHER);
    const rate = find(docs, 'rates');
    const worker = find(docs, 'workers');
    const payment = find(docs, 'labourPayments');
    for (const entry of [rate, worker, payment]) await assertSucceeds(put(father, entry));
    // …but cannot edit them (new version), delete them (move to the recycle bin), or change a wage.
    await assertFails(put(father, rate, { ...rate.data, version: rate.data.version + 1, rate: 999 }));
    await assertFails(put(father, rate, { ...rate.data, version: rate.data.version + 1, deletedAt: NOW }));
    await assertFails(put(father, worker, { ...worker.data, version: worker.data.version + 1, dailyWage: 9999 }));
    await assertFails(put(father, worker, { ...worker.data, version: worker.data.version + 1, deletedAt: NOW }));
    await assertFails(put(father, payment, { ...payment.data, version: payment.data.version + 1, amount: 1 }));
    await assertFails(put(father, payment, { ...payment.data, version: payment.data.version + 1, deletedAt: NOW }));
    // He may mark a worker as left (and back).
    await assertSucceeds(put(father, worker, { ...worker.data, version: worker.data.version + 1, active: false }));
    await assertSucceeds(put(father, worker, { ...worker.data, version: worker.data.version + 2, active: true }));
    // Leaving also records the dates; nothing else may change with it.
    await assertSucceeds(put(father, worker, { ...worker.data, version: worker.data.version + 3, active: false, leftOn: '2026-11-10', joinedOn: '2026-01-01' }));
    await assertFails(put(father, worker, { ...worker.data, version: worker.data.version + 4, active: false, leftOn: '10 Nov', joinedOn: '2026-01-01' }));
    await assertFails(put(father, worker, { ...worker.data, version: worker.data.version + 4, active: false, leftOn: '2026-11-10', dailyWage: 1 }));
    // The admin can do all of it.
    const admin = as(ADMIN);
    await assertSucceeds(put(admin, rate, { ...rate.data, version: rate.data.version + 1, updatedBy: ADMIN.uid, rate: 999 }));
    await assertSucceeds(put(admin, worker, { ...worker.data, version: worker.data.version + 4, updatedBy: ADMIN.uid, dailyWage: 800 }));
    await assertSucceeds(put(admin, payment, { ...payment.data, version: payment.data.version + 1, updatedBy: ADMIN.uid, amount: 1500 }));
  });

  it('adds projects, advances and expenses; edits only expenses; the admin does everything', async () => {
    const docs = sampleDocs(FATHER);
    const father = as(FATHER);
    const project = find(docs, 'projects');
    const advance = find(docs, 'advances');
    const expense = find(docs, 'expenses');
    for (const entry of [project, advance, expense]) await assertSucceeds(put(father, entry));
    // He cannot change or delete a project or a client advance…
    await assertFails(put(father, project, { ...project.data, version: project.data.version + 1, status: 'completed' }));
    await assertFails(put(father, advance, { ...advance.data, version: advance.data.version + 1, amount: 1 }));
    await assertFails(put(father, advance, { ...advance.data, version: advance.data.version + 1, deletedAt: NOW }));
    // …but he can correct an expense he entered, and move it to the recycle bin.
    await assertSucceeds(put(father, expense, { ...expense.data, version: expense.data.version + 1, amount: 300 }));
    await assertSucceeds(put(father, expense, { ...expense.data, version: expense.data.version + 2, deletedAt: NOW }));
    // Bad values are refused.
    await assertFails(put(father, expense, { ...expense.data, version: expense.data.version + 3, category: 'gold' }));
    await assertFails(put(father, advance, { ...advance.data, version: advance.data.version + 5, mode: 'crypto' }));
    // The admin can edit all three.
    const admin = as(ADMIN);
    await assertSucceeds(put(admin, project, { ...project.data, version: project.data.version + 1, updatedBy: ADMIN.uid, status: 'completed' }));
    await assertSucceeds(put(admin, advance, { ...advance.data, version: advance.data.version + 1, updatedBy: ADMIN.uid, amount: 60000 }));
  });

  it('a bill may carry advance adjustments (a list, size limited)', async () => {
    const bill = find(sampleDocs(FATHER), 'bills', 'bill-1');
    const adjustments = [{ id: 'j1', advanceId: 'a1', amount: 500, date: '2026-11-02' }];
    await assertSucceeds(put(as(FATHER), bill, { ...bill.data, version: bill.data.version + 1, advanceAdjustments: adjustments }));
    await assertFails(put(as(FATHER), bill, { ...bill.data, version: bill.data.version + 2, advanceAdjustments: 'lots' }));
    await assertSucceeds(put(as(FATHER), bill, { ...bill.data, version: bill.data.version + 2, name: 'Ground floor marble' }));
    await assertFails(put(as(FATHER), bill, { ...bill.data, version: bill.data.version + 3, name: 42 }));
  });

  it('a project holds the client details (optional fields, size limited)', async () => {
    const project = find(sampleDocs(FATHER), 'projects');
    const withClient = { ...project.data, clientPhone: '98765', clientAddress: 'Jaipur', clientGstin: '08ABCDE1234F1Z5' };
    await assertSucceeds(put(as(FATHER), project, withClient));
    await assertFails(put(as(FATHER), project, { ...withClient, clientGstin: 'x'.repeat(201) }));
    await assertFails(put(as(FATHER), project, { ...withClient, clientEmail: 'a@b.c' }));
  });

  it('can move things to the recycle bin and restore them (both are edits)', async () => {
    const bill = find(sampleDocs(FATHER), 'bills', 'bill-1');
    const db = as(FATHER);
    await assertSucceeds(put(db, bill));
    await assertSucceeds(put(db, bill, { ...bill.data, version: bill.data.version + 1, deletedAt: NOW }));
    await assertSucceeds(put(db, bill, { ...bill.data, version: bill.data.version + 2, deletedAt: null }));
  });
});

describe('validation of every write', () => {
  beforeEach(seedWorkspace);

  it('requires the server time, a matching id and the writer recorded truthfully', async () => {
    const bill = find(sampleDocs(FATHER), 'bills', 'bill-1');
    const db = as(FATHER);
    await assertFails(setDoc(doc(db, docPath(WS, 'bills', bill.id)), { ...bill.data, syncedAt: new Date() }));
    await assertFails(setDoc(doc(db, docPath(WS, 'bills', 'other-id')), stamp(bill.data)));
    await assertFails(put(db, bill, { ...bill.data, updatedBy: 'made-up-person' }));
    await assertSucceeds(put(db, bill, { ...bill.data, updatedBy: ADMIN.uid })); // an older change by the admin, uploaded by father
    await assertFails(put(db, bill, { ...bill.data, version: bill.data.version + 1, updatedBy: ADMIN.uid })); // editing must be in his own name
  });

  it('rejects unknown fields, wrong types and oversized text', async () => {
    const bill = find(sampleDocs(FATHER), 'bills', 'bill-1');
    const db = as(FATHER);
    await assertFails(put(db, bill, { ...bill.data, hacked: true }));
    await assertFails(put(db, bill, { ...bill.data, gstEnabled: 'yes' }));
    await assertFails(put(db, bill, { ...bill.data, gstType: 'other' }));
    await assertFails(put(db, bill, { ...bill.data, projectName: 'x'.repeat(201) }));
    await assertFails(put(db, bill, { ...bill.data, version: 0 }));
  });

  it('checks labour payments, rates, settings and invites too', async () => {
    const docs = sampleDocs(FATHER);
    const db = as(FATHER);
    const payment = find(docs, 'labourPayments');
    await assertFails(put(db, payment, { ...payment.data, date: '3 Nov' }));
    await assertFails(put(db, payment, { ...payment.data, mode: 'crypto' }));
    await assertFails(put(db, payment, { ...payment.data, amount: -5 }));
    const rate = find(docs, 'rates');
    await assertFails(put(db, rate, { ...rate.data, type: 'weight' }));
    const adminFirm = find(sampleDocs(ADMIN), 'settings', 'firm');
    await assertFails(put(as(ADMIN), adminFirm, { ...adminFirm.data, logo: 'https://example.com/logo.png' }));
    await assertSucceeds(put(as(ADMIN), adminFirm, { ...adminFirm.data, version: adminFirm.data.version + 1, tagline: 'Specialist in marble' }));
    await assertFails(put(as(ADMIN), adminFirm, { ...adminFirm.data, version: adminFirm.data.version + 2, tagline: 'x'.repeat(201) }));
    await assertFails(put(db, { collection: 'settings', id: 'preferences' }, { id: 'preferences', language: 'hi' }));
    await assertFails(setDoc(doc(as(ADMIN), docPath(WS, 'invites', STRANGER.email)), stamp({ email: STRANGER.email, role: 'boss', invitedAt: NOW, invitedBy: ADMIN.uid })));
  });
});

describe('protection against lost changes', () => {
  beforeEach(seedWorkspace);

  it('rejects a stale write from another device (versions only go up)', async () => {
    const bill = find(sampleDocs(FATHER), 'bills', 'bill-1');
    await assertSucceeds(put(as(FATHER), bill, { ...bill.data, version: 3 }));
    await assertSucceeds(put(as(FATHER), bill, { ...bill.data, version: 4, client: 'From the phone' }));
    // The admin's laptop still has version 4 and tries to save its own edit as version 4.
    await assertFails(put(as(ADMIN), bill, { ...bill.data, version: 4, updatedBy: ADMIN.uid, client: 'From the laptop' }));
    const saved = await getDoc(doc(as(ADMIN), docPath(WS, 'bills', bill.id)));
    expect(saved.data().client).toBe('From the phone');
  });

  it('allows a real delete only from the recycle bin', async () => {
    const bill = find(sampleDocs(ADMIN), 'bills', 'bill-1');
    const db = as(ADMIN);
    await assertSucceeds(put(db, bill));
    await assertFails(deleteDoc(doc(db, docPath(WS, 'bills', bill.id))));
    await assertSucceeds(put(db, bill, { ...bill.data, version: bill.data.version + 1, deletedAt: NOW }));
    await assertSucceeds(deleteDoc(doc(db, docPath(WS, 'bills', bill.id))));
  });

  it('keeps history append-only', async () => {
    const entry = find(sampleDocs(FATHER), 'history');
    await assertSucceeds(put(as(FATHER), entry));
    await assertFails(updateDoc(doc(as(ADMIN), docPath(WS, 'history', entry.id)), { action: 'create', syncedAt: serverTimestamp() }));
  });

  it('updates attendance mark by mark, so two phones do not overwrite each other', async () => {
    const month = find(sampleDocs(FATHER), 'attendance', '2026-11');
    await assertSucceeds(put(as(FATHER), month));
    await assertSucceeds(updateDoc(doc(as(FATHER), docPath(WS, 'attendance', month.id)), { 'marks.04.w1': { units: 1, wage: 700, at: NOW }, syncedAt: serverTimestamp() }));
    await assertSucceeds(updateDoc(doc(as(ADMIN), docPath(WS, 'attendance', month.id)), { 'marks.04.w2': { units: 0.5, wage: 500, at: NOW }, syncedAt: serverTimestamp() }));
    const saved = (await getDoc(doc(as(ADMIN), docPath(WS, 'attendance', month.id)))).data();
    expect(Object.keys(saved.marks['04']).sort()).toEqual(['w1', 'w2']);
    expect(saved.marks['02'].w1.units).toBe(2);
    await assertFails(deleteDoc(doc(as(ADMIN), docPath(WS, 'attendance', month.id))));
  });

  it('refuses attendance and labour payments in a closed month, for everyone, until the admin unlocks it', async () => {
    const docs = sampleDocs(FATHER);
    const month = find(docs, 'attendance', '2026-10');
    const closed = find(docs, 'closedMonths');
    const payment = find(docs, 'labourPayments');
    await assertSucceeds(put(as(FATHER), month)); // still open: the marks went in before it was closed
    await assertSucceeds(put(as(FATHER), closed));
    // Closed: no new marks, no changed payment, no new payment dated in it.
    await assertFails(updateDoc(doc(as(FATHER), docPath(WS, 'attendance', month.id)), { 'marks.31.w1': { units: 1, wage: 700, at: NOW }, syncedAt: serverTimestamp() }));
    await assertFails(updateDoc(doc(as(ADMIN), docPath(WS, 'attendance', month.id)), { 'marks.30.w1': { units: 2, wage: 700, at: NOW }, syncedAt: serverTimestamp() }));
    const inOctober = { ...payment.data, id: 'late-pay', date: '2026-10-31' };
    await assertFails(put(as(FATHER), { collection: 'labourPayments', id: 'late-pay' }, inOctober));
    // Other months are unaffected.
    await assertSucceeds(put(as(FATHER), find(docs, 'attendance', '2026-11')));
    await assertSucceeds(put(as(FATHER), payment));
    // The admin unlocks the month, then it can be changed again.
    await assertSucceeds(deleteDoc(doc(as(ADMIN), docPath(WS, 'closedMonths', closed.id))));
    await assertSucceeds(updateDoc(doc(as(FATHER), docPath(WS, 'attendance', month.id)), { 'marks.31.w1': { units: 1, wage: 700, at: NOW }, syncedAt: serverTimestamp() }));
    await assertSucceeds(put(as(FATHER), { collection: 'labourPayments', id: 'late-pay' }, inOctober));
  });

  it('lets the contractor close a month, and only the admin unlock it', async () => {
    const closed = find(sampleDocs(FATHER), 'closedMonths');
    await assertSucceeds(put(as(FATHER), closed));
    await assertFails(updateDoc(doc(as(ADMIN), docPath(WS, 'closedMonths', closed.id)), { closedAt: 'later', syncedAt: serverTimestamp() }));
    await assertFails(deleteDoc(doc(as(FATHER), docPath(WS, 'closedMonths', closed.id))));
    await assertSucceeds(deleteDoc(doc(as(ADMIN), docPath(WS, 'closedMonths', closed.id))));
  });
});

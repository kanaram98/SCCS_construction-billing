/**
 * The real sync engine against the Firestore emulator, with two "phones":
 * the admin (creates the workspace and uploads) and the father (invited,
 * joins and downloads). Uses the real security rules.
 */
import fs from 'node:fs';
import * as firestore from 'firebase/firestore';
import { afterAll, afterEach, beforeAll, beforeEach, describe, expect, it } from 'vitest';
import { initializeTestEnvironment } from '@firebase/rules-unit-testing';
import { createSyncEngine } from '../../src/backend/cloud-sync.js';
import { inviteMember, joinWorkspace, listMembers, removeMember } from '../../src/backend/session.js';
import { createInitialState } from '../../src/domain/app-state.js';
import { liveState, recordChanges } from '../../src/domain/history.js';
import * as labourOps from '../../src/domain/labour-ops.js';
import { buildSampleState } from '../backend/sample-state.js';

const WS = 'sccs';
const ADMIN = { uid: 'admin-uid', email: 'admin@example.com', displayName: 'Admin' };
const FATHER = { uid: 'father-uid', email: 'father@example.com', displayName: 'Papa' };
let env;
const engines = [];

beforeAll(async () => {
  env = await initializeTestEnvironment({
    projectId: 'demo-sccs',
    firestore: { rules: fs.readFileSync('firestore.rules', 'utf8'), host: '127.0.0.1', port: 8180 } // test-only emulator (firebase.e2e.json)
  });
});
afterAll(async () => { await env?.cleanup(); });
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled((context) => firestore.setDoc(firestore.doc(context.firestore(), `owners/${ADMIN.email}`), {}));
});
afterEach(() => { engines.splice(0).forEach((engine) => engine.stop()); });

const dbFor = (person) => env.authenticatedContext(person.uid, { email: person.email, email_verified: true }).firestore();

/** A phone: raw state in memory, sync state in memory, and an engine. */
function phone(person, raw, syncState = null) {
  const device = { raw, syncState, conflicts: [], fromOthers: [], status: '' };
  const db = dbFor(person);
  device.cloud = { db, fs: firestore };
  device.engine = createSyncEngine({
    db, fs: firestore, wid: WS, uid: person.uid,
    getRaw: () => device.raw,
    applyRaw: (raw, conflicts = [], info = {}) => { device.raw = raw; device.conflicts.push(...conflicts); device.fromOthers.push(...(info.fromOthers || [])); },
    loadState: () => device.syncState,
    saveState: (state) => { device.syncState = state; },
    onStatus: (status) => { device.status = status; },
    onRefused: (items) => { device.refused = items; },
    onPending: (count) => { device.inFlight = count; }
  });
  engines.push(device.engine);
  device.edit = (change) => {
    device.raw = recordChanges(device.raw, change(liveState(device.raw)), new Date());
    return device.engine.push();
  };
  return device;
}

async function waitFor(check, timeout = 10000) {
  const start = Date.now();
  while (!check()) {
    if (Date.now() - start > timeout) throw new Error('Timed out waiting for sync');
    await new Promise((resolve) => setTimeout(resolve, 100));
  }
}

const bill = (device, id) => device.raw.bills.find((item) => item.id === id);
const editBill = (device, id, patch) => device.edit((live) => ({ ...live, bills: live.bills.map((item) => (item.id === id ? { ...item, ...patch } : item)) }));

/** Admin creates the workspace and uploads; father is invited, joins and downloads. */
async function setUpBoth() {
  const admin = phone(ADMIN, buildSampleState());
  expect(await joinWorkspace(admin.cloud, WS, ADMIN)).toEqual({ status: 'member', role: 'admin', created: true });
  await admin.engine.start();
  await inviteMember(admin.cloud, WS, { email: FATHER.email, role: 'contractor', invitedBy: ADMIN.uid });

  const father = phone(FATHER, { ...createInitialState(), preferences: { language: 'hi', textSize: 'normal' } });
  expect(await joinWorkspace(father.cloud, WS, FATHER)).toEqual({ status: 'member', role: 'contractor', joined: true });
  await father.engine.start();
  return { admin, father };
}

describe('sync between two phones', () => {
  it('uploads from the admin and downloads to the invited father', async () => {
    const { admin, father } = await setUpBoth();
    expect(admin.status).toBe('synced');
    expect(father.raw.bills.map((item) => item.id).sort()).toEqual(admin.raw.bills.map((item) => item.id).sort());
    expect(father.raw.labour.attendance).toEqual(admin.raw.labour.attendance);
    expect(father.raw.firm.name).toBe('SCCS');
    expect(father.raw.preferences.language).toBe('hi'); // his own language
    const members = await listMembers(admin.cloud, WS);
    expect(members.map((member) => `${member.email}:${member.role}`).sort()).toEqual(['admin@example.com:admin', 'father@example.com:contractor']);
  });

  it('sends a change from one phone to the other, with who made it', async () => {
    const { admin, father } = await setUpBoth();
    await editBill(father, 'bill-1', { client: 'Changed by Papa' });
    await waitFor(() => bill(admin, 'bill-1').client === 'Changed by Papa');
    expect(bill(admin, 'bill-1').updatedBy).toBe(FATHER.uid);
    await waitFor(() => admin.raw.log.some((entry) => entry.by === FATHER.uid && entry.refId === 'bill-1'));
  });

  it('resolves the same bill edited on both phones: newer wins, the other is kept in History', async () => {
    const { admin, father } = await setUpBoth();
    admin.engine.stop(); // admin is offline for a while
    await editBill(father, 'bill-1', { discount: '500' });
    admin.raw = recordChanges(admin.raw, ((live) => ({ ...live, bills: live.bills.map((item) => (item.id === 'bill-1' ? { ...item, discount: '300' } : item)) }))(liveState(admin.raw)), new Date());
    const back = phone(ADMIN, admin.raw, admin.syncState); // the same phone, back online
    await back.engine.start(); // the admin's write is refused: father's newer version wins
    expect(bill(back, 'bill-1').discount).toBe('500');
    expect(back.conflicts).toHaveLength(1);
    expect(back.raw.log.at(-1)).toMatchObject({ action: 'conflict', refId: 'bill-1', before: { discount: '300' } });
  });

  it('merges attendance marked on both phones on the same day', async () => {
    const { admin, father } = await setUpBoth();
    const ramesh = admin.raw.labour.workers[0];
    await admin.edit((live) => ({ ...live, labour: labourOps.addWorker(live.labour, { ...ramesh, id: 'w2', name: 'Suresh' }, new Date()) }));
    await waitFor(() => father.raw.labour.workers.some((worker) => worker.id === 'w2'));
    const suresh = father.raw.labour.workers.find((worker) => worker.id === 'w2');
    await Promise.all([
      admin.edit((live) => ({ ...live, labour: labourOps.markAttendance(live.labour, '2026-11-20', [{ worker: ramesh, units: 1 }], new Date()) })),
      father.edit((live) => ({ ...live, labour: labourOps.markAttendance(live.labour, '2026-11-20', [{ worker: suresh, units: 0.5 }], new Date()) }))
    ]);
    await waitFor(() => admin.raw.labour.attendance['2026-11-20']?.w2 && father.raw.labour.attendance['2026-11-20']?.w1);
    for (const device of [admin, father]) {
      const day = device.raw.labour.attendance['2026-11-20'];
      expect([day.w1.units, day.w2.units]).toEqual([1, 0.5]);
    }
  });

  it('stops syncing for someone the admin removes', async () => {
    const { admin, father } = await setUpBoth();
    await removeMember(admin.cloud, WS, FATHER.uid);
    await editBill(father, 'bill-1', { client: 'After removal' });
    expect(father.status).toBe('error');
    await new Promise((resolve) => setTimeout(resolve, 500));
    expect(bill(admin, 'bill-1').client).not.toBe('After removal');
  });

  it('puts back a change the contractor is not allowed to make (firm details)', async () => {
    const { admin, father } = await setUpBoth();
    await father.edit((live) => ({ ...live, firm: { ...live.firm, name: 'Papa Builders' } }));
    expect(father.raw.firm.name).toBe('SCCS');
    expect(father.refused).toEqual([{ collection: 'settings', id: 'firm' }]);
    expect(father.status).toBe('synced');
    expect(admin.raw.firm.name).toBe('SCCS');
  });

  it('puts back a rate or worker change the contractor is not allowed to make', async () => {
    const { admin, father } = await setUpBoth();
    const rate = father.raw.rates[0];
    await father.edit((live) => ({ ...live, rates: live.rates.map((item) => (item.id === rate.id ? { ...item, rate: 999 } : item)) }));
    expect(father.raw.rates.find((item) => item.id === rate.id).rate).toBe(rate.rate);
    expect(father.refused).toEqual([{ collection: 'rates', id: rate.id }]);
    expect(admin.raw.rates.find((item) => item.id === rate.id).rate).toBe(rate.rate);
    // Adding a rate is fine and reaches the admin.
    await father.edit((live) => ({ ...live, rates: [...live.rates, { id: 'new-rate', name: 'Plaster', unit: 'sqft', type: 'area', rate: 40 }] }));
    await waitFor(() => admin.raw.rates.some((item) => item.id === 'new-rate'));
  });

  it('Sync now confirms everything is uploaded and downloads what others changed', async () => {
    const { admin, father } = await setUpBoth();
    admin.raw = recordChanges(admin.raw, ((live) => ({ ...live, bills: live.bills.map((item) => (item.id === 'bill-1' ? { ...item, client: 'Quick edit' } : item)) }))(liveState(admin.raw)), new Date());
    expect(admin.engine.unsentCount()).toBeGreaterThan(0);
    const result = await admin.engine.syncNow();
    expect(result).toMatchObject({ ok: true, pending: 0 });
    expect(admin.engine.pendingCount()).toBe(0);
    // The father hears about it, and the change is attributed to someone else.
    await waitFor(() => bill(father, 'bill-1').client === 'Quick edit');
    expect(father.fromOthers.some((item) => item.id === 'bill-1' && item.by === ADMIN.uid)).toBe(true);
    // Nothing waiting any more on either phone.
    expect((await father.engine.syncNow()).ok).toBe(true);
  });

  it('keeps out an account that was never invited', async () => {
    const stranger = { uid: 'stranger', email: 'stranger@example.com' };
    expect(await joinWorkspace({ db: dbFor(stranger), fs: firestore }, WS, stranger)).toMatchObject({ status: 'no-access' });
  });
});

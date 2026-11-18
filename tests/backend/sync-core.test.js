import test from 'node:test';
import assert from 'node:assert/strict';
import { adoptCloud, applyIncoming, createSyncState, keyOf, planUpload } from '../../src/backend/sync-core.js';
import { toDocuments } from '../../src/backend/mapping.js';
import { createInitialState } from '../../src/domain/app-state.js';
import { liveState, purgeRecord, recordChanges, undoEntry } from '../../src/domain/history.js';
import * as ops from '../../src/domain/labour-ops.js';
import { buildSampleState } from './sample-state.js';

const at = (minute) => new Date(Date.UTC(2026, 10, 20, 9, minute));
const edit = (raw, change, minute) => recordChanges(raw, change(liveState(raw)), at(minute));
const editBill = (raw, id, patch, minute) => edit(raw, (live) => ({ ...live, bills: live.bills.map((bill) => (bill.id === id ? { ...bill, ...patch } : bill)) }), minute);

/** In-memory cloud that behaves like the security rules: versions only go up, marks change one by one. */
function createCloud() {
  const docs = new Map();
  let clock = 0;
  return {
    docs,
    /** Applies upload ops; returns ops rejected because the version did not go up. */
    apply(opsList) {
      const rejected = [];
      for (const op of opsList) {
        const key = keyOf(op.collection, op.id);
        const current = docs.get(key);
        if (op.kind === 'delete') { docs.set(key, { exists: false, syncedAt: ++clock }); continue; }
        if (op.kind === 'marks') {
          const marks = structuredClone(current?.data?.marks || {});
          for (const [path, mark] of Object.entries(op.set)) { const [day, worker] = path.split('.'); marks[day] = { ...(marks[day] || {}), [worker]: mark }; }
          for (const path of op.remove) { const [day, worker] = path.split('.'); delete marks[day]?.[worker]; if (marks[day] && !Object.keys(marks[day]).length) delete marks[day]; }
          docs.set(key, { exists: true, data: { id: op.id, marks }, syncedAt: ++clock });
          continue;
        }
        if (current?.exists && current.data.version !== undefined && op.data.version !== undefined && !(op.data.version > current.data.version)) {
          rejected.push(op);
          continue;
        }
        docs.set(key, { exists: true, data: structuredClone(op.data), syncedAt: ++clock });
      }
      return rejected;
    },
    /** Documents changed after `since` (like a query on syncedAt). */
    changedSince(since = 0) {
      return [...docs].filter(([, value]) => value.syncedAt > since).map(([key, value]) => {
        const [collection, id] = key.split('/');
        return { collection, id, exists: value.exists, data: value.data };
      });
    },
    get(collection, id) {
      const value = docs.get(keyOf(collection, id));
      return value && { collection, id, exists: value.exists, data: value.data };
    },
    get clock() { return clock; }
  };
}

/** One phone: its raw state, its sync state and the last cloud change it has seen. */
function device(raw, by) {
  return { raw, by, sync: createSyncState(), seen: 0 };
}

/** push then pull, like the sync engine; rejected writes fetch the cloud copy (conflict). */
function sync(phone, cloud, minute = 59) {
  const plan = planUpload(phone.raw, phone.sync, { by: phone.by });
  const rejected = cloud.apply(plan.ops);
  phone.sync = { ...phone.sync, sent: plan.sent, marks: plan.marks };
  for (const op of rejected) delete phone.sync.sent[keyOf(op.collection, op.id)];
  const incoming = [...cloud.changedSince(phone.seen), ...rejected.map((op) => cloud.get(op.collection, op.id))];
  const merged = applyIncoming(phone.raw, incoming, phone.sync, at(minute), { by: phone.by });
  phone.raw = merged.raw;
  phone.sync = { ...merged.syncState, sent: { ...merged.syncState.sent } };
  for (const op of rejected) {
    const cloudDoc = cloud.get(op.collection, op.id);
    phone.sync.sent[keyOf(op.collection, op.id)] = `v${cloudDoc.data.version}`;
  }
  phone.seen = cloud.clock;
  return merged.conflicts;
}

test('first upload sends everything once; nothing is re-sent until it changes', () => {
  const cloud = createCloud();
  const phone = device(buildSampleState(), 'admin');
  const first = planUpload(phone.raw, phone.sync, { by: 'admin' });
  assert.equal(first.ops.filter((op) => op.kind === 'set').length, toDocuments(phone.raw, { by: 'admin' }).filter((doc) => doc.collection !== 'attendance').length);
  sync(phone, cloud);
  assert.deepEqual(planUpload(phone.raw, phone.sync, { by: 'admin' }).ops, []);
  phone.raw = editBill(phone.raw, 'bill-1', { discount: '250' }, 1);
  const next = planUpload(phone.raw, phone.sync, { by: 'admin' }).ops;
  assert.deepEqual(next.filter((op) => op.collection === 'bills').map((op) => op.id), ['bill-1']);
  assert.ok(next.some((op) => op.collection === 'history'), 'the new history entry is sent too');
});

test('a second phone downloads everything and gets the same data', () => {
  const cloud = createCloud();
  const admin = device(buildSampleState(), 'admin');
  sync(admin, cloud);
  // Father's new phone: blank starter data, Hindi. On first sync it adopts the cloud copy.
  const fresh = { ...createInitialState(), preferences: { language: 'hi', textSize: 'normal' } };
  const adopted = adoptCloud(cloud.changedSince(0), fresh, at(10));
  const father = device(adopted.raw, 'father');
  father.sync = adopted.syncState;
  father.seen = cloud.clock;
  assert.equal(father.raw.preferences.language, 'hi', 'his own language stays');
  assert.equal(adoptCloud([], fresh), null, 'an empty cloud is not adopted');
  sync(father, cloud);
  assert.deepEqual(father.raw.bills.map((bill) => bill.id).sort(), admin.raw.bills.map((bill) => bill.id).sort());
  assert.deepEqual(father.raw.labour.attendance, admin.raw.labour.attendance);
  assert.equal(father.raw.firm.name, 'SCCS');
  assert.deepEqual(planUpload(father.raw, father.sync, { by: 'father' }).ops, [], 'nothing to send back');
});

test('edits on two phones to different bills both arrive', () => {
  const cloud = createCloud();
  const admin = device(buildSampleState(), 'admin');
  sync(admin, cloud);
  const father = device(structuredClone(admin.raw), 'father');
  father.sync = structuredClone(admin.sync);
  father.seen = admin.seen;
  admin.raw = editBill(admin.raw, 'bill-1', { client: 'From admin' }, 1);
  father.raw = editBill(father.raw, 'est-1', { client: 'From father' }, 2);
  sync(admin, cloud);
  sync(father, cloud);
  sync(admin, cloud);
  for (const phone of [admin, father]) {
    assert.equal(phone.raw.bills.find((bill) => bill.id === 'bill-1').client, 'From admin');
    assert.equal(phone.raw.bills.find((bill) => bill.id === 'est-1').client, 'From father');
  }
});

test('the same bill changed on both phones: newer wins, the other version is kept in History and can be brought back', () => {
  const cloud = createCloud();
  const admin = device(buildSampleState(), 'admin');
  sync(admin, cloud);
  const father = device(structuredClone(admin.raw), 'father');
  father.sync = structuredClone(admin.sync);
  father.seen = admin.seen;
  father.raw = editBill(father.raw, 'bill-1', { discount: '500' }, 1);
  sync(father, cloud); // father's change reaches the cloud first
  admin.raw = editBill(admin.raw, 'bill-1', { discount: '300' }, 2);
  const conflicts = sync(admin, cloud);
  assert.equal(conflicts.length, 1);
  const bill = admin.raw.bills.find((item) => item.id === 'bill-1');
  assert.equal(bill.discount, '500', 'the cloud version wins');
  const entry = admin.raw.log.at(-1);
  assert.deepEqual([entry.action, entry.before.discount], ['conflict', '300']);
  // Undo brings back this phone's version, which then syncs normally.
  admin.raw = undoEntry(admin.raw, entry.id, at(3));
  assert.equal(admin.raw.bills.find((item) => item.id === 'bill-1').discount, '300');
  sync(admin, cloud);
  sync(father, cloud);
  assert.equal(father.raw.bills.find((item) => item.id === 'bill-1').discount, '300');
});

test('attendance marked on two phones the same day merges mark by mark', () => {
  const cloud = createCloud();
  const admin = device(buildSampleState(), 'admin');
  sync(admin, cloud);
  const father = device(structuredClone(admin.raw), 'father');
  father.sync = structuredClone(admin.sync);
  father.seen = admin.seen;
  const ramesh = admin.raw.labour.workers[0];
  const suresh = { ...ramesh, id: 'w2', name: 'Suresh' };
  father.raw = { ...father.raw, labour: ops.addWorker(father.raw.labour, suresh, at(1)) };
  sync(father, cloud);
  sync(admin, cloud);
  admin.raw = { ...admin.raw, labour: ops.markAttendance(admin.raw.labour, '2026-11-20', [{ worker: ramesh, units: 1 }], at(5)) };
  father.raw = { ...father.raw, labour: ops.markAttendance(father.raw.labour, '2026-11-20', [{ worker: suresh, units: 0.5 }], at(6)) };
  sync(admin, cloud);
  sync(father, cloud);
  sync(admin, cloud);
  for (const phone of [admin, father]) {
    const day = phone.raw.labour.attendance['2026-11-20'];
    assert.deepEqual([day.w1.units, day.w2.units], [1, 0.5]);
  }
  // A mark cleared on one phone disappears on the other.
  father.raw = { ...father.raw, labour: ops.markAttendance(father.raw.labour, '2026-11-20', [{ worker: suresh, units: null }], at(7)) };
  sync(father, cloud);
  sync(admin, cloud);
  assert.equal(admin.raw.labour.attendance['2026-11-20'].w2, undefined);
  assert.equal(admin.raw.labour.attendance['2026-11-20'].w1.units, 1);
});

test('a record deleted forever by the admin disappears on the other phone; unlocking a month too', () => {
  const cloud = createCloud();
  const admin = device(buildSampleState(), 'admin');
  sync(admin, cloud);
  const father = device(structuredClone(admin.raw), 'father');
  father.sync = structuredClone(admin.sync);
  father.seen = admin.seen;
  const binned = admin.raw.bills.find((bill) => bill.deletedAt);
  admin.raw = { ...admin.raw, bills: admin.raw.bills.filter((bill) => bill.id !== binned.id) };
  const { [Object.keys(admin.raw.labour.closedMonths)[0]]: _unlocked, ...stillClosed } = admin.raw.labour.closedMonths;
  admin.raw = { ...admin.raw, labour: { ...admin.raw.labour, closedMonths: stillClosed } };
  const plan = planUpload(admin.raw, admin.sync, { by: 'admin' });
  assert.ok(plan.ops.some((op) => op.kind === 'delete' && op.id === binned.id));
  assert.ok(plan.ops.some((op) => op.kind === 'delete' && op.collection === 'closedMonths'));
  sync(admin, cloud);
  sync(father, cloud);
  assert.equal(father.raw.bills.some((bill) => bill.id === binned.id), false);
  assert.deepEqual(father.raw.labour.closedMonths, {});
  // The contractor's phone must not try to delete them from the cloud itself (only an admin may).
  const retry = planUpload(father.raw, father.sync, { by: 'father' });
  assert.deepEqual(retry.ops.filter((op) => op.kind === 'delete'), []);
});

test('a labour payment changed on both phones keeps the other version in the labour History', () => {
  const cloud = createCloud();
  const admin = device(buildSampleState(), 'admin');
  sync(admin, cloud);
  const father = device(structuredClone(admin.raw), 'father');
  father.sync = structuredClone(admin.sync);
  father.seen = admin.seen;
  const paymentId = admin.raw.labour.payments[0].id;
  const values = { ...admin.raw.labour.payments[0] };
  father.raw = { ...father.raw, labour: ops.updatePayment(father.raw.labour, paymentId, { ...values, amount: 2500 }, at(1)) };
  sync(father, cloud);
  admin.raw = { ...admin.raw, labour: ops.updatePayment(admin.raw.labour, paymentId, { ...values, amount: 1800 }, at(2)) };
  sync(admin, cloud);
  assert.equal(admin.raw.labour.payments[0].amount, 2500);
  const entry = admin.raw.labour.log.at(-1);
  assert.deepEqual([entry.entity, entry.action, entry.before.amount], ['payment', 'conflict', 1800]);
});

test('a permanent delete and a month unlock reach the other phone through History', () => {
  const cloud = createCloud();
  const admin = device(buildSampleState(), 'admin');
  sync(admin, cloud);
  const father = device(structuredClone(admin.raw), 'father');
  father.sync = structuredClone(admin.sync);
  father.seen = admin.seen;
  const binned = admin.raw.bills.find((bill) => bill.deletedAt);
  admin.raw = purgeRecord(admin.raw, 'bills', binned.id, at(1));
  admin.raw = { ...admin.raw, labour: ops.unlockMonth(admin.raw.labour, Object.keys(admin.raw.labour.closedMonths)[0], at(2)) };
  const plan = planUpload(admin.raw, admin.sync, { by: 'admin' });
  // The cloud applies the uploads but its change feed misses the deletes.
  cloud.apply(plan.ops.filter((op) => op.kind !== 'delete'));
  admin.sync = { ...admin.sync, sent: plan.sent, marks: plan.marks };
  sync(father, cloud);
  assert.equal(father.raw.bills.some((bill) => bill.id === binned.id), false);
  assert.deepEqual(father.raw.labour.closedMonths, {});
  // The contractor's phone must not try to delete them from the cloud itself (only an admin may).
  assert.deepEqual(planUpload(father.raw, father.sync, { by: 'father' }).ops.filter((op) => op.kind === 'delete'), []);
});

test('joining a workspace keeps what this phone already had (labour entries, bills) and uploads it', () => {
  const cloud = createCloud();
  const admin = device(buildSampleState(), 'admin');
  sync(admin, cloud);
  // Father used the phone before signing in: a worker, attendance, and a real bill.
  let local = createInitialState();
  const own = { id: 'w9', name: 'Mohan', dailyWage: 500, role: '', phone: '', active: true, createdAt: '', updatedAt: '', deletedAt: null, version: 1 };
  local = { ...local, labour: ops.addWorker(local.labour, own, at(1)) };
  local = { ...local, labour: ops.markAttendance(local.labour, '2026-11-21', [{ worker: own, units: 1 }], at(2)) };
  local = { ...local, bills: [...local.bills, { ...local.bills[0], id: 'own-bill', projectName: 'Gupta shop' }] };
  const adopted = adoptCloud(cloud.changedSince(0), local, at(10));
  assert.ok(adopted.raw.labour.workers.some((worker) => worker.id === 'w9'));
  assert.equal(adopted.raw.labour.attendance['2026-11-21'].w9.units, 1);
  assert.ok(adopted.raw.bills.some((bill) => bill.id === 'own-bill'));
  assert.equal(adopted.raw.bills.some((bill) => bill.id === local.bills[0].id), false, 'the empty starter bill is not added');
  assert.ok(adopted.raw.bills.some((bill) => bill.id === 'bill-1'), 'the cloud data is there');
  const father = device(adopted.raw, 'father');
  father.sync = adopted.syncState;
  father.seen = cloud.clock;
  sync(father, cloud);
  sync(admin, cloud);
  assert.ok(admin.raw.labour.workers.some((worker) => worker.id === 'w9'));
  assert.equal(admin.raw.labour.attendance['2026-11-21'].w9.units, 1);
  assert.ok(admin.raw.bills.some((bill) => bill.id === 'own-bill'));
});

test('uploads unlock a month first, send marks and payments next, and close a month last', async () => {
  const { runInPhases, opPhase } = await import('../../src/backend/sync-core.js');
  const ops = [
    { kind: 'set', collection: 'closedMonths', id: '2026-10' },
    { kind: 'marks', collection: 'attendance', id: '2026-10' },
    { kind: 'delete', collection: 'closedMonths', id: '2026-09' },
    { kind: 'set', collection: 'labourPayments', id: 'p1' }
  ];
  assert.deepEqual(ops.map(opPhase), [2, 1, 0, 1]);
  const order = [];
  const results = await runInPhases(ops, async (op) => {
    await new Promise((resolve) => setTimeout(resolve, op.collection === 'attendance' ? 15 : 1)); // the slow one must still finish before the lock
    order.push(`${op.kind}:${op.collection}`);
    if (op.id === 'p1') throw new Error('refused');
  });
  assert.deepEqual(order.slice(0, 1), ['delete:closedMonths']);
  assert.equal(order.at(-1), 'set:closedMonths');
  assert.deepEqual(results.map((result) => result.status), ['fulfilled', 'fulfilled', 'fulfilled', 'rejected']); // aligned with ops
});

test('batches many writes, and falls back to single writes when a batch is refused', async () => {
  const { runInPhases, BATCH_SIZE } = await import('../../src/backend/sync-core.js');
  const many = Array.from({ length: BATCH_SIZE + 5 }, (_unused, index) => ({ kind: 'set', collection: 'history', id: `h${index}` }));
  const batches = [];
  const single = [];
  const results = await runInPhases(many, async (op) => { single.push(op.id); }, async (chunk) => { batches.push(chunk.length); });
  assert.deepEqual(batches, [BATCH_SIZE, 5]);
  assert.equal(single.length, 0);
  assert.ok(results.every((result) => result.status === 'fulfilled'));

  // One bad item: its batch is refused, then each item is tried alone and only the bad one fails.
  const some = [{ kind: 'set', collection: 'bills', id: 'good' }, { kind: 'set', collection: 'bills', id: 'bad' }];
  const outcome = await runInPhases(some, async (op) => { if (op.id === 'bad') throw new Error('refused'); }, async () => { throw new Error('batch refused'); });
  assert.deepEqual(outcome.map((result) => result.status), ['fulfilled', 'rejected']);
});

test('a new bill from the cloud is placed newest first, and cloud bills load newest first', () => {
  const state = createInitialState();
  const mk = (id, createdAt) => ({ ...state.bills[0], id, createdAt, updatedAt: createdAt, version: 1 });
  const base = { ...state, bills: [mk('b-new', '2026-11-10T00:00:00.000Z'), mk('b-old', '2026-11-01T00:00:00.000Z')] };
  const incoming = [{ collection: 'bills', id: 'b-mid', exists: true, data: { ...mk('b-mid', '2026-11-05T00:00:00.000Z'), order: 0, syncedAt: 1 } }];
  const merged = applyIncoming(base, incoming, createSyncState(), new Date('2026-11-18T00:00:00Z'), { by: 'u' });
  assert.deepEqual(merged.raw.bills.map((bill) => bill.id), ['b-new', 'b-mid', 'b-old']);
});

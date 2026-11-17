import test from 'node:test';
import assert from 'node:assert/strict';
import { adoptCloud, applyIncoming, createSyncState, keyOf, planUpload } from '../../src/backend/sync-core.js';
import { toDocuments } from '../../src/backend/mapping.js';
import { createInitialState } from '../../src/domain/app-state.js';
import { liveState, recordChanges, undoEntry } from '../../src/domain/history.js';
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

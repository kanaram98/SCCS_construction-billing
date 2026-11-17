import test from 'node:test';
import assert from 'node:assert/strict';
import { createInitialState, hydrateState } from '../../src/domain/app-state.js';
import {
  HISTORY_MAX, SNAPSHOTS_KEPT, liveState, pruneHistory, purgeRecord, recordChanges, recycleBin,
  restoreRecord, undoBlocker, undoEntry
} from '../../src/domain/history.js';

const at = (minute, day = 17) => new Date(Date.UTC(2026, 10, day, 10, minute));

/** Applies `change` to the live view and records it, like the store does. */
function apply(raw, change, now) {
  return recordChanges(raw, change(liveState(raw)), now);
}

function start() {
  const raw = createInitialState();
  return apply(raw, (live) => ({ ...live, bills: live.bills.map((bill) => ({ ...bill, projectName: 'Villa' })) }), at(0, 1));
}

test('a new record is stamped and logged as created', () => {
  const raw = apply(createInitialState(), (live) => ({ ...live, clients: [{ id: 'c1', name: 'Asha' }] }), at(0));
  assert.deepEqual([raw.clients[0].version, raw.clients[0].deletedAt, raw.clients[0].createdAt], [1, null, at(0).toISOString()]);
  assert.deepEqual(raw.log.map((entry) => [entry.entity, entry.action, entry.label.name]), [['clients', 'create', 'Asha']]);
});

test('typing in a bill is merged into one history entry that keeps the state before', () => {
  let raw = start();
  const id = raw.bills[0].id;
  const logLength = raw.log.length;
  raw = apply(raw, (live) => ({ ...live, bills: live.bills.map((bill) => ({ ...bill, client: 'A' })) }), at(1));
  raw = apply(raw, (live) => ({ ...live, bills: live.bills.map((bill) => ({ ...bill, client: 'As' })) }), at(2));
  raw = apply(raw, (live) => ({ ...live, bills: live.bills.map((bill) => ({ ...bill, discount: '100' })) }), at(3));
  assert.equal(raw.log.length, logLength + 1);
  const entry = raw.log.at(-1);
  assert.deepEqual([entry.action, entry.refId, entry.before.client], ['update', id, '']);
  assert.deepEqual(entry.fields.sort(), ['client', 'discount']);
  assert.equal(raw.bills[0].version, 5);
  // Much later, a new edit starts a new entry.
  raw = apply(raw, (live) => ({ ...live, bills: live.bills.map((bill) => ({ ...bill, client: 'Asha' })) }), at(40));
  assert.equal(raw.log.length, logLength + 2);
});

test('undo puts the bill back as it was before the edits', () => {
  let raw = start();
  raw = apply(raw, (live) => ({ ...live, bills: live.bills.map((bill) => ({ ...bill, client: 'Wrong', discount: '999' })) }), at(1));
  const edit = raw.log.at(-1);
  raw = undoEntry(raw, edit.id, at(2));
  assert.deepEqual([raw.bills[0].client, raw.bills[0].discount, raw.bills[0].projectName], ['', '', 'Villa']);
  assert.equal(raw.log.at(-1).revertOf, edit.id);
  assert.equal(undoBlocker(raw, edit), 'reverted');
});

test('removing a record is a soft delete; it can be restored, undone or purged', () => {
  let raw = start();
  raw = apply(raw, (live) => ({ ...live, rates: live.rates.filter((rate) => rate.id !== 'skirting') }), at(1));
  const deletion = raw.log.at(-1);
  assert.ok(raw.rates.find((rate) => rate.id === 'skirting').deletedAt);
  assert.equal(liveState(raw).rates.some((rate) => rate.id === 'skirting'), false);
  assert.deepEqual(recycleBin(raw).map((item) => [item.entity, item.id]), [['rates', 'skirting']]);

  // Unrelated changes keep the deleted record.
  raw = apply(raw, (live) => ({ ...live, rates: live.rates.map((rate) => ({ ...rate, rate: rate.rate + 1 })) }), at(2));
  assert.ok(raw.rates.find((rate) => rate.id === 'skirting').deletedAt);

  raw = restoreRecord(raw, 'rates', 'skirting', at(3));
  assert.equal(liveState(raw).rates.some((rate) => rate.id === 'skirting'), true);
  const restore = raw.log.at(-1);
  raw = undoEntry(raw, restore.id, at(4)); // undo the restore: deleted again
  assert.ok(raw.rates.find((rate) => rate.id === 'skirting').deletedAt);
  raw = purgeRecord(raw, 'rates', 'skirting', at(5));
  assert.equal(raw.rates.some((rate) => rate.id === 'skirting'), false);
  assert.equal(raw.log.at(-1).action, 'purge');
  assert.equal(undoBlocker(raw, restore), 'reverted');
  assert.equal(undoBlocker(raw, deletion), 'missing'); // deleted forever
});

test('deleting the active bill picks another; undo of the delete brings it back', () => {
  let raw = start();
  raw = apply(raw, (live) => ({ ...live, bills: [...live.bills, { id: 'b2', number: '2', sections: [] }] }), at(1));
  const first = raw.bills[0].id;
  raw = apply(raw, (live) => ({ ...live, bills: live.bills.filter((bill) => bill.id !== first) }), at(2));
  assert.equal(liveState(raw).activeBillId, 'b2');
  const deletion = raw.log.at(-1);
  assert.deepEqual([deletion.action, deletion.label.number], ['delete', '1']);
  raw = undoEntry(raw, deletion.id, at(3));
  assert.equal(liveState(raw).bills.length, 2);
});

test('firm edits are logged without the logo, signature or signature layout', () => {
  let raw = start();
  raw = apply(raw, (live) => ({ ...live, firm: { ...live.firm, signatureLayout: { ...live.firm.signatureLayout, x: 5 } } }), at(1));
  assert.equal(raw.log.some((entry) => entry.entity === 'firm'), false);
  raw = apply(raw, (live) => ({ ...live, firm: { ...live.firm, name: 'New name' } }), at(2));
  const edit = raw.log.at(-1);
  assert.deepEqual([edit.entity, edit.fields], ['firm', ['name']]);
  assert.equal('logo' in edit.before, false);
  raw = undoEntry(raw, edit.id, at(3));
  assert.equal(raw.firm.name, createInitialState().firm.name);
  assert.equal(raw.firm.logo, createInitialState().firm.logo); // logo untouched by undo
});

test('history is trimmed: old entries go, and only the newest edits keep an undo copy', () => {
  const now = at(0);
  const entries = Array.from({ length: HISTORY_MAX + 10 }, (_unused, index) => ({
    id: `e${index}`, at: now.toISOString(), entity: 'bills', action: 'update', refId: 'b', before: { n: index }
  }));
  const old = { id: 'old', at: '2025-01-01T00:00:00Z', entity: 'bills', action: 'create', refId: 'b' };
  const pruned = pruneHistory([old, ...entries], now);
  assert.equal(pruned.length, HISTORY_MAX);
  assert.equal(pruned.filter((entry) => entry.before).length, SNAPSHOTS_KEPT);
  assert.ok(pruned.at(-1).before);
  assert.equal(undoBlocker({ bills: [{ id: 'b' }], log: pruned }, pruned[0]), 'trimmed');
});

test('loading saved data adds metadata and empties the recycle bin after 30 days', () => {
  const saved = createInitialState();
  saved.bills = [
    { id: 'b1', number: '1', sections: [] },
    { id: 'gone', number: '2', sections: [], deletedAt: '2026-09-01T00:00:00Z' },
    { id: 'recent', number: '3', sections: [], deletedAt: '2026-11-10T00:00:00Z' }
  ];
  const state = hydrateState(saved, at(0));
  assert.deepEqual(state.bills.map((bill) => bill.id), ['b1', 'recent']);
  assert.deepEqual([state.bills[0].version, state.bills[0].deletedAt], [1, null]);
});

import test from 'node:test';
import assert from 'node:assert/strict';
import { applyIncoming, createSyncState, planUpload } from '../../src/backend/sync-core.js';
import { WIPE_ENABLED } from '../../src/config/app.js';
import { createInitialState } from '../../src/domain/app-state.js';
import { createWorker } from '../../src/domain/labour.js';

const withWorker = () => {
  const raw = createInitialState();
  const worker = { ...createWorker({ id: 'w1', name: 'Ramesh', dailyWage: 700 }, new Date('2026-11-01T10:00:00Z')), version: 2, deletedAt: '2026-11-02T10:00:00.000Z' };
  return { ...raw, labour: { ...raw.labour, workers: [worker] } };
};

test('a record removed here does not come back from an older copy in the cloud, but does from a newer one', () => {
  const raw = withWorker();
  let state = { ...createSyncState(), sent: { 'workers/w1': 'v2' } };
  const removed = { ...raw, labour: { ...raw.labour, workers: [] } };
  const plan = planUpload(removed, state, { by: 'u1' });
  assert.ok(plan.ops.some((op) => op.kind === 'delete' && op.collection === 'workers' && op.id === 'w1'));
  assert.equal(plan.deleted['workers/w1'], 2);
  state = { ...state, sent: plan.sent, marks: plan.marks, deleted: plan.deleted };

  const stale = { collection: 'workers', id: 'w1', exists: true, data: { ...raw.labour.workers[0], syncedAt: '2026-11-02T10:00:01Z' } };
  const old = applyIncoming(removed, [stale], state, new Date(), { by: 'u1' });
  assert.deepEqual(old.raw.labour.workers, []); // ignored
  assert.equal(planUpload(old.raw, old.syncState, { by: 'u1' }).ops.filter((op) => op.kind === 'set' && op.collection === 'workers').length, 0); // and not sent again

  const newer = applyIncoming(removed, [{ ...stale, data: { ...stale.data, version: 3 } }], state, new Date(), { by: 'u1' });
  assert.equal(newer.raw.labour.workers.length, 1); // someone changed it after: it is back
  const gone = applyIncoming(removed, [{ collection: 'workers', id: 'w1', exists: false, data: null }], state, new Date(), { by: 'u1' });
  assert.equal(gone.syncState.deleted['workers/w1'], undefined); // the cloud confirms it is gone
});

test('items the server refused stay remembered when other changes arrive', () => {
  const state = { ...createSyncState(), blocked: { 'bills/b1': { print: 'v3', code: 'permission-denied' } } };
  const result = applyIncoming(createInitialState(), [], state, new Date(), { by: 'u1' });
  assert.deepEqual(result.syncState.blocked, state.blocked);
});

test('Delete everything is offered in the test copy only (off by default, as in the real app)', () => {
  assert.equal(WIPE_ENABLED, false);
});

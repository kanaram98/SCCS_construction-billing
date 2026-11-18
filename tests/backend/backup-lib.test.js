import test from 'node:test';
import assert from 'node:assert/strict';
import { backupStamp, buildBackup, plainData } from '../../scripts/backup-lib.mjs';
import { toDocuments } from '../../src/backend/mapping.js';
import { parseBackup } from '../../src/domain/backup.js';
import { buildSampleState } from './sample-state.js';

// What the cloud returns: the app's documents plus a server timestamp on each.
const cloudDocs = () => toDocuments(buildSampleState(), { by: 'admin-uid' }).map((doc) => ({
  collection: doc.collection, id: doc.id, data: { ...doc.data, syncedAt: { toDate: () => new Date('2026-11-18T01:00:00Z') } }
}));

test('a cloud copy becomes a backup file the app can restore', () => {
  const { app, documents, counts } = buildBackup(cloudDocs(), new Date('2026-11-18T20:30:00Z'));
  const restored = parseBackup(JSON.stringify(app));
  const live = cloudDocs().filter((doc) => doc.collection === 'bills' && !doc.data.deletedAt).length;
  assert.ok(live >= 3);
  assert.equal(restored.billCount, live); // bills in the recycle bin are not counted but are kept
  assert.ok(restored.state.bills.length > live);
  assert.ok(restored.state.labour.workers.length > 0);
  assert.ok(restored.state.projects.length > 0);
  assert.equal(documents.length, cloudDocs().length);
  assert.equal(counts.bills, cloudDocs().filter((doc) => doc.collection === 'bills').length);
  assert.equal(backupStamp(new Date('2026-11-18T20:30:00Z')), '2026-11-18');
});

test('timestamps in documents become text so the file is plain JSON', () => {
  const { documents } = buildBackup(cloudDocs());
  assert.doesNotThrow(() => JSON.stringify(documents));
  assert.equal(documents.find((doc) => doc.collection === 'bills').data.syncedAt, '2026-11-18T01:00:00.000Z');
  assert.deepEqual(plainData({ list: [{ at: { toDate: () => new Date(0) } }] }), { list: [{ at: '1970-01-01T00:00:00.000Z' }] });
});

test('refuses to write an empty backup', () => {
  assert.throws(() => buildBackup([]), /no bills/);
});

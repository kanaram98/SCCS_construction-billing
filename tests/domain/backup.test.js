import test from 'node:test';
import assert from 'node:assert/strict';
import {
  backupFilename,
  createBackup,
  describeLastBackup,
  needsBackupReminder,
  parseBackup
} from '../../src/domain/backup.js';
import { createInitialState } from '../../src/domain/app-state.js';

const now = new Date('2026-11-17T10:00:00Z');

function stateWithEntry(lastBackupAt = '') {
  const state = createInitialState();
  state.bills[0].sections = [{ id: 's', name: 'GF', areas: [{ id: 'a', name: 'Hall', items: [{ id: 'i', rateId: 'gas-hole', count: 1 }] }] }];
  state.meta.lastBackupAt = lastBackupAt;
  return state;
}

test('a backup round-trips through JSON', () => {
  const state = stateWithEntry();
  const parsed = parseBackup(JSON.stringify(createBackup(state, now)));
  assert.equal(parsed.billCount, 1);
  assert.equal(parsed.exportedAt, now.toISOString());
  // Loading adds sync metadata (createdAt, version…); the bill content is unchanged.
  const content = ({ createdAt: _c, updatedAt: _u, deletedAt: _d, version: _v, ...bill }) => bill;
  assert.deepEqual(parsed.state.bills.map(content), state.bills);
  assert.equal(parsed.state.bills[0].version, 1);
  assert.equal(backupFilename(now), 'construction-billing-backup-2026-11-17.json');
});

test('rejects files that are not usable backups', () => {
  assert.throws(() => parseBackup('not json'), /not a valid backup/);
  assert.throws(() => parseBackup('{"bills":[]}'), /not a Construction Billing backup/);
  assert.throws(() => parseBackup(JSON.stringify({ format: 'construction-billing-backup', version: 99, data: {} })), /newer version/);
  assert.throws(() => parseBackup(JSON.stringify({ format: 'construction-billing-backup', version: 1, data: { bills: [] } })), /does not contain any bills/);
});

test('reminds only when there are entries and no recent backup', () => {
  assert.equal(needsBackupReminder(createInitialState(), now), false);
  assert.equal(needsBackupReminder(stateWithEntry(), now), true);
  assert.equal(needsBackupReminder(stateWithEntry('2026-11-15T10:00:00Z'), now), false);
  assert.equal(needsBackupReminder(stateWithEntry('2026-11-01T10:00:00Z'), now), true);
  assert.equal(describeLastBackup(stateWithEntry(), now), 'never');
  assert.equal(describeLastBackup(stateWithEntry('2026-11-14T09:00:00Z'), now), '3 days ago');
});

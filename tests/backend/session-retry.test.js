import test from 'node:test';
import assert from 'node:assert/strict';
import { joinWorkspace, readWithRetry } from '../../src/backend/session.js';

const unavailable = Object.assign(new Error('offline'), { code: 'unavailable' });
const noWait = async () => {};

test('reads are retried while the connection starts, then succeed', async () => {
  let calls = 0;
  const result = await readWithRetry(async () => { calls += 1; if (calls < 3) throw unavailable; return 'ok'; }, { wait: noWait });
  assert.deepEqual([result, calls], ['ok', 3]);
});

test('other errors are not retried; unavailable gives up after the attempts', async () => {
  let calls = 0;
  await assert.rejects(readWithRetry(async () => { calls += 1; throw Object.assign(new Error('x'), { code: 'permission-denied' }); }, { wait: noWait }), /x/);
  assert.equal(calls, 1);
  calls = 0;
  await assert.rejects(readWithRetry(async () => { calls += 1; throw unavailable; }, { attempts: 3, wait: noWait }), /offline/);
  assert.equal(calls, 3);
});

test('an unreachable server is reported as unreachable, never as no access', async () => {
  const fs = {
    doc: (_db, path) => path,
    enableNetwork: async () => {},
    getDocFromServer: async () => { throw unavailable; },
    serverTimestamp: () => 'now'
  };
  const result = await joinWorkspace({ db: {}, fs }, 'sccs', { uid: 'u', email: 'a@b.com' }, new Date(), { attempts: 2, wait: noWait });
  assert.equal(result.status, 'unreachable');
});

test('a connection that comes up late still finds the invite', async () => {
  let reads = 0;
  const written = [];
  const fs = {
    doc: (_db, path) => path,
    enableNetwork: async () => {},
    getDocFromServer: async (path) => {
      reads += 1;
      if (reads <= 2) throw unavailable;
      if (path.includes('/members/')) throw Object.assign(new Error('denied'), { code: 'permission-denied' });
      return { exists: () => path.includes('/invites/'), data: () => ({ role: 'contractor' }) };
    },
    setDoc: async (path) => { written.push(path); },
    deleteDoc: async () => {},
    serverTimestamp: () => 'now'
  };
  const result = await joinWorkspace({ db: {}, fs }, 'sccs', { uid: 'u', email: 'k@gmail.com' }, new Date(), { wait: noWait });
  assert.deepEqual(result, { status: 'member', role: 'contractor', joined: true });
  assert.deepEqual(written, ['workspaces/sccs/members/u']);
});

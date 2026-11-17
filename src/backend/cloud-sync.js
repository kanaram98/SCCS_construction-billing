/**
 * Sync engine: connects the pure sync core to Firestore.
 *
 *   const engine = createSyncEngine({ db, fs, wid, uid, getRaw, applyRaw, loadState, saveState, onStatus });
 *   await engine.start();      // first sync, then listens for changes from other phones
 *   engine.push();             // call after local changes (debounced by the caller)
 *   engine.stop();
 *
 * - First sync: if the cloud has no bills yet, this device uploads everything;
 *   otherwise it adopts the cloud copy (its own language etc. kept).
 * - Pushes only what changed (planUpload); a write the server rejects because
 *   another device saved a newer version is resolved as a conflict.
 * - Listens to each collection for documents with syncedAt after the last one
 *   received, and merges them (applyIncoming).
 * - Firestore keeps working offline: writes wait on the device and are sent
 *   when back online.
 */
import { COLLECTIONS, docPath, workspacePath } from './schema.js';
import { adoptCloud, applyIncoming, createSyncState, keyOf, planUpload } from './sync-core.js';

const DATA_COLLECTIONS = Object.values(COLLECTIONS).filter((name) => name !== 'members' && name !== 'invites');

export const SYNC_STATUS = Object.freeze({
  connecting: 'connecting',
  syncing: 'syncing',
  synced: 'synced',
  offline: 'offline',
  error: 'error'
});

/** The version this device last synced for a document (0 if never). */
function baseOf(state, doc) {
  const sent = state.sent[keyOf(doc.collection, doc.id)];
  return sent && sent.startsWith('v') ? Number(sent.slice(1)) : 0;
}

/** Firestore Timestamp | ISO string → ISO string. */
const toIso = (value) => (value?.toDate ? value.toDate().toISOString() : value || null);

export function createSyncEngine({ db, fs, wid, uid, getRaw, applyRaw, loadState, saveState, onStatus = () => {}, onRefused = () => {} }) {
  let syncState = loadState() || createSyncState();
  let unsubscribers = [];
  let pushing = null;
  let pushAgain = false;
  let stopped = false;

  const persist = () => saveState(syncState);
  const status = (value, detail) => { if (!stopped) onStatus(value, detail); };

  function snapshotDoc(collection, snap) {
    return { collection, id: snap.id, exists: snap.exists(), data: snap.exists() ? snap.data() : null };
  }

  function receive(docs, { force = false } = {}) {
    if (!docs.length) return;
    const newest = docs.map((doc) => toIso(doc.data?.syncedAt)).filter(Boolean).sort().at(-1);
    const merged = applyIncoming(getRaw(), docs, syncState, new Date(), { by: uid, force });
    syncState = { ...merged.syncState, pulledAt: newest && (!syncState.pulledAt || newest > syncState.pulledAt) ? newest : syncState.pulledAt };
    persist();
    applyRaw(merged.raw, merged.conflicts);
    // Conflicts and merges may leave something to send (e.g. a conflict history entry).
    if (merged.conflicts.length) push();
  }

  async function writeOp(op) {
    const ref = fs.doc(db, docPath(wid, op.collection, op.id));
    if (op.kind === 'delete') return fs.deleteDoc(ref);
    if (op.kind === 'marks') {
      const marks = {};
      for (const [path, mark] of Object.entries(op.set)) {
        const [day, workerId] = path.split('.');
        marks[day] = { ...(marks[day] || {}), [workerId]: mark };
      }
      for (const path of op.remove) {
        const [day, workerId] = path.split('.');
        marks[day] = { ...(marks[day] || {}), [workerId]: fs.deleteField() };
      }
      return fs.setDoc(ref, { id: op.id, marks, syncedAt: fs.serverTimestamp() }, { merge: true });
    }
    return fs.setDoc(ref, { ...op.data, syncedAt: fs.serverTimestamp() });
  }

  async function pushNow() {
    const plan = planUpload(getRaw(), syncState, { by: uid });
    if (!plan.ops.length) { status(SYNC_STATUS.synced); return; }
    status(SYNC_STATUS.syncing, plan.ops.length);
    const previous = syncState;
    syncState = { ...syncState, sent: plan.sent, marks: plan.marks };
    persist();
    const results = await Promise.allSettled(plan.ops.map(writeOp));
    const rejected = [];
    results.forEach((result, index) => {
      if (result.status === 'fulfilled') return;
      const op = plan.ops[index];
      const key = keyOf(op.collection, op.id);
      // Not sent: forget it so the next push tries again (or the conflict below resolves it).
      if (previous.sent[key] === undefined) delete syncState.sent[key];
      else syncState.sent[key] = previous.sent[key];
      if (op.kind === 'marks') syncState.marks[op.id] = previous.marks?.[op.id];
      rejected.push({ op, error: result.reason });
    });
    persist();
    if (rejected.length) {
      // Fetch the cloud copies. A newer version there is a conflict (merge rules);
      // otherwise this person may not make that change: the cloud copy is put back.
      const fresh = (await Promise.all(rejected.map(({ op }) => fs.getDocFromServer(fs.doc(db, docPath(wid, op.collection, op.id)))
        .then((snap) => snapshotDoc(op.collection, snap)).catch(() => null)))).filter((doc) => doc?.exists);
      const newer = fresh.filter((doc) => doc.data.version === undefined || doc.data.version > baseOf(previous, doc));
      const refused = fresh.filter((doc) => !newer.includes(doc));
      receive(newer);
      if (refused.length) {
        receive(refused, { force: true });
        onRefused(refused.map((doc) => ({ collection: doc.collection, id: doc.id })));
      }
      const unresolved = rejected.filter(({ op }) => !fresh.some((doc) => doc.collection === op.collection && doc.id === op.id));
      if (unresolved.length) {
        console.error('Sync: some changes were refused.', unresolved);
        status(SYNC_STATUS.error, unresolved[0].error?.code || 'refused');
        return;
      }
    }
    status(SYNC_STATUS.synced);
  }

  /** Sends local changes; calls made while a push runs are folded into one more push. */
  function push() {
    if (stopped) return Promise.resolve();
    if (pushing) { pushAgain = true; return pushing; }
    pushing = pushNow()
      .catch((error) => { console.error('Sync failed.', error); status(SYNC_STATUS.error, error.code || error.message); })
      .finally(() => {
        pushing = null;
        if (pushAgain) { pushAgain = false; push(); }
      });
    return pushing;
  }

  async function firstSync() {
    const snapshots = await Promise.all(DATA_COLLECTIONS.map((collection) =>
      fs.getDocs(fs.collection(db, `${workspacePath(wid)}/${collection}`)).then((snap) => snap.docs.map((item) => snapshotDoc(collection, item)))));
    const docs = snapshots.flat();
    const hasBills = docs.some((doc) => doc.collection === 'bills');
    if (hasBills) {
      const adopted = adoptCloud(docs, getRaw());
      syncState = { ...adopted.syncState, pulledAt: docs.map((doc) => toIso(doc.data?.syncedAt)).filter(Boolean).sort().at(-1) || null };
      persist();
      applyRaw(adopted.raw, [], { replaced: true });
    }
    // Empty cloud: everything on this device is uploaded by the push below.
  }

  function listen() {
    const since = syncState.pulledAt ? fs.Timestamp.fromDate(new Date(syncState.pulledAt)) : fs.Timestamp.fromMillis(0);
    unsubscribers = DATA_COLLECTIONS.map((collection) => fs.onSnapshot(
      fs.query(fs.collection(db, `${workspacePath(wid)}/${collection}`), fs.where('syncedAt', '>', since)),
      { includeMetadataChanges: false },
      (snapshot) => {
        const changes = snapshot.docChanges()
          .filter((change) => !change.doc.metadata.hasPendingWrites)
          .map((change) => (change.type === 'removed' ? null : snapshotDoc(collection, change.doc)))
          .filter(Boolean);
        receive(changes);
      },
      (error) => { console.error(`Sync listener (${collection}) stopped.`, error); status(SYNC_STATUS.error, error.code); }
    ));
  }

  return {
    async start() {
      status(SYNC_STATUS.connecting);
      if (!syncState.pulledAt && !Object.keys(syncState.sent).length) await firstSync();
      await push();
      listen();
    },
    push,
    stop() {
      stopped = true;
      unsubscribers.forEach((unsubscribe) => unsubscribe());
      unsubscribers = [];
    },
    get syncState() { return syncState; }
  };
}

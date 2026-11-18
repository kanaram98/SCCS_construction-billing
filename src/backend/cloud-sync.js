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
import { adoptCloud, applyIncoming, createSyncState, keyOf, planUpload, runInPhases } from './sync-core.js';

const DATA_COLLECTIONS = Object.values(COLLECTIONS).filter((name) => name !== 'members' && name !== 'invites');

/** What an item is called, for the list of items that could not be uploaded. */
function itemName(raw, collection, id) {
  const list = RECORD_PATHS[collection]?.reduce((value, key) => value?.[key], raw) || [];
  const item = list.find((entry) => entry.id === id);
  if (collection === 'bills' && item) return `${item.kind === 'estimate' ? 'Estimate' : 'Bill'} ${item.number}${item.projectName ? ` · ${item.projectName}` : ''}`;
  if (collection === 'labourPayments') return 'Labour payment';
  if (collection === 'advances') return item ? `Advance ₹${item.amount} · ${item.date}` : id;
  if (collection === 'expenses') return item ? `Expense ₹${item.amount} · ${item.date}` : id;
  return item?.name || id;
}

export const SYNC_STATUS = Object.freeze({
  connecting: 'connecting',
  syncing: 'syncing',
  synced: 'synced',
  offline: 'offline',
  error: 'error',
  attention: 'attention'
});

/** Where each versioned record list lives in the app state. */
const RECORD_PATHS = Object.freeze({
  bills: ['bills'], rates: ['rates'], clients: ['clients'], templates: ['templates'],
  projects: ['projects'], advances: ['advances'], expenses: ['expenses'],
  workers: ['labour', 'workers'], labourPayments: ['labour', 'payments']
});

function versionOf(raw, collection, id) {
  const list = RECORD_PATHS[collection]?.reduce((value, key) => value?.[key], raw);
  return list?.find((item) => item.id === id)?.version ?? 0;
}

/** The version this device last synced for a document (0 if never). */
function baseOf(state, doc) {
  const sent = state.sent[keyOf(doc.collection, doc.id)];
  return sent && sent.startsWith('v') ? Number(sent.slice(1)) : 0;
}

/** Firestore Timestamp | ISO string → ISO string. */
const toIso = (value) => (value?.toDate ? value.toDate().toISOString() : value || null);

export function createSyncEngine({ db, fs, wid, uid, getRaw, applyRaw, loadState, saveState, onStatus = () => {}, onRefused = () => {}, onPending = () => {}, onProblems = () => {} }) {
  let syncState = loadState() || createSyncState();
  let inFlight = 0; // uploads sent to the server and not yet confirmed (they wait while offline)
  let unsubscribers = [];
  let pushing = null;
  let pushAgain = false;
  let stopped = false;

  const persist = () => saveState(syncState);
  const blockedPrints = () => Object.fromEntries(Object.entries(syncState.blocked || {}).map(([key, value]) => [key, value.print]));
  const plan_ = () => planUpload(getRaw(), syncState, { by: uid, blocked: blockedPrints() });

  /** Items the server refused, with a readable name and the reason code. */
  function problems() {
    return Object.entries(syncState.blocked || {}).map(([key, value]) => {
      const [collection, id] = key.split('/');
      return { collection, id, code: value.code, name: collection === 'settings' ? id : itemName(getRaw(), collection, id) };
    });
  }
  const settle = () => {
    const list = problems();
    onProblems(list);
    status(list.length ? SYNC_STATUS.attention : SYNC_STATUS.synced);
  };
  const status = (value, detail) => { if (!stopped) onStatus(value, detail); };

  function snapshotDoc(collection, snap) {
    return { collection, id: snap.id, exists: snap.exists(), data: snap.exists() ? snap.data() : null };
  }

  function receive(docs, { force = false } = {}) {
    if (!docs.length) return;
    const newest = docs.map((doc) => toIso(doc.data?.syncedAt)).filter(Boolean).sort().at(-1);
    const before = getRaw();
    const merged = applyIncoming(before, docs, syncState, new Date(), { by: uid, force });
    // Changes made by someone else (used for a "updated from another device" notice).
    const fromOthers = force ? [] : docs
      .filter((doc) => doc.exists && RECORD_PATHS[doc.collection] && doc.data.updatedBy && doc.data.updatedBy !== uid
        && doc.data.version > versionOf(before, doc.collection, doc.id))
      .map((doc) => ({ collection: doc.collection, id: doc.id, by: doc.data.updatedBy }));
    syncState = { ...merged.syncState, pulledAt: newest && (!syncState.pulledAt || newest > syncState.pulledAt) ? newest : syncState.pulledAt };
    persist();
    applyRaw(merged.raw, merged.conflicts, { fromOthers });
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
    const plan = plan_();
    if (!plan.ops.length) { settle(); return; }
    status(SYNC_STATUS.syncing, plan.ops.length);
    const previous = syncState;
    syncState = { ...syncState, sent: plan.sent, marks: plan.marks };
    persist();
    inFlight += plan.ops.length;
    onPending(inFlight);
    // Each write is confirmed only when the server has it, so this waits while offline.
    const results = await runInPhases(plan.ops, writeOp);
    inFlight -= plan.ops.length;
    onPending(inFlight);
    const rejected = [];
    results.forEach((result, index) => {
      const op = plan.ops[index];
      const key = keyOf(op.collection, op.id);
      if (result.status === 'fulfilled') {
        if (syncState.blocked?.[key]) { const { [key]: _fixed, ...rest } = syncState.blocked; syncState = { ...syncState, blocked: rest }; }
        return;
      }
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
      let cannotRead = false; // not even reading is allowed: this account was removed from the workspace
      const fresh = (await Promise.all(rejected.map(({ op }) => fs.getDocFromServer(fs.doc(db, docPath(wid, op.collection, op.id)))
        .then((snap) => snapshotDoc(op.collection, snap))
        .catch((error) => { if (error?.code === 'permission-denied') cannotRead = true; return null; })))).filter((doc) => doc?.exists);
      const newer = fresh.filter((doc) => doc.data.version === undefined || doc.data.version > baseOf(previous, doc));
      const refused = fresh.filter((doc) => !newer.includes(doc));
      receive(newer);
      if (refused.length) {
        receive(refused, { force: true });
        onRefused(refused.map((doc) => ({ collection: doc.collection, id: doc.id })));
      }
      let unresolved = rejected.filter(({ op }) => !fresh.some((doc) => doc.collection === op.collection && doc.id === op.id));
      if (!cannotRead) {
        // A delete that was refused but whose target no longer exists in the cloud is already done.
        const alreadyGone = unresolved.filter(({ op }) => op.kind === 'delete');
        for (const { op } of alreadyGone) delete syncState.sent[keyOf(op.collection, op.id)];
        unresolved = unresolved.filter(({ op }) => op.kind !== 'delete');
        if (alreadyGone.length) persist();
      }
      if (unresolved.length) {
        // The server refuses these items and nobody has a newer copy: remember them (so they are not
        // sent again and again) and show them to the user until they are changed.
        console.error('Sync: some changes were refused.', unresolved);
        if (cannotRead) { status(SYNC_STATUS.error, 'permission-denied'); return; }
        const blocked = { ...(syncState.blocked || {}) };
        for (const { op, error } of unresolved) {
          const key = keyOf(op.collection, op.id);
          if (op.kind === 'set' && plan.sent[key] !== undefined) blocked[key] = { print: plan.sent[key], code: error?.code || 'refused' };
        }
        syncState = { ...syncState, blocked };
        persist();
        if (Object.keys(blocked).length) { settle(); return; }
        status(SYNC_STATUS.error, unresolved[0].error?.code || 'refused');
        return;
      }
    }
    persist();
    settle();
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

  /** Downloads whatever changed on the server since this phone last heard (throws when unreachable). */
  async function pullNow() {
    const since = syncState.pulledAt ? fs.Timestamp.fromDate(new Date(syncState.pulledAt)) : fs.Timestamp.fromMillis(0);
    const batches = await Promise.all(DATA_COLLECTIONS.map((collection) =>
      fs.getDocsFromServer(fs.query(fs.collection(db, `${workspacePath(wid)}/${collection}`), fs.where('syncedAt', '>', since)))
        .then((snap) => snap.docs.map((item) => snapshotDoc(collection, item)))));
    const docs = batches.flat();
    receive(docs);
    return docs.length;
  }

  const unsentCount = () => plan_().ops.length;

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
    /** Changes on this phone that the server has not confirmed yet. */
    pendingCount: () => unsentCount() + inFlight,
    /** Changes not yet sent to the server (excludes writes waiting for confirmation). */
    unsentCount,
    /** Items the server refused (shown to the user). */
    problems,
    /** Try the refused items again (after the user changed something or on request). */
    retryBlocked() {
      syncState = { ...syncState, blocked: {} };
      persist();
      onProblems([]);
      return push();
    },
    /**
     * "Sync now": sends everything, waits (up to `timeout` ms) for the server to
     * confirm it, then downloads what others changed.
     * @returns {Promise<{ ok: boolean, pending: number, downloaded?: number, unreachable?: boolean }>}
     */
    async syncNow({ timeout = 15000 } = {}) {
      await Promise.race([push(), new Promise((resolve) => setTimeout(resolve, timeout))]);
      const pending = unsentCount() + inFlight;
      if (pending > 0) return { ok: false, pending };
      try {
        const downloaded = await pullNow();
        settle();
        return { ok: true, pending: 0, downloaded };
      } catch (error) {
        if (error?.code !== 'unavailable') console.error('Sync now could not download.', error);
        return { ok: false, pending: 0, unreachable: true };
      }
    },
    stop() {
      stopped = true;
      unsubscribers.forEach((unsubscribe) => unsubscribe());
      unsubscribers = [];
    },
    get syncState() { return syncState; }
  };
}

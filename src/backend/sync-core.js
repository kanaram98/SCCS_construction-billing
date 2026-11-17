/**
 * The heart of cloud sync, as pure functions (no Firebase here):
 *
 *   planUpload(raw, syncState, { by })        → { ops, sent }      what this device must send
 *   applyIncoming(raw, docs, syncState, now)  → { raw, syncState, conflicts }   merge what came down
 *
 * `syncState` is kept per device and remembers what the cloud already has:
 *   { sent:  { 'bills/b1': 'v3', 'settings/printSettings': '{…}', 'history/h1': '1', … },
 *     marks: { '2026-11': { '02': { w1: '<at>' } } },   attendance marks as last synced
 *     pulledAt: '<server time of the newest change received>' }
 *
 * Conflicts: each device remembers the version it last synced (its base).
 * If a record changed here and also in the cloud since that base, the cloud
 * version wins and this device's version is kept as a 'conflict' history
 * entry, so Undo can bring it back. Nothing is lost silently.
 */
import { newId } from '../domain/ids.js';
import { labelOf } from '../domain/history.js';
import { fromDocuments, toDocuments } from './mapping.js';

/** Collections stored as lists of versioned records, and where they live in raw state. */
const RECORD_LISTS = Object.freeze({
  bills: ['bills'],
  rates: ['rates'],
  clients: ['clients'],
  templates: ['templates'],
  workers: ['labour', 'workers'],
  labourPayments: ['labour', 'payments']
});
const LOGS = Object.freeze({ history: ['log'], labourLog: ['labour', 'log'] });
const VERSIONED_SETTINGS = Object.freeze(['firm', 'quotation']);
/** Labour records log their conflicts in the labour log. */
const LABOUR_ENTITY = Object.freeze({ workers: 'worker', labourPayments: 'payment' });

export const keyOf = (collection, id) => `${collection}/${id}`;

export function createSyncState() {
  return { sent: {}, marks: {}, pulledAt: null };
}

/** Stable JSON (sorted keys) for comparing settings. */
function stable(value) {
  if (Array.isArray(value)) return `[${value.map(stable).join(',')}]`;
  if (value && typeof value === 'object') return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stable(value[key])}`).join(',')}}`;
  return JSON.stringify(value);
}

/** What the cloud copy of a document is identified by. */
function fingerprint(collection, data) {
  if (RECORD_LISTS[collection] || VERSIONED_SETTINGS.includes(data.id)) return `v${data.version}`;
  if (collection === 'settings') return stable(data);
  return '1';
}

const baseVersion = (syncState, key) => {
  const sent = syncState.sent[key];
  return sent && sent.startsWith('v') ? Number(sent.slice(1)) : 0;
};

const getIn = (object, path) => path.reduce((value, key) => value?.[key], object);
function setIn(object, path, value) {
  if (path.length === 1) return { ...object, [path[0]]: value };
  return { ...object, [path[0]]: setIn(object[path[0]] || {}, path.slice(1), value) };
}

// ── Upload ────────────────────────────────────────────────────────────

/**
 * Works out what to send. Records, settings and history entries are sent
 * whole when they changed; attendance is sent mark by mark; records purged
 * from the recycle bin and unlocked months are deleted.
 * @returns {{ ops: Array, sent: object, marks: object }} `sent`/`marks` describe the cloud after the ops succeed
 */
export function planUpload(raw, syncState, { by }) {
  const docs = toDocuments(raw, { by });
  const ops = [];
  const sent = { ...syncState.sent };
  const present = new Set();

  for (const doc of docs) {
    const key = keyOf(doc.collection, doc.id);
    present.add(key);
    if (doc.collection === 'attendance') continue;
    const print = fingerprint(doc.collection, doc.data);
    if (sent[key] === print) continue;
    if (LOGS[doc.collection] && sent[key]) continue; // history entries never change once sent
    ops.push({ kind: 'set', collection: doc.collection, id: doc.id, data: doc.data });
    sent[key] = print;
  }

  // Purged records and unlocked months: gone here, still in the cloud.
  for (const key of Object.keys(sent)) {
    if (present.has(key)) continue;
    const [collection, id] = key.split('/');
    if (RECORD_LISTS[collection] || collection === 'closedMonths') {
      ops.push({ kind: 'delete', collection, id });
      delete sent[key];
    }
  }

  // Attendance: only the marks that changed.
  const marks = structuredClone(syncState.marks || {});
  for (const doc of docs.filter((item) => item.collection === 'attendance')) {
    const month = doc.id;
    const synced = marks[month] || {};
    const set = {};
    const remove = [];
    for (const [day, workers] of Object.entries(doc.data.marks)) {
      for (const [workerId, mark] of Object.entries(workers)) {
        if (synced[day]?.[workerId] !== mark.at) set[`${day}.${workerId}`] = mark;
      }
    }
    for (const [day, workers] of Object.entries(synced)) {
      for (const workerId of Object.keys(workers)) {
        if (!doc.data.marks[day]?.[workerId]) remove.push(`${day}.${workerId}`);
      }
    }
    if (Object.keys(set).length || remove.length) {
      ops.push({ kind: 'marks', collection: 'attendance', id: month, set, remove, isNew: !syncState.marks?.[month] });
      marks[month] = Object.fromEntries(Object.entries(doc.data.marks).map(([day, workers]) => [day, Object.fromEntries(Object.entries(workers).map(([id, mark]) => [id, mark.at]))]));
    }
  }
  // Months whose marks were all cleared locally.
  for (const month of Object.keys(syncState.marks || {})) {
    if (present.has(keyOf('attendance', month))) continue;
    const remove = Object.entries(syncState.marks[month]).flatMap(([day, workers]) => Object.keys(workers).map((workerId) => `${day}.${workerId}`));
    if (remove.length) ops.push({ kind: 'marks', collection: 'attendance', id: month, set: {}, remove, isNew: false });
    delete marks[month];
  }
  return { ops, sent, marks };
}

// ── Download ──────────────────────────────────────────────────────────

const strip = ({ syncedAt: _synced, order: _order, ...rest }) => rest;

const META_KEYS = ['createdAt', 'updatedAt', 'deletedAt', 'version', 'updatedBy', 'syncedAt', 'order'];
const withoutMeta = (record) => Object.fromEntries(Object.entries(record).filter(([key]) => !META_KEYS.includes(key)));

/** History entry keeping this device's version of a record the cloud overrode. */
function conflictEntry(collection, local, now, by) {
  const base = { id: newId(), at: now.toISOString(), by, action: 'conflict', refId: local.id, before: withoutMeta(local) };
  if (LABOUR_ENTITY[collection]) {
    return { ...base, entity: LABOUR_ENTITY[collection], workerId: collection === 'workers' ? local.id : local.workerId };
  }
  return { ...base, entity: collection, label: labelOf(collection, local) };
}

/**
 * Merges documents from the cloud into the raw state.
 * `docs`: [{ collection, id, exists, data }] — `exists: false` means deleted in the cloud.
 * @returns {{ raw, syncState, conflicts: Array }}
 */
export function applyIncoming(raw, docs, syncState, now = new Date(), { by = '' } = {}) {
  let next = raw;
  const state = { sent: { ...syncState.sent }, marks: structuredClone(syncState.marks || {}), pulledAt: syncState.pulledAt };
  const conflicts = [];

  for (const doc of docs) {
    const key = keyOf(doc.collection, doc.id);
    const data = doc.exists === false ? null : strip(doc.data);

    if (RECORD_LISTS[doc.collection]) {
      const path = RECORD_LISTS[doc.collection];
      const list = getIn(next, path) || [];
      const index = list.findIndex((item) => item.id === doc.id);
      const local = index >= 0 ? list[index] : null;
      if (!data) {
        // Deleted forever in the cloud (only possible from the recycle bin).
        if (local) next = setIn(next, path, list.filter((item) => item.id !== doc.id));
        delete state.sent[key];
        continue;
      }
      const base = baseVersion(state, key);
      const changedHere = local && Number(local.version) > base;
      const changedThere = data.version > base;
      if (local && changedHere && changedThere) {
        conflicts.push(conflictEntry(doc.collection, local, now, by));
      } else if (local && data.version <= local.version) {
        continue; // this device is already as new (its change will be uploaded)
      }
      const updated = [...list];
      if (index >= 0) updated[index] = data;
      else updated.splice(Math.min(doc.data.order ?? updated.length, updated.length), 0, data);
      next = setIn(next, path, updated);
      state.sent[key] = `v${data.version}`;
      continue;
    }

    if (LOGS[doc.collection]) {
      if (!data) continue;
      const path = LOGS[doc.collection];
      const log = getIn(next, path) || [];
      if (!log.some((entry) => entry.id === doc.id)) {
        next = setIn(next, path, [...log, data].sort((a, b) => String(a.at).localeCompare(String(b.at))));
      }
      state.sent[key] = '1';
      continue;
    }

    if (doc.collection === 'settings' && data) {
      const { id: name, ...value } = data;
      const local = next[name];
      if (VERSIONED_SETTINGS.includes(name)) {
        const base = baseVersion(state, key);
        const changedHere = local && Number(local.version || 1) > base;
        if (local && changedHere && data.version > base) conflicts.push(conflictEntry(name, { ...local, id: name }, now, by));
        else if (local && data.version <= Number(local.version || 1)) continue;
        next = { ...next, [name]: value };
        state.sent[key] = `v${data.version}`;
      } else if (name === 'printSettings') {
        const pendingHere = stable({ ...local, id: name }) !== syncState.sent[key] && syncState.sent[key] !== undefined;
        if (!pendingHere) {
          next = { ...next, printSettings: value };
          state.sent[key] = stable(data);
        }
      }
      continue;
    }

    if (doc.collection === 'closedMonths') {
      const closed = { ...(next.labour?.closedMonths || {}) };
      if (data) { closed[doc.id] = { closedAt: data.closedAt, closedBy: data.closedBy }; state.sent[key] = '1'; }
      else { delete closed[doc.id]; delete state.sent[key]; }
      next = setIn(next, ['labour', 'closedMonths'], closed);
      continue;
    }

    if (doc.collection === 'attendance' && data) {
      next = mergeAttendanceMonth(next, doc.id, data.marks || {}, state);
    }
  }

  const labourConflicts = conflicts.filter((entry) => entry.workerId !== undefined);
  const appConflicts = conflicts.filter((entry) => entry.workerId === undefined);
  if (appConflicts.length) next = { ...next, log: [...(next.log || []), ...appConflicts] };
  if (labourConflicts.length) next = setIn(next, ['labour', 'log'], [...(next.labour?.log || []), ...labourConflicts]);
  return { raw: next, syncState: state, conflicts };
}

/**
 * Merges one month of marks: a mark changed on this device since the last
 * sync is kept unless the cloud has a newer one (by time); otherwise the
 * cloud wins, including marks cleared on another device.
 */
function mergeAttendanceMonth(raw, month, cloudMarks, state) {
  const attendance = { ...(raw.labour?.attendance || {}) };
  const synced = state.marks[month] || {};
  const days = new Set([...Object.keys(cloudMarks), ...Object.keys(synced)]);
  for (const day of days) {
    const date = `${month}-${day}`;
    const local = { ...(attendance[date] || {}) };
    const workers = new Set([...Object.keys(cloudMarks[day] || {}), ...Object.keys(synced[day] || {})]);
    for (const workerId of workers) {
      const cloud = cloudMarks[day]?.[workerId] || null;
      const mine = local[workerId] || null;
      const pendingHere = (mine?.at || null) !== (synced[day]?.[workerId] || null);
      if (pendingHere && !(cloud && mine && cloud.at > mine.at)) continue; // keep this device's change
      if (cloud) local[workerId] = cloud;
      else delete local[workerId];
    }
    if (Object.keys(local).length) attendance[date] = local;
    else delete attendance[date];
  }
  // Remember the cloud's marks as synced, except where this device still has a pending change.
  const merged = {};
  for (const [day, workers] of Object.entries(cloudMarks)) {
    for (const [workerId, mark] of Object.entries(workers)) {
      const mine = attendance[`${month}-${day}`]?.[workerId];
      if (mine && mine.at !== mark.at) continue;
      merged[day] = { ...(merged[day] || {}), [workerId]: mark.at };
    }
  }
  state.marks[month] = merged;
  return setIn(raw, ['labour', 'attendance'], attendance);
}

// ── First sync on a phone joining an existing workspace ───────────────

/**
 * Takes the cloud copy as this device's data (keeping its own language,
 * open bill and onboarding) and records everything as already synced.
 * Returns null when the cloud has no bills yet (then this device uploads instead).
 */
export function adoptCloud(docs, localRaw, now = new Date()) {
  const withoutSyncedAt = ({ syncedAt: _synced, ...rest }) => rest;
  const present = docs.filter((doc) => doc.exists !== false).map((doc) => ({ ...doc, data: withoutSyncedAt(doc.data) }));
  const raw = fromDocuments(present, { local: localRaw }, now);
  if (!raw) return null;
  const syncState = createSyncState();
  for (const doc of present) {
    if (doc.collection === 'attendance') {
      syncState.marks[doc.id] = Object.fromEntries(Object.entries(doc.data.marks || {}).map(([day, workers]) =>
        [day, Object.fromEntries(Object.entries(workers).map(([workerId, mark]) => [workerId, mark.at]))]));
    } else {
      const { order: _order, ...data } = doc.data;
      syncState.sent[keyOf(doc.collection, doc.id)] = fingerprint(doc.collection, data);
    }
  }
  return { raw, syncState };
}

/**
 * Change history for bills, rates, clients, templates, firm details and the
 * quotation (labour keeps its own log, see labour-ops.js).
 *
 * The store keeps the *raw* state, which still holds deleted records
 * (`deletedAt` set) and the history log. Screens and actions work on the
 * *live* view without deleted records. After every change the store calls
 * `recordChanges(raw, nextLive)`, which compares old and new live data and:
 *   - stamps createdAt / updatedAt / version on new and changed records,
 *   - turns removals into soft deletes (kept for RECYCLE_DAYS),
 *   - appends log entries; quick successive edits of one record (typing)
 *     are merged into one entry that keeps the state from before the edits.
 *
 * Log entry: { id, at, entity, action, refId?, label, fields?, before?, revertOf? }
 * entity: 'bills' | 'rates' | 'clients' | 'templates' | 'projects' | 'advances' | 'expenses' | 'firm' | 'quotation'
 * action: 'create' | 'update' | 'delete' | 'restore' | 'purge' | 'conflict'
 *   (conflict: another device saved a newer version; `before` holds this device's version)
 */
import { newId } from './ids.js';

export const COLLECTIONS = Object.freeze(['bills', 'rates', 'clients', 'templates', 'projects', 'advances', 'expenses']);
export const SINGLETONS = Object.freeze(['firm', 'quotation']);

export const RECYCLE_DAYS = 30;
export const HISTORY_DAYS = 180;
export const HISTORY_MAX = 1000;
/** Only the newest edits keep a full copy for undo (bills can be large). */
export const SNAPSHOTS_KEPT = 40;
/** Edits of the same record within this time are merged into one entry. */
export const MERGE_MS = 10 * 60 * 1000;

const DAY_MS = 24 * 60 * 60 * 1000;
const META = new Set(['createdAt', 'updatedAt', 'deletedAt', 'version']);
/** Firm fields not tracked: images (large) and print layout tweaks. */
const UNTRACKED = { firm: new Set(['logo', 'signature', 'signatureLayout', 'brandingApplied']), quotation: new Set() };

const iso = (now) => now.toISOString();

/** Sync metadata for a new record. */
export function stampNew(record, now) {
  const at = iso(now);
  return { ...record, createdAt: at, updatedAt: at, deletedAt: null, version: 1, updatedBy: undefined };
}

/** A change made on this device: new version, and the author is whoever uploads it (cleared here). */
const touch = (record, patch, now) => ({ ...record, ...patch, updatedAt: iso(now), version: (Number(record.version) || 1) + 1, updatedBy: undefined });

/** Fills in sync metadata on records saved before it existed. */
export function withMeta(record) {
  return {
    ...record,
    createdAt: record.createdAt || '',
    updatedAt: record.updatedAt || record.createdAt || '',
    deletedAt: record.deletedAt || null,
    version: Number(record.version) || 1
  };
}

/** The fields of a record that changed (by reference), ignoring sync metadata. */
function changedFields(before, after, ignored = new Set()) {
  const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
  return [...keys].filter((key) => !META.has(key) && !ignored.has(key) && before?.[key] !== after?.[key]);
}

const withoutKeys = (record, keys) => Object.fromEntries(Object.entries(record).filter(([key]) => !keys.has(key) && !META.has(key)));

/** Small description stored with each entry, so history stays readable after a purge. */
export function labelOf(entity, record) {
  if (!record) return {};
  if (entity === 'bills') return { kind: record.kind, number: record.number, raNumber: record.raNumber, projectName: record.projectName };
  if (entity === 'firm') return { name: record.name };
  if (entity === 'quotation') return { title: record.title };
  if (entity === 'advances') return { amount: record.amount, date: record.date, projectId: record.projectId };
  if (entity === 'expenses') return { amount: record.amount, date: record.date, category: record.category, projectId: record.projectId };
  return { name: record.name };
}

// ── Live view ─────────────────────────────────────────────────────────

/** The state screens see: deleted records left out, and a valid active bill. */
export function liveState(raw) {
  const live = { ...raw };
  for (const key of COLLECTIONS) {
    const list = raw[key] || [];
    live[key] = list.some((record) => record.deletedAt) ? list.filter((record) => !record.deletedAt) : list;
  }
  if (live.bills.length && !live.bills.some((bill) => bill.id === live.activeBillId)) live.activeBillId = live.bills[0].id;
  return live;
}

// ── Recording changes ─────────────────────────────────────────────────

function lastMergeable(log, entity, refId, now) {
  const last = log[log.length - 1];
  if (!last || last.entity !== entity || last.action !== 'update' || last.refId !== refId || last.revertOf) return null;
  return now - Date.parse(last.at) < MERGE_MS ? last : null;
}

function logUpdate(log, { entity, refId, before, after, fields }, now) {
  const merge = lastMergeable(log, entity, refId, now);
  if (merge) {
    const merged = { ...merge, at: iso(now), label: labelOf(entity, after), fields: [...new Set([...merge.fields, ...fields])] };
    return [...log.slice(0, -1), merged];
  }
  return [...log, { id: newId(), at: iso(now), entity, action: 'update', refId, label: labelOf(entity, after), fields, before }];
}

/**
 * Applies what changed between the live view of `raw` and `nextLive` to the
 * raw state, with soft deletes, sync metadata and history entries.
 */
export function recordChanges(raw, nextLive, now = new Date()) {
  const prevLive = liveState(raw);
  let log = raw.log || [];
  const result = { ...nextLive };

  for (const entity of COLLECTIONS) {
    const prevList = prevLive[entity] || [];
    const nextList = nextLive[entity] || [];
    if (prevList === nextList) { result[entity] = raw[entity] || []; continue; }
    const prevById = new Map(prevList.map((record) => [record.id, record]));
    const nextIds = new Set(nextList.map((record) => record.id));
    const kept = nextList.map((record) => {
      const before = prevById.get(record.id);
      if (!before) {
        log = [...log, { id: newId(), at: iso(now), entity, action: 'create', refId: record.id, label: labelOf(entity, record) }];
        return stampNew(record, now);
      }
      if (before === record) return record;
      const fields = changedFields(before, record);
      if (!fields.length) return record;
      log = logUpdate(log, { entity, refId: record.id, before: withoutKeys(before, new Set()), after: record, fields }, now);
      return touch(record, {}, now);
    });
    const removed = prevList.filter((record) => !nextIds.has(record.id)).map((record) => {
      log = [...log, { id: newId(), at: iso(now), entity, action: 'delete', refId: record.id, label: labelOf(entity, record) }];
      return touch(record, { deletedAt: iso(now) }, now);
    });
    const alreadyDeleted = (raw[entity] || []).filter((record) => record.deletedAt);
    result[entity] = [...kept, ...removed, ...alreadyDeleted];
  }

  for (const entity of SINGLETONS) {
    const before = prevLive[entity];
    const after = nextLive[entity];
    if (!before || !after || before === after || !changedFields(before, after).length) continue;
    // Every change bumps the version (so it syncs); only tracked fields are logged.
    const fields = changedFields(before, after, UNTRACKED[entity]);
    if (fields.length) log = logUpdate(log, { entity, refId: entity, before: withoutKeys(before, UNTRACKED[entity]), after, fields }, now);
    result[entity] = touch(after, {}, now);
  }

  result.log = log;
  return result;
}

// ── Recycle bin and undo ──────────────────────────────────────────────

const findRecord = (raw, entity, id) => (raw[entity] || []).find((record) => record.id === id);

function replaceRecord(raw, entity, id, update) {
  return { ...raw, [entity]: raw[entity].map((record) => (record.id === id ? update(record) : record)) };
}

const appendLog = (raw, entry, now) => ({ ...raw, log: [...(raw.log || []), { id: newId(), at: iso(now), ...entry }] });

/** Brings a deleted record back. */
export function restoreRecord(raw, entity, id, now = new Date(), extra = {}) {
  const record = findRecord(raw, entity, id);
  if (!record?.deletedAt) return raw;
  return appendLog(replaceRecord(raw, entity, id, (item) => touch(item, { deletedAt: null }, now)),
    { entity, action: 'restore', refId: id, label: labelOf(entity, record), ...extra }, now);
}

/** Moves a live record to the recycle bin (used by undo). */
export function deleteRecord(raw, entity, id, now = new Date(), extra = {}) {
  const record = findRecord(raw, entity, id);
  if (!record || record.deletedAt) return raw;
  return appendLog(replaceRecord(raw, entity, id, (item) => touch(item, { deletedAt: iso(now) }, now)),
    { entity, action: 'delete', refId: id, label: labelOf(entity, record), ...extra }, now);
}

/** Permanently removes a deleted record. */
export function purgeRecord(raw, entity, id, now = new Date()) {
  const record = findRecord(raw, entity, id);
  if (!record?.deletedAt) return raw;
  return appendLog({ ...raw, [entity]: raw[entity].filter((item) => item.id !== id) },
    { entity, action: 'purge', refId: id, label: labelOf(entity, record) }, now);
}

/** Deleted records, newest first. */
export function recycleBin(raw) {
  return COLLECTIONS.flatMap((entity) => (raw[entity] || [])
    .filter((record) => record.deletedAt)
    .map((record) => ({ entity, id: record.id, deletedAt: record.deletedAt, label: labelOf(entity, record), record })))
    .sort((a, b) => b.deletedAt.localeCompare(a.deletedAt));
}

/**
 * Why an entry can't be undone, or '' when it can:
 * 'final' (purge) | 'reverted' | 'missing' (deleted forever) | 'deleted' (restore it first) | 'trimmed' (too old to undo).
 */
export function undoBlocker(raw, entry) {
  if (entry.action === 'purge') return 'final';
  if ((raw.log || []).some((other) => other.revertOf === entry.id)) return 'reverted';
  if (SINGLETONS.includes(entry.entity)) return entry.before ? '' : 'trimmed';
  const record = findRecord(raw, entry.entity, entry.refId);
  if (!record) return 'missing';
  if (entry.action === 'update' || entry.action === 'conflict') {
    if (!entry.before) return 'trimmed';
    if (record.deletedAt) return 'deleted';
  }
  return '';
}

/** Undoes one history entry; the undo is logged with `revertOf`. */
export function undoEntry(raw, entryId, now = new Date()) {
  const entry = (raw.log || []).find((item) => item.id === entryId);
  if (!entry || undoBlocker(raw, entry)) return raw;
  const extra = { revertOf: entry.id };
  const { entity, refId } = entry;

  if (SINGLETONS.includes(entity)) {
    const current = raw[entity];
    const restored = touch({ ...current, ...entry.before }, {}, now);
    const fields = changedFields(current, restored, UNTRACKED[entity]);
    return appendLog({ ...raw, [entity]: restored },
      { entity, action: 'update', refId, label: labelOf(entity, restored), fields, before: withoutKeys(current, UNTRACKED[entity]), ...extra }, now);
  }
  if (entry.action === 'create' || entry.action === 'restore') return deleteRecord(raw, entity, refId, now, extra);
  if (entry.action === 'delete') return restoreRecord(raw, entity, refId, now, extra);
  // update: put back the record as it was before the edit.
  const current = findRecord(raw, entity, refId);
  const restored = touch({ ...entry.before, id: refId, createdAt: current.createdAt, deletedAt: null, version: current.version }, {}, now);
  return appendLog(replaceRecord(raw, entity, refId, () => restored),
    { entity, action: 'update', refId, label: labelOf(entity, restored), fields: changedFields(current, restored), before: withoutKeys(current, new Set()), ...extra }, now);
}

// ── Housekeeping (on load) ────────────────────────────────────────────

/** Removes records deleted more than RECYCLE_DAYS ago. */
export function emptyExpiredBin(raw, now = new Date()) {
  const result = { ...raw };
  for (const entity of COLLECTIONS) {
    result[entity] = (raw[entity] || []).filter((record) => !record.deletedAt || now - Date.parse(record.deletedAt) <= RECYCLE_DAYS * DAY_MS);
  }
  return result;
}

/** Keeps HISTORY_DAYS / HISTORY_MAX entries; older edits drop their undo copy. */
export function pruneHistory(log, now = new Date()) {
  const since = now - HISTORY_DAYS * DAY_MS;
  const kept = (Array.isArray(log) ? log : []).filter((entry) => entry?.id && entry.entity && Date.parse(entry.at) >= since).slice(-HISTORY_MAX);
  let snapshots = 0;
  for (let index = kept.length - 1; index >= 0; index -= 1) {
    if (!kept[index].before) continue;
    snapshots += 1;
    if (snapshots > SNAPSHOTS_KEPT) {
      const { before: _dropped, ...rest } = kept[index];
      kept[index] = rest;
    }
  }
  return kept;
}

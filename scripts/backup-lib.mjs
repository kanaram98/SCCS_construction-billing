/**
 * Builds a restorable backup from the documents of the cloud workspace.
 * Pure (no Firebase here) so it is tested like the rest of the app. The result is
 * the same file the app's "Back up" button makes, so Settings → Restore from file opens it.
 */
import { fromDocuments } from '../src/backend/mapping.js';
import { createBackup } from '../src/domain/backup.js';
import { COLLECTIONS } from '../src/backend/schema.js';

/** The workspace collections that are copied (people and invitations are not part of a backup). */
export const BACKUP_COLLECTIONS = Object.values(COLLECTIONS).filter((name) => name !== 'members' && name !== 'invites');

/** Firestore timestamps become ISO text; everything else is kept as it is. */
export function plainData(value) {
  if (value && typeof value.toDate === 'function') return value.toDate().toISOString();
  if (Array.isArray(value)) return value.map(plainData);
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).map(([key, item]) => [key, plainData(item)]));
  return value;
}

/** @param docs [{ collection, id, data }] as read from the cloud */
export function buildBackup(docs, now = new Date()) {
  if (!docs.some((doc) => doc.collection === COLLECTIONS.bills)) {
    throw new Error('The workspace has no bills. Refusing to write an empty backup.');
  }
  const cleaned = docs.map((doc) => ({ ...doc, exists: true, data: plainData(doc.data) }));
  const state = fromDocuments(cleaned, {}, now);
  return {
    app: createBackup(state, now),
    documents: cleaned.map(({ collection, id, data }) => ({ collection, id, data })),
    counts: Object.fromEntries(BACKUP_COLLECTIONS.map((name) => [name, docs.filter((doc) => doc.collection === name).length]))
  };
}

export const backupStamp = (now = new Date()) => now.toISOString().slice(0, 10);

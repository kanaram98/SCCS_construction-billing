/**
 * Backup files: the whole app state wrapped with a format marker and version,
 * so a restore can reject unrelated JSON and backups from newer app versions.
 */
import { hydrateState } from './app-state.js';
import { tr } from '../i18n/translate.js';

export const BACKUP_FORMAT = 'construction-billing-backup';
export const BACKUP_VERSION = 1;
/** Remind the user to back up when the last backup is older than this. */
export const BACKUP_REMINDER_DAYS = 7;

const DAY_MS = 24 * 60 * 60 * 1000;

export function createBackup(state, now = new Date()) {
  return {
    format: BACKUP_FORMAT,
    version: BACKUP_VERSION,
    exportedAt: now.toISOString(),
    data: state
  };
}

export function backupFilename(now = new Date()) {
  return `construction-billing-backup-${now.toISOString().slice(0, 10)}.json`;
}

/**
 * Reads a backup file's text.
 * @returns {{ state: object, exportedAt: string, billCount: number }}
 * @throws {Error} with a user-facing message when the file can't be restored
 */
export function parseBackup(text) {
  let backup;
  try {
    backup = JSON.parse(text);
  } catch {
    throw new Error(tr('This file is not a valid backup.'));
  }
  if (backup?.format !== BACKUP_FORMAT || !backup.data) {
    throw new Error(tr('This file is not a Construction Billing backup.'));
  }
  if (Number(backup.version) > BACKUP_VERSION) {
    throw new Error(tr('This backup was made by a newer version of the app. Update the app and try again.'));
  }
  const state = hydrateState(backup.data);
  if (!state) throw new Error(tr('This backup does not contain any bills.'));
  return { state, exportedAt: backup.exportedAt || '', billCount: state.bills.length };
}

/** True when the user has measurements but no recent backup. */
export function needsBackupReminder(state, now = new Date()) {
  const hasEntries = state.bills.some((bill) => (bill.sections || []).some((section) =>
    (section.areas || []).some((area) => (area.items || []).length > 0)));
  if (!hasEntries) return false;
  const last = Date.parse(state.meta?.lastBackupAt || '');
  return !Number.isFinite(last) || now.getTime() - last > BACKUP_REMINDER_DAYS * DAY_MS;
}

/** Human-readable age of the last backup, e.g. "today", "3 days ago", or "never". */
export function describeLastBackup(state, now = new Date()) {
  const last = Date.parse(state.meta?.lastBackupAt || '');
  if (!Number.isFinite(last)) return tr('never');
  const days = Math.floor((now.getTime() - last) / DAY_MS);
  if (days <= 0) return tr('today');
  return days === 1 ? tr('yesterday') : tr('{count} days ago', { count: days });
}

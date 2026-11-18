import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import hi from '../../src/i18n/hi.js';
import { makeTranslator, setLanguage, tr, trn } from '../../src/i18n/translate.js';
import { MEASUREMENT_TYPES } from '../../src/domain/rates.js';
import { GST_TYPES, PAYMENT_STATUSES } from '../../src/domain/calculations.js';
import { PAYMENT_MODES } from '../../src/domain/payments.js';
import { BILL_SORTS } from '../../src/domain/bill-filters.js';
import * as print from '../../src/domain/print-settings.js';
import { NAVIGATION } from '../../src/config/app.js';
import { DOCUMENT_COLUMNS } from '../../src/documents/document-model.js';
import { LOG_TITLES } from '../../src/domain/labour-log.js';
import { FIELD_LABELS, HISTORY_FILTERS, HISTORY_TITLES } from '../../src/domain/history-log.js';
import { ROLES } from '../../src/domain/permissions.js';

/** Codes and examples that read the same in Hindi. */
const SAME_IN_HINDI = new Set(['PDF', 'UPI', 'UPI ID', 'IFSC', 'GSTIN', 'sqft', 'name@okbank', 'SBIN0001234', 'English', 'हिंदी', 'Language']);

function sourceFiles(dir) {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return sourceFiles(full);
    return /\.jsx?$/.test(entry.name) && entry.name !== 'hi.js' ? [full] : [];
  });
}

/** English keys passed literally to t()/tr()/trn() anywhere in src/. */
function keysInSource() {
  const keys = new Set();
  const literal = `'((?:[^'\\\\]|\\\\.)*)'`;
  const single = new RegExp(`\\b(?:t|tr|translate)\\(\\s*${literal}`, 'g');
  const plural = new RegExp(`\\btrn\\([^,]+,\\s*${literal},\\s*${literal}`, 'g');
  for (const file of sourceFiles(path.resolve('src'))) {
    const code = fs.readFileSync(file, 'utf8');
    for (const match of code.matchAll(single)) keys.add(match[1].replace(/\\'/g, "'"));
    for (const match of code.matchAll(plural)) { keys.add(match[1].replace(/\\'/g, "'")); keys.add(match[2].replace(/\\'/g, "'")); }
  }
  return keys;
}

/** Labels from fixed lists that are translated where they are displayed. */
function listLabels() {
  return [
    ...MEASUREMENT_TYPES.map((entry) => entry.label),
    ...PAYMENT_STATUSES.map((entry) => entry.label),
    ...Object.values(GST_TYPES), ...Object.values(PAYMENT_MODES), ...Object.values(BILL_SORTS),
    ...print.PRINT_DOCUMENTS.flatMap((entry) => [entry.label, entry.pdfTitle]),
    ...[print.ORIENTATIONS, print.HEADER_MODES, print.PAGE_BREAKS, print.SUMMARY_DETAILS, print.SIGNATURE_MODES, print.BILL_LANGUAGES].flatMap(Object.values),
    ...NAVIGATION.flatMap((entry) => [entry.label, entry.shortLabel].filter(Boolean)),
    ...Object.values(DOCUMENT_COLUMNS).flat(),
    ...Object.values(LOG_TITLES), 'Month closed', 'Undone', 'Deleted forever',
    ...Object.values(HISTORY_TITLES), ...Object.values(FIELD_LABELS), ...Object.values(HISTORY_FILTERS), ...Object.values(ROLES),
    'Not signed in. Bills are only on this device.', 'Connecting…', 'Syncing…', 'Synced. Your data is safe in the cloud.',
    'Offline. Changes are saved here and sync when you are back online.', 'Sync problem. Changes are kept on this device; try again later.', 'No access', 'Waiting: another account has changes on this phone.', 'Admin only', 'Cannot reach the server. Check the internet connection and try again.',
    'Bill', 'Rate', 'Client', 'Template', 'Restore it first', 'Too old to undo', 'Other details', 'Change',
    'Length', 'Width', 'Height', 'Section', 'Area', 'Floor', 'Room', 'Saving…', 'Saved on this device', 'Save failed'
  ];
}

test('every user-facing string has a Hindi translation', () => {
  const missing = [...keysInSource(), ...listLabels()]
    .filter((key) => /[A-Za-z]/.test(key) && !SAME_IN_HINDI.has(key) && !hi[key]);
  assert.deepEqual([...new Set(missing)].sort(), []);
});

test('Hindi translations keep the same {placeholders}', () => {
  const placeholders = (text) => [...text.matchAll(/\{(\w+)\}/g)].map((match) => match[1]).sort().join(',');
  const broken = Object.entries(hi).filter(([english, hindi]) => placeholders(english) !== placeholders(hindi)).map(([english]) => english);
  assert.deepEqual(broken, []);
});

test('translators fall back to English and fill placeholders', () => {
  const hindi = makeTranslator('hi');
  assert.equal(hindi('Add entry'), 'एंट्री जोड़ें');
  assert.equal(hindi('{name} deleted.', { name: 'Tiles' }), 'Tiles हटाया गया।');
  assert.equal(hindi('Not in the dictionary'), 'Not in the dictionary');
  setLanguage('hi');
  assert.equal(trn(3, '{count} entry', '{count} entries'), '3 एंट्री');
  setLanguage('en');
  assert.equal(tr('{count} days ago', { count: 2 }), '2 days ago');
});

/**
 * Converts between the app's raw state and workspace documents.
 *
 *   toDocuments(raw, { by })            → [{ collection, id, data }]   one entry per Firestore document
 *   fromDocuments(docs, { local })      → raw state                   (normalised with hydrateState)
 *
 * `by` is the signed-in account sending the data: it fills `updatedBy` /
 * `by` / `closedBy` where the device didn't record who made a change.
 * Device-only values (language, text size, open bill, onboarding) are never
 * sent; `fromDocuments` takes them from `local`.
 *
 * Only fields the schema knows are sent; anything else (left over from old
 * versions) is dropped. Lists keep their order through an `order` field.
 * `syncedAt` is not part of `data`: the sync layer adds the server time.
 */
import { hydrateState } from '../domain/app-state.js';
import { createBill } from '../domain/factories.js';
import { COLLECTIONS, DOCUMENT_SCHEMAS, SETTINGS_SCHEMAS } from './schema.js';

/** Drops undefined values (Firestore rejects them) and anything not plain JSON. */
const plain = (value) => JSON.parse(JSON.stringify(value));

/** Keeps only the top-level fields a strict schema allows. */
function pickKnown(schema, data) {
  const strict = schema.def?.catchall?.def?.type === 'never';
  if (!strict) return data;
  const known = Object.keys(schema.shape);
  return Object.fromEntries(Object.entries(data).filter(([key]) => known.includes(key)));
}

const withRecordMeta = (item, by) => ({
  ...item,
  createdAt: item.createdAt || '',
  updatedAt: item.updatedAt || item.createdAt || '',
  deletedAt: item.deletedAt || null,
  version: Number(item.version) || 1,
  updatedBy: item.updatedBy || by
});

/** Fields every item must have; saved data from older versions of the app can lack some. */
const REQUIRED_DEFAULTS = {
  bills: () => { const { id: _id, ...fields } = createBill(); return fields; },
  clients: () => ({ name: '', phone: '', address: '', gstin: '' }),
  rates: () => ({ name: '', unit: 'nos', type: 'count', rate: 0 }),
  templates: () => ({ name: '', type: 'area' }),
  projects: () => ({ name: '', clientId: '', client: '', address: '', status: 'running', agreedAmount: '', notes: '' }),
  advances: () => ({ projectId: '', amount: 0, mode: 'cash', note: '' }),
  expenses: () => ({ projectId: '', amount: 0, category: 'other', note: '' })
};

function record(collection, data) {
  const value = plain({ ...(REQUIRED_DEFAULTS[collection]?.() || {}), ...data });
  return { collection, id: value.id, data: pickKnown(DOCUMENT_SCHEMAS[collection], value) };
}

const setting = (name, data) => ({ collection: COLLECTIONS.settings, id: name, data: pickKnown(SETTINGS_SCHEMAS[name], plain({ ...data, id: name })) });

/** Groups `attendance[date][workerId]` into one document per month: marks[DD][workerId]. */
function attendanceDocuments(attendance) {
  const months = new Map();
  for (const [date, marks] of Object.entries(attendance || {})) {
    const month = date.slice(0, 7);
    if (!months.has(month)) months.set(month, {});
    months.get(month)[date.slice(8, 10)] = marks;
  }
  return [...months].map(([month, marks]) => ({ collection: COLLECTIONS.attendance, id: month, data: plain({ id: month, marks }) }));
}

/** Every workspace document for a raw state, sent by account `by`. */
export function toDocuments(raw, { by }) {
  if (!by) throw new Error('toDocuments needs the signed-in account (by).');
  const docs = [];
  for (const collection of ['bills', 'rates', 'clients', 'templates', 'projects', 'advances', 'expenses']) {
    (raw[collection] || []).forEach((item, order) => docs.push(record(collection, { ...withRecordMeta(item, by), order })));
  }
  const labour = raw.labour || {};
  (labour.workers || []).forEach((worker, order) => docs.push(record(COLLECTIONS.workers, { ...withRecordMeta(worker, by), order })));
  (labour.payments || []).forEach((payment, order) => docs.push(record(COLLECTIONS.labourPayments, { ...withRecordMeta(payment, by), order })));
  docs.push(...attendanceDocuments(labour.attendance));
  for (const [month, value] of Object.entries(labour.closedMonths || {})) {
    docs.push(record(COLLECTIONS.closedMonths, { id: month, closedAt: value.closedAt || '', closedBy: value.closedBy || by }));
  }
  (raw.log || []).forEach((entry) => docs.push(record(COLLECTIONS.history, { ...entry, by: entry.by || by })));
  (labour.log || []).forEach((entry) => docs.push(record(COLLECTIONS.labourLog, { ...entry, by: entry.by || by })));

  docs.push(setting('firm', { ...raw.firm, version: Number(raw.firm?.version) || 1, updatedBy: raw.firm?.updatedBy || by }));
  docs.push(setting('quotation', { ...raw.quotation, version: Number(raw.quotation?.version) || 1, updatedBy: raw.quotation?.updatedBy || by }));
  docs.push(setting('printSettings', raw.printSettings));
  return docs;
}

const byOrder = (a, b) => (a.order ?? 0) - (b.order ?? 0);
/** Newest first; the same on every phone. */
const byNewest = (a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')) || String(a.id).localeCompare(String(b.id));
const byTime = (a, b) => String(a.at).localeCompare(String(b.at));
const withoutOrder = ({ order: _order, ...rest }) => rest;
const withoutId = ({ id: _id, ...rest }) => rest;

/**
 * Builds raw app state from workspace documents. Device-only values come
 * from `local` (this device's current state). Returns null when there are no bills.
 */
export function fromDocuments(docs, { local } = {}, now = new Date()) {
  const of = (collection) => docs.filter((doc) => doc.collection === collection).map((doc) => doc.data);
  const settings = Object.fromEntries(of(COLLECTIONS.settings).map((data) => [data.id, withoutId(data)]));
  const attendance = {};
  for (const monthDoc of of(COLLECTIONS.attendance)) {
    for (const [day, marks] of Object.entries(monthDoc.marks || {})) attendance[`${monthDoc.id}-${day}`] = marks;
  }
  const saved = {
    bills: of(COLLECTIONS.bills).sort(byNewest).map(withoutOrder),
    rates: of(COLLECTIONS.rates).sort(byOrder).map(withoutOrder),
    clients: of(COLLECTIONS.clients).sort(byOrder).map(withoutOrder),
    templates: of(COLLECTIONS.templates).sort(byOrder).map(withoutOrder),
    projects: of(COLLECTIONS.projects).sort(byOrder).map(withoutOrder),
    advances: of(COLLECTIONS.advances).sort(byOrder).map(withoutOrder),
    expenses: of(COLLECTIONS.expenses).sort(byOrder).map(withoutOrder),
    log: of(COLLECTIONS.history).sort(byTime),
    firm: settings.firm,
    quotation: settings.quotation,
    printSettings: settings.printSettings,
    // Device-only
    preferences: local?.preferences,
    meta: local?.meta,
    activeBillId: local?.activeBillId,
    labour: {
      workers: of(COLLECTIONS.workers).sort(byOrder).map(withoutOrder),
      payments: of(COLLECTIONS.labourPayments).sort(byOrder).map(withoutOrder),
      attendance,
      closedMonths: Object.fromEntries(of(COLLECTIONS.closedMonths).map((data) => [data.id, { closedAt: data.closedAt, closedBy: data.closedBy }])),
      log: of(COLLECTIONS.labourLog).sort(byTime)
    }
  };
  return hydrateState(saved, now);
}

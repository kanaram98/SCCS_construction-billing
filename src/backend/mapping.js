/**
 * Converts between the app's raw state and cloud documents.
 *
 *   toDocuments(raw)   → [{ collection, id, data }]   one entry per Firestore document
 *   fromDocuments(docs) → raw state                   (normalised with hydrateState)
 *
 * Only fields the schema knows are sent; anything else (left over from old
 * versions) is dropped. Lists keep their order through an `order` field.
 * `syncedAt` is not part of `data`: the sync layer adds the server time.
 */
import { hydrateState } from '../domain/app-state.js';
import { COLLECTIONS, DOCUMENT_SCHEMAS, SCHEMA_VERSION, SETTINGS_SCHEMAS } from './schema.js';

/** Drops undefined values (Firestore rejects them) and anything not plain JSON. */
const plain = (value) => JSON.parse(JSON.stringify(value));

/** Keeps only the top-level fields a strict schema allows. */
function pickKnown(schema, data) {
  const strict = schema.def?.catchall?.def?.type === 'never';
  if (!strict) return data;
  const known = Object.keys(schema.shape);
  return Object.fromEntries(Object.entries(data).filter(([key]) => known.includes(key)));
}

const record = (collection, data, extra = {}) => {
  const value = plain({ ...data, ...extra });
  return { collection, id: value.id, data: pickKnown(DOCUMENT_SCHEMAS[collection], value) };
};

const withRecordMeta = (item) => ({
  ...item,
  createdAt: item.createdAt || '',
  updatedAt: item.updatedAt || item.createdAt || '',
  deletedAt: item.deletedAt || null,
  version: Number(item.version) || 1
});

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

/** Every document for a raw state. */
export function toDocuments(raw) {
  const docs = [];
  for (const collection of ['bills', 'rates', 'clients', 'templates']) {
    (raw[collection] || []).forEach((item, order) => docs.push(record(collection, withRecordMeta(item), { order })));
  }
  const labour = raw.labour || {};
  (labour.workers || []).forEach((worker, order) => docs.push(record(COLLECTIONS.workers, withRecordMeta(worker), { order })));
  (labour.payments || []).forEach((payment, order) => docs.push(record(COLLECTIONS.labourPayments, withRecordMeta(payment), { order })));
  docs.push(...attendanceDocuments(labour.attendance));
  for (const [month, value] of Object.entries(labour.closedMonths || {})) {
    docs.push({ collection: COLLECTIONS.closedMonths, id: month, data: { id: month, closedAt: value.closedAt || '' } });
  }
  (raw.log || []).forEach((entry) => docs.push(record(COLLECTIONS.history, entry)));
  (labour.log || []).forEach((entry) => docs.push(record(COLLECTIONS.labourLog, entry)));

  docs.push(setting('firm', { ...raw.firm, version: Number(raw.firm?.version) || 1 }));
  docs.push(setting('quotation', { ...raw.quotation, version: Number(raw.quotation?.version) || 1 }));
  docs.push(setting('printSettings', raw.printSettings));
  docs.push(setting('preferences', raw.preferences));
  docs.push(setting('app', { schemaVersion: SCHEMA_VERSION, activeBillId: raw.activeBillId, meta: raw.meta }));
  return docs;
}

const byOrder = (a, b) => (a.order ?? 0) - (b.order ?? 0);
const byTime = (a, b) => String(a.at).localeCompare(String(b.at));
const withoutOrder = ({ order: _order, ...rest }) => rest;
const withoutId = ({ id: _id, ...rest }) => rest;

/** Builds raw app state from documents. Returns null when there are no bills. */
export function fromDocuments(docs, now = new Date()) {
  const of = (collection) => docs.filter((doc) => doc.collection === collection).map((doc) => doc.data);
  const settings = Object.fromEntries(of(COLLECTIONS.settings).map((data) => [data.id, withoutId(data)]));
  const attendance = {};
  for (const monthDoc of of(COLLECTIONS.attendance)) {
    for (const [day, marks] of Object.entries(monthDoc.marks || {})) attendance[`${monthDoc.id}-${day}`] = marks;
  }
  const saved = {
    bills: of(COLLECTIONS.bills).sort(byOrder).map(withoutOrder),
    rates: of(COLLECTIONS.rates).sort(byOrder).map(withoutOrder),
    clients: of(COLLECTIONS.clients).sort(byOrder).map(withoutOrder),
    templates: of(COLLECTIONS.templates).sort(byOrder).map(withoutOrder),
    log: of(COLLECTIONS.history).sort(byTime),
    firm: settings.firm,
    quotation: settings.quotation,
    printSettings: settings.printSettings,
    preferences: settings.preferences,
    activeBillId: settings.app?.activeBillId,
    meta: settings.app?.meta,
    labour: {
      workers: of(COLLECTIONS.workers).sort(byOrder).map(withoutOrder),
      payments: of(COLLECTIONS.labourPayments).sort(byOrder).map(withoutOrder),
      attendance,
      closedMonths: Object.fromEntries(of(COLLECTIONS.closedMonths).map((data) => [data.id, { closedAt: data.closedAt }])),
      log: of(COLLECTIONS.labourLog).sort(byTime)
    }
  };
  return hydrateState(saved, now);
}

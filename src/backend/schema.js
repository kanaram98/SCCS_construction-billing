/**
 * Cloud database schema (Firestore) and validators for every document.
 *
 * Everything belongs to one signed-in owner and lives under users/{uid}:
 *
 *   owners/{uid}                       allow-list: only these accounts may use the database
 *   users/{uid}                        profile        { schemaVersion, createdAt }
 *   users/{uid}/bills/{id}             bill or estimate (measurements and payments inside)
 *   users/{uid}/rates/{id}             work-item rate
 *   users/{uid}/clients/{id}           saved client
 *   users/{uid}/templates/{id}         saved section / area template
 *   users/{uid}/settings/{name}        firm | quotation | printSettings | preferences | app
 *   users/{uid}/workers/{id}           labour worker
 *   users/{uid}/labourPayments/{id}    advance / wage payment
 *   users/{uid}/attendance/{YYYY-MM}   one document per month: marks by day and worker
 *   users/{uid}/closedMonths/{YYYY-MM} locked labour month
 *   users/{uid}/history/{id}           history of bills, rates, clients, templates, firm, quotation
 *   users/{uid}/labourLog/{id}         history of labour changes
 *
 * Records carry sync metadata (createdAt, updatedAt, deletedAt, version);
 * every write also sets `syncedAt` to the server time (added by the sync
 * layer, enforced by the security rules). These validators run in the app
 * before anything is sent; firestore.rules enforces the same limits on the
 * server, and tests keep the two in step.
 */
import * as z from 'zod';

export const SCHEMA_VERSION = 1;

export const COLLECTIONS = Object.freeze({
  bills: 'bills',
  rates: 'rates',
  clients: 'clients',
  templates: 'templates',
  settings: 'settings',
  workers: 'workers',
  labourPayments: 'labourPayments',
  attendance: 'attendance',
  closedMonths: 'closedMonths',
  history: 'history',
  labourLog: 'labourLog'
});

export const SETTINGS_DOCS = Object.freeze(['firm', 'quotation', 'printSettings', 'preferences', 'app']);

/** Size limits, shared with firestore.rules. */
export const LIMITS = Object.freeze({
  id: 100,
  shortText: 200,
  longText: 5000,
  image: 700000,
  billSections: 300,
  sectionAreas: 200,
  areaItems: 500,
  payments: 500
});

export const userPath = (uid) => `users/${uid}`;
export const docPath = (uid, collection, id) => `users/${uid}/${collection}/${id}`;

// ── Building blocks ───────────────────────────────────────────────────

const id = z.string().min(1).max(LIMITS.id);
const short = z.string().max(LIMITS.shortText);
const long = z.string().max(LIMITS.longText);
const isoTime = z.string().max(40);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const month = z.string().regex(/^\d{4}-\d{2}$/);
/** Amounts typed into forms are kept as text ('' or '1500'); calculated ones are numbers. */
const numberish = z.union([z.number().finite(), z.string().max(30)]);
const paymentMode = z.enum(['upi', 'cash', 'bank', 'cheque']);

/** Sync metadata on every record. */
const meta = {
  id,
  createdAt: isoTime,
  updatedAt: isoTime,
  deletedAt: isoTime.nullable(),
  version: z.int().min(1),
  /** Position in the app's list, so the order survives a round trip. */
  order: z.int().min(0).optional()
};

// ── Bills ─────────────────────────────────────────────────────────────

const item = z.looseObject({
  id,
  rateId: z.string().max(LIMITS.id).optional(),
  name: short,
  unit: z.string().max(20),
  type: z.string().max(20),
  rate: numberish,
  count: numberish.optional(),
  length: numberish.optional(),
  width: numberish.optional(),
  height: numberish.optional(),
  quantity: numberish.optional(),
  note: long.optional()
});
const area = z.looseObject({ id, name: short, items: z.array(item).max(LIMITS.areaItems) });
const section = z.looseObject({ id, name: short, areas: z.array(area).max(LIMITS.sectionAreas) });
const billPayment = z.looseObject({ id, date: isoDate, amount: z.number().finite(), mode: paymentMode, note: long });

export const billSchema = z.strictObject({
  ...meta,
  number: z.string().max(30),
  date: z.string().max(10),
  kind: z.enum(['bill', 'estimate']).optional(),
  isSample: z.boolean().optional(),
  projectName: short,
  clientId: z.string().max(LIMITS.id),
  client: short,
  clientPhone: z.string().max(30),
  clientAddress: long,
  clientGstin: z.string().max(20),
  firstLevelName: z.string().max(50),
  secondLevelName: z.string().max(50),
  discount: numberish,
  taxRate: numberish,
  gstEnabled: z.boolean(),
  gstType: z.enum(['intra', 'inter']),
  advance: numberish,
  payments: z.array(billPayment).max(LIMITS.payments),
  footer: long,
  sections: z.array(section).max(LIMITS.billSections),
  raSeriesId: z.string().max(LIMITS.id).optional(),
  raNumber: z.int().min(1).optional(),
  convertedBillId: z.string().max(LIMITS.id).optional(),
  sourceEstimateId: z.string().max(LIMITS.id).optional()
});

// ── Rates, clients, templates ─────────────────────────────────────────

export const rateSchema = z.strictObject({
  ...meta,
  name: short,
  unit: z.string().max(20),
  type: z.enum(['area', 'length', 'lenw', 'volume', 'count', 'direct']),
  rate: numberish
});

export const clientSchema = z.strictObject({
  ...meta,
  name: short,
  phone: z.string().max(30),
  address: long,
  gstin: z.string().max(20)
});

export const templateSchema = z.strictObject({
  ...meta,
  name: short,
  type: z.enum(['section', 'area']),
  content: z.union([section, area])
});

// ── Settings ──────────────────────────────────────────────────────────

const dataUrl = z.string().max(LIMITS.image).refine((value) => value === '' || value.startsWith('data:image/'), 'Must be an image');

export const firmSchema = z.strictObject({
  id: z.literal('firm'),
  createdAt: isoTime.optional(),
  updatedAt: isoTime.optional(),
  version: z.int().min(1),
  name: short,
  address: long,
  phone: z.string().max(30),
  gstin: z.string().max(20),
  gstRegistered: z.boolean(),
  bankName: short,
  accountName: short,
  accountNumber: z.string().max(40),
  ifsc: z.string().max(20),
  upiId: z.string().max(100),
  logo: dataUrl,
  signature: dataUrl,
  signatureLayout: z.looseObject({ x: z.number(), y: z.number(), width: z.number() }),
  brandingApplied: z.boolean().optional()
});

export const quotationSchema = z.strictObject({
  id: z.literal('quotation'),
  createdAt: isoTime.optional(),
  updatedAt: isoTime.optional(),
  version: z.int().min(1),
  title: short,
  clientName: short,
  validDays: z.int().min(0).max(3650),
  terms: long,
  disclaimer: long
});

/** Print layout choices; checked loosely (normalised again when loaded). */
export const printSettingsSchema = z.looseObject({ id: z.literal('printSettings'), paper: z.string().max(20), orientation: z.string().max(20) });

export const preferencesSchema = z.strictObject({
  id: z.literal('preferences'),
  language: z.enum(['en', 'hi']),
  textSize: z.string().max(20)
});

/** App-level values: which bill is open, onboarding and backup reminders. */
export const appSettingsSchema = z.strictObject({
  id: z.literal('app'),
  schemaVersion: z.int().min(1),
  activeBillId: z.string().max(LIMITS.id),
  meta: z.strictObject({ lastBackupAt: z.string().max(40), onboarded: z.boolean() })
});

export const SETTINGS_SCHEMAS = Object.freeze({
  firm: firmSchema,
  quotation: quotationSchema,
  printSettings: printSettingsSchema,
  preferences: preferencesSchema,
  app: appSettingsSchema
});

// ── Labour ────────────────────────────────────────────────────────────

export const workerSchema = z.strictObject({
  ...meta,
  name: short,
  phone: z.string().max(30),
  role: z.string().max(100),
  dailyWage: numberish,
  active: z.boolean()
});

export const labourPaymentSchema = z.strictObject({
  ...meta,
  workerId: id,
  date: isoDate,
  amount: z.number().finite().min(0),
  mode: paymentMode,
  note: long
});

const mark = z.strictObject({ units: z.number().min(0).max(3), wage: z.number().finite().min(0), at: isoTime });

/** One month of attendance: marks[DD][workerId]. */
export const attendanceMonthSchema = z.strictObject({
  id: month,
  marks: z.record(z.string().regex(/^\d{2}$/), z.record(id, mark))
});

export const closedMonthSchema = z.strictObject({ id: month, closedAt: isoTime });

// ── History ───────────────────────────────────────────────────────────

const historyBase = { id, at: isoTime, action: z.enum(['create', 'update', 'delete', 'restore', 'purge', 'close', 'unlock']), revertOf: id.optional() };

export const historyEntrySchema = z.strictObject({
  ...historyBase,
  entity: z.enum(['bills', 'rates', 'clients', 'templates', 'firm', 'quotation']),
  refId: id,
  label: z.looseObject({}),
  fields: z.array(z.string().max(50)).max(100).optional(),
  before: z.looseObject({}).optional()
});

export const labourLogEntrySchema = z.looseObject({
  ...historyBase,
  entity: z.enum(['attendance', 'payment', 'worker', 'month'])
});

/** Validator for each collection (settings are looked up by document name). */
export const DOCUMENT_SCHEMAS = Object.freeze({
  bills: billSchema,
  rates: rateSchema,
  clients: clientSchema,
  templates: templateSchema,
  workers: workerSchema,
  labourPayments: labourPaymentSchema,
  attendance: attendanceMonthSchema,
  closedMonths: closedMonthSchema,
  history: historyEntrySchema,
  labourLog: labourLogEntrySchema
});

/** Validates one document. Returns '' when valid, otherwise a short reason. */
export function validateDocument(collection, data) {
  const schema = collection === COLLECTIONS.settings ? SETTINGS_SCHEMAS[data?.id] : DOCUMENT_SCHEMAS[collection];
  if (!schema) return `Unknown document type: ${collection}/${data?.id}`;
  const result = schema.safeParse(data);
  if (result.success) return '';
  const issue = result.error.issues[0];
  return `${collection}/${data?.id}: ${issue.path.join('.') || '(document)'} ${issue.message}`;
}

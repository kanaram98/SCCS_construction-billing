/**
 * Cloud database schema (Firestore) and validators for every document.
 *
 * One shared workspace for the business; people join it as members:
 *
 *   owners/{email}                          may create a workspace (added once by hand)
 *   workspaces/{wid}                        { name, schemaVersion, createdAt, createdBy }
 *   workspaces/{wid}/members/{uid}          { uid, name, email, role: admin | contractor, addedAt }
 *   workspaces/{wid}/invites/{email}        { email, role, invitedAt, invitedBy }  (accepted on first sign-in)
 *   workspaces/{wid}/bills/{id}             bill or estimate (measurements and payments inside)
 *   workspaces/{wid}/rates/{id}             work-item rate
 *   workspaces/{wid}/clients/{id}           saved client
 *   workspaces/{wid}/templates/{id}         saved section / area template
 *   workspaces/{wid}/projects/{id}          project (site) for a client
 *   workspaces/{wid}/advances/{id}          advance received from a client, under a project
 *   workspaces/{wid}/expenses/{id}          site expense under a project
 *   workspaces/{wid}/settings/{name}        firm | quotation | printSettings
 *   workspaces/{wid}/workers/{id}           labour worker
 *   workspaces/{wid}/labourPayments/{id}    advance / wage payment
 *   workspaces/{wid}/attendance/{YYYY-MM}   one document per month: marks by day and worker
 *   workspaces/{wid}/closedMonths/{YYYY-MM} locked labour month
 *   workspaces/{wid}/history/{id}           history of bills, rates, clients, templates, firm, quotation
 *   workspaces/{wid}/labourLog/{id}         history of labour changes
 *
 * Language, text size, the open bill and onboarding stay on each device.
 *
 * Records carry sync metadata (createdAt, updatedAt, deletedAt, version) and
 * `updatedBy` (who changed it); history entries carry `by`. Every write also
 * sets `syncedAt` to the server time (added by the sync layer, enforced by the
 * rules). These validators run in the app before anything is sent;
 * firestore.rules enforces the same limits and the roles on the server, and
 * tests keep the two in step.
 */
import * as z from 'zod';
import { ROLES } from '../domain/permissions.js';

export const SCHEMA_VERSION = 1;

export const COLLECTIONS = Object.freeze({
  members: 'members',
  invites: 'invites',
  bills: 'bills',
  rates: 'rates',
  clients: 'clients',
  templates: 'templates',
  projects: 'projects',
  advances: 'advances',
  expenses: 'expenses',
  quotations: 'quotations',
  settings: 'settings',
  workers: 'workers',
  labourPayments: 'labourPayments',
  attendance: 'attendance',
  closedMonths: 'closedMonths',
  history: 'history',
  labourLog: 'labourLog'
});

export const SETTINGS_DOCS = Object.freeze(['firm', 'quotation', 'printSettings']);

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

export const workspacePath = (wid) => `workspaces/${wid}`;
export const docPath = (wid, collection, id) => `workspaces/${wid}/${collection}/${id}`;

// ── Building blocks ───────────────────────────────────────────────────

const id = z.string().min(1).max(LIMITS.id);
const short = z.string().max(LIMITS.shortText);
const long = z.string().max(LIMITS.longText);
const isoTime = z.string().max(40);
const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const month = z.string().regex(/^\d{4}-\d{2}$/);
const email = z.email().max(200);
const role = z.enum(Object.keys(ROLES));
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
  /** Account that made the latest change. */
  updatedBy: id,
  /** Position in the app's list, so the order survives a round trip. */
  order: z.int().min(0).optional()
};

// ── Workspace and people ──────────────────────────────────────────────

export const workspaceSchema = z.strictObject({
  name: short,
  schemaVersion: z.int().min(1),
  createdAt: isoTime,
  createdBy: id
});

export const memberSchema = z.strictObject({ uid: id, name: short, email, role, addedAt: isoTime });

export const inviteSchema = z.strictObject({ email, role, invitedAt: isoTime, invitedBy: id });

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
  name: short.optional(),
  date: z.string().max(10),
  kind: z.enum(['bill', 'estimate']).optional(),
  isSample: z.boolean().optional(),
  projectName: short,
  clientId: z.string().max(LIMITS.id),
  projectId: z.string().max(LIMITS.id).optional(),
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
  /** Stage of the bill: draft, ready (given to the client, takes payments) or submitted (closed). */
  status: z.enum(['draft', 'ready', 'submitted']).optional(),
  readyAt: isoTime.optional(),
  submittedAt: isoTime.optional(),
  /** Older versions of the app marked a final bill with these. */
  final: z.boolean().optional(),
  finalizedAt: isoTime.optional(),
  /** Firm details as printed when the bill was made ready. */
  firmSnapshot: z.looseObject({}).optional(),
  /** The quotation this bill or estimate is priced from, and its label (Q-0003 v2) saved with the bill. */
  quotationId: z.string().max(LIMITS.id).optional(),
  quotationLabel: short.optional(),
  cancelled: z.boolean().optional(),
  cancelledAt: isoTime.optional(),
  cancelReason: long.optional(),
  /** Locks, unlocks and cancellations with their reasons. */
  audit: z.array(z.looseObject({ at: isoTime, action: short, reason: long })).max(100).optional(),
  advanceAdjustments: z.array(z.strictObject({ id, advanceId: id, amount: z.number().finite().min(0), date: isoDate })).max(200).optional(),
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
  rate: numberish,
  /** Hidden from new entries; bills that used it are unchanged. */
  archived: z.boolean().optional()
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

// ── Projects, advances, expenses ───────────────────────────────────────

export const projectSchema = z.strictObject({
  ...meta,
  name: short,
  clientId: z.string().max(LIMITS.id),
  client: short,
  clientPhone: short.optional(),
  clientAddress: long.optional(),
  clientGstin: short.optional(),
  address: long,
  status: z.enum(['running', 'completed']),
  agreedAmount: numberish,
  notes: long
});

/** A numbered quotation for a project: a snapshot of work items and prices, draft until made final. */
export const quotationRecordSchema = z.strictObject({
  ...meta,
  projectId: id,
  number: z.string().max(30),
  rev: z.int().min(1),
  name: short,
  status: z.enum(['draft', 'final']),
  finalizedAt: isoTime.optional(),
  lines: z.array(z.looseObject({ rateId: id, name: short, unit: z.string().max(20), type: z.string().max(20), rate: z.number().finite().min(0) })).max(300)
});

export const advanceSchema = z.strictObject({
  ...meta,
  projectId: id,
  date: isoDate,
  amount: z.number().finite().min(0),
  mode: paymentMode,
  note: long
});

export const expenseSchema = z.strictObject({
  ...meta,
  projectId: id,
  date: isoDate,
  amount: z.number().finite().min(0),
  category: z.enum(['food', 'travel', 'fuel', 'tools', 'stay', 'other']),
  note: long
});

// ── Settings ──────────────────────────────────────────────────────────

const dataUrl = z.string().max(LIMITS.image).refine((value) => value === '' || value.startsWith('data:image/'), 'Must be an image');

export const firmSchema = z.strictObject({
  id: z.literal('firm'),
  createdAt: isoTime.optional(),
  updatedAt: isoTime.optional(),
  version: z.int().min(1),
  updatedBy: id,
  name: short,
  tagline: short.optional(),
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
  updatedBy: id,
  title: short,
  clientName: short,
  validDays: z.int().min(0).max(3650),
  terms: long,
  disclaimer: long
});

/** Print layout choices; checked loosely (normalised again when loaded). */
export const printSettingsSchema = z.looseObject({ id: z.literal('printSettings'), paper: z.string().max(20), orientation: z.string().max(20) });

export const SETTINGS_SCHEMAS = Object.freeze({
  firm: firmSchema,
  quotation: quotationSchema,
  printSettings: printSettingsSchema
});

// ── Labour ────────────────────────────────────────────────────────────

export const workerSchema = z.strictObject({
  ...meta,
  name: short,
  phone: z.string().max(30),
  role: z.string().max(100),
  dailyWage: numberish,
  active: z.boolean(),
  joinedOn: z.union([isoDate, z.literal('')]).optional(),
  leftOn: z.union([isoDate, z.literal('')]).optional()
});

export const labourPaymentSchema = z.strictObject({
  ...meta,
  workerId: id,
  date: isoDate,
  amount: z.number().finite().min(0),
  mode: paymentMode,
  note: long
});

const mark = z.strictObject({ units: z.number().min(0).max(3), wage: z.number().finite().min(0), at: isoTime, projectId: id.optional() });

/** One month of attendance: marks[DD][workerId]. */
export const attendanceMonthSchema = z.strictObject({
  id: month,
  marks: z.record(z.string().regex(/^\d{2}$/), z.record(id, mark))
});

export const closedMonthSchema = z.strictObject({ id: month, closedAt: isoTime, closedBy: id });

// ── History ───────────────────────────────────────────────────────────

const historyBase = {
  id,
  at: isoTime,
  /** Account that made the change. */
  by: id,
  action: z.enum(['create', 'update', 'delete', 'restore', 'purge', 'close', 'unlock', 'conflict']),
  revertOf: id.optional()
};

export const historyEntrySchema = z.strictObject({
  ...historyBase,
  entity: z.enum(['bills', 'rates', 'clients', 'templates', 'projects', 'advances', 'expenses', 'quotations', 'firm', 'quotation']),
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
  members: memberSchema,
  invites: inviteSchema,
  bills: billSchema,
  rates: rateSchema,
  clients: clientSchema,
  templates: templateSchema,
  projects: projectSchema,
  advances: advanceSchema,
  expenses: expenseSchema,
  quotations: quotationRecordSchema,
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
  return `${collection}/${data?.id ?? data?.uid ?? data?.email}: ${issue.path.join('.') || '(document)'} ${issue.message}`;
}

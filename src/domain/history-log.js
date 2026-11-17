/**
 * Readable History lines for bills, rates, clients, templates, firm details
 * and the quotation, e.g. "Bill changed" / "Bill 3 · Lake View" / "Changed: Client, Discount".
 */
import { billLabel } from './bill-kinds.js';

/** Titles per entity and action (translated where shown). */
export const HISTORY_TITLES = Object.freeze({
  'bills.create': 'Bill created',
  'bills.update': 'Bill changed',
  'bills.delete': 'Bill deleted',
  'bills.restore': 'Bill restored',
  'bills.purge': 'Bill deleted forever',
  'rates.create': 'Rate added',
  'rates.update': 'Rate changed',
  'rates.delete': 'Rate deleted',
  'rates.restore': 'Rate restored',
  'rates.purge': 'Rate deleted forever',
  'clients.create': 'Client added',
  'clients.update': 'Client changed',
  'clients.delete': 'Client deleted',
  'clients.restore': 'Client restored',
  'clients.purge': 'Client deleted forever',
  'templates.create': 'Template saved',
  'templates.update': 'Template changed',
  'templates.delete': 'Template deleted',
  'templates.restore': 'Template restored',
  'templates.purge': 'Template deleted forever',
  'firm.update': 'Firm details changed',
  'quotation.update': 'Quotation changed'
});

/** What a changed field is called (fields not listed show as "Other details"). */
export const FIELD_LABELS = Object.freeze({
  sections: 'Measurements',
  payments: 'Payments',
  client: 'Client',
  clientId: 'Client',
  clientPhone: 'Client',
  clientAddress: 'Client',
  clientGstin: 'Client',
  projectName: 'Project name',
  number: 'Number',
  date: 'Date',
  discount: 'Discount',
  advance: 'Advance',
  taxRate: 'GST',
  gstEnabled: 'GST',
  gstType: 'GST',
  footer: 'Notes',
  firstLevelName: 'Level names',
  secondLevelName: 'Level names',
  name: 'Name',
  rate: 'Rate',
  unit: 'Unit',
  type: 'Measured as',
  phone: 'Phone',
  address: 'Address',
  gstin: 'GSTIN',
  gstRegistered: 'GST',
  bankName: 'Bank details',
  accountName: 'Bank details',
  accountNumber: 'Bank details',
  ifsc: 'Bank details',
  upiId: 'UPI ID',
  title: 'Title',
  clientName: 'Client',
  validDays: 'Valid days',
  terms: 'Terms & conditions',
  disclaimer: 'Disclaimer'
});

/** Entity filter options for the History screen. */
export const HISTORY_FILTERS = Object.freeze({
  all: 'Everything',
  bills: 'Bills',
  rates: 'Rates',
  clients: 'Clients',
  templates: 'Templates',
  settings: 'Firm & quotation'
});

export function matchesFilter(entity, filter) {
  if (filter === 'all') return true;
  if (filter === 'settings') return entity === 'firm' || entity === 'quotation';
  return entity === filter;
}

/** Name of the record an entry is about. */
export function recordName(entity, label, t) {
  if (entity === 'bills') {
    const name = billLabel({ kind: label.kind, number: label.number || '', raNumber: label.raNumber }, t);
    return label.projectName ? `${name} · ${label.projectName}` : name;
  }
  if (entity === 'firm') return label.name || t('Firm details');
  if (entity === 'quotation') return label.title || t('Rate quotation');
  return label.name || '—';
}

/** @returns {{ title: string, lines: string[] }} */
export function describeHistoryEntry(entry, t) {
  const title = entry.action === 'conflict'
    ? t('Changed on another device')
    : t(HISTORY_TITLES[`${entry.entity}.${entry.action}`] || 'Change');
  const lines = [recordName(entry.entity, entry.label || {}, t)];
  if (entry.action === 'conflict') lines.push(t('The newer version was kept. Undo brings back the version from this device.'));
  if (entry.action === 'update' && entry.fields?.length) {
    const names = [...new Set(entry.fields.map((field) => t(FIELD_LABELS[field] || 'Other details')))];
    lines.push(t('Changed: {fields}', { fields: names.join(', ') }));
  }
  return { title, lines };
}

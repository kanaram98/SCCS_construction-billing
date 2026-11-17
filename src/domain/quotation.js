/**
 * Rate quotation: the list of work-item rates, printable at any time with the
 * firm's terms & conditions and a disclaimer.
 */
import { measurementTypeLabel } from './rates.js';
import { todayIso } from './formatters.js';

export const DEFAULT_TERMS = [
  'Rates are for labour only unless mentioned otherwise.',
  'Measurements will be taken on site after the work is completed.',
  '50% advance before starting the work; balance on completion.',
  'GST extra as applicable.'
].join('\n');

export const DEFAULT_DISCLAIMER = 'Rates may change with material prices or site conditions. Any extra work will be charged separately.';

export function createDefaultQuotation() {
  return {
    title: 'Rate quotation',
    clientName: '',
    validDays: 30,
    terms: DEFAULT_TERMS,
    disclaimer: DEFAULT_DISCLAIMER
  };
}

export function normalizeQuotation(saved) {
  const defaults = createDefaultQuotation();
  const value = saved && typeof saved === 'object' ? saved : {};
  const days = Number(value.validDays);
  return {
    ...defaults,
    ...value,
    validDays: Number.isFinite(days) && days >= 0 ? Math.round(days) : defaults.validDays
  };
}

/** Non-empty lines, for numbered terms. */
export function splitLines(text) {
  return String(text || '').split('\n').map((line) => line.trim()).filter(Boolean);
}

/** Date the quotation stays valid until, or '' when no validity is set. */
export function validUntil(quotation, today = todayIso()) {
  if (!quotation.validDays) return '';
  const date = new Date(`${today}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() + quotation.validDays);
  return date.toISOString().slice(0, 10);
}

/**
 * Table rows: [no., item, measured as, unit, rate].
 * @param {(text: string) => string} t translator for the measurement type
 * @param {(value: number) => string} money currency formatter
 */
export function quotationRows(rates, { t, money }) {
  return rates.map((rate, index) => [
    String(index + 1),
    rate.name || '',
    t(measurementTypeLabel(rate.type)),
    rate.unit || '',
    money(Number(rate.rate) || 0)
  ]);
}

export const QUOTATION_COLUMNS = ['No.', 'Work item', 'Measured as', 'Unit', 'Rate'];

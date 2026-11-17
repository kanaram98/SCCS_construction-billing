/**
 * Non-blocking format checks. They flag likely typos but never stop saving
 * or exporting, because real-world data (landlines, unusual sites) varies.
 */
import { parseFeetInches } from './measurements.js';
import { text, todayIso } from './formatters.js';

const GSTIN_PATTERN = /^\d{2}[A-Z]{5}\d{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;

/** Dimensions longer than this (in feet) are probably a typo, e.g. 150.4 for 15.4. */
export const LARGE_DIMENSION_FEET = 300;

export function gstinWarning(value) {
  const gstin = text(value).toUpperCase();
  return gstin && !GSTIN_PATTERN.test(gstin)
    ? 'GSTIN is usually 15 characters, e.g. 27ABCDE1234F1Z5.'
    : '';
}

/** Accepts 10-digit mobiles with optional +91 / 0 prefix, and spaces or dashes. */
export function phoneWarning(value) {
  const raw = text(value);
  if (!raw) return '';
  let digits = raw.replace(/\D/g, '');
  if (digits.length === 12 && digits.startsWith('91')) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith('0')) digits = digits.slice(1);
  return digits.length === 10 && /^[\d\s+\-()]+$/.test(raw) ? '' : 'Check the number: usually 10 digits.';
}

export function futureDateWarning(date, today = todayIso()) {
  return text(date) && date > today ? 'This date is in the future.' : '';
}

export function dimensionWarning(value) {
  return parseFeetInches(value) > LARGE_DIMENSION_FEET
    ? `Over ${LARGE_DIMENSION_FEET} ft. Check it (e.g. 15.4 not 150.4).`
    : '';
}

import { tr } from '../i18n/translate.js';

/**
 * Feet-and-inches measurement helpers.
 *
 * Dimensions are entered as `feet.inches` text, so `15.4` means 15 ft 4 in
 * (not 15.4 ft). Inches are limited to 0–11.
 */

const FEET_INCHES_PATTERN = /^(\d+)(?:\.(\d{1,2}))?$/;
const FEET_INCHES_FRACTION_PATTERN = /^(\d+)\.(\d{1,2})\.(\d{1,2})$/;
const DECIMAL_FEET_PATTERN = /^(\d+(?:\.\d+)?)\s*(?:ft|feet|f)$/i;
/** Fraction signs that can be typed or pasted after the inches: 10½, 10 ½, ½. */
const FRACTION_SIGNS = { '¼': 0.25, '½': 0.5, '¾': 0.75, '⅛': 0.125, '⅜': 0.375, '⅝': 0.625, '⅞': 0.875, '⅓': 1 / 3, '⅔': 2 / 3 };

/** Inches written after the foot mark: 10, 10.5, 10½, 10(1/2), 10 1/2, ½ or 1/2. Returns null when unreadable. */
function readInchPart(text) {
  const rest = text.trim();
  if (!rest) return 0;
  const sign = rest.match(/^(\d*)\s*([¼½¾⅛⅜⅝⅞⅓⅔])$/);
  if (sign) return Number(sign[1] || 0) + FRACTION_SIGNS[sign[2]];
  let match = rest.match(/^(\d+(?:\.\d+)?)$/);
  if (match) return Number(match[1]);
  match = rest.match(/^(\d+)\s*\(\s*(\d+)\s*\/\s*(\d+)\s*\)$/) || rest.match(/^(\d+)[\s-]+(\d+)\s*\/\s*(\d+)$/);
  if (match) return Number(match[3]) ? Number(match[1]) + Number(match[2]) / Number(match[3]) : null;
  match = rest.match(/^\(?\s*(\d+)\s*\/\s*(\d+)\s*\)?$/);
  if (match) return Number(match[2]) ? Number(match[1]) / Number(match[2]) : null;
  return null;
}

/**
 * Reads a dimension. These forms are understood:
 *   15.4        15 ft 4 in (feet.inches; inches 0 to 11)
 *   15.4.5      15 ft 4½ in (a third part is the part of an inch: .5 is half, .25 a quarter)
 *   0.7         0 ft 7 in
 *   4'10.5"     with marks: 4'10½", 4'10(1/2)", 0'6.25", 9'
 *   27.08ft     decimal feet
 * @returns {{ blank: true } | { error: string } | { inches: number, decimalFeet?: boolean }} `inches` is the total length in inches
 */
function readDimension(value) {
  const text = String(value ?? '').trim().replace(/[\u2019\u2032]/g, "'").replace(/[\u201D\u2033]/g, '"');
  if (!text) return { blank: true };
  const bad = { error: tr('Use feet.inches format, for example 15.4.') };
  const tooMany = { error: tr('Inches must be from 0 to 11.') };
  let match = text.match(FEET_INCHES_PATTERN);
  if (match) return Number(match[2] || 0) > 11 ? tooMany : { inches: Number(match[1]) * 12 + Number(match[2] || 0) };
  match = text.match(FEET_INCHES_FRACTION_PATTERN);
  if (match) return Number(match[2]) > 11 ? tooMany : { inches: Number(match[1]) * 12 + Number(match[2]) + Number(`0.${match[3]}`) };
  match = text.match(DECIMAL_FEET_PATTERN);
  if (match) return { inches: Number(match[1]) * 12, decimalFeet: true };
  if (!/['"]/.test(text)) return bad;
  const [feetText, ...afterFoot] = text.includes("'") ? text.replace(/"\s*$/, '').split("'") : ['', text.replace(/"\s*$/, '')];
  if (afterFoot.length > 1 || (feetText.trim() && !/^\d+$/.test(feetText.trim()))) return bad;
  const inches = readInchPart(afterFoot.length ? afterFoot[0] : feetText);
  if (inches === null || (!feetText.trim() && !(afterFoot.length ? afterFoot[0] : feetText).trim())) return bad;
  return inches >= 12 ? tooMany : { inches: Number(feetText.trim() || 0) * 12 + inches };
}

/** Returns a user-facing error for an invalid dimension, or `null` when valid or empty. */
export function feetInchesError(value) {
  return readDimension(value).error || null;
}

/** Converts a dimension (see readDimension) into decimal feet. Blank or invalid is 0. */
export function parseFeetInches(value) {
  const read = readDimension(value);
  return read.inches === undefined ? 0 : read.inches / 12;
}

/**
 * Parts of an inch that print as a fraction sign (10½"), like the labour sheet prints 1½P. These three are in every
 * PDF font; any other part of an inch prints as a decimal.
 */
const FRACTIONS = [[1 / 4, '¼'], [1 / 2, '½'], [3 / 4, '¾']];

function inchText(inches) {
  const whole = Math.floor(inches + 1e-9);
  const part = inches - whole;
  if (part < 0.005) return String(whole);
  const hit = FRACTIONS.find(([value]) => Math.abs(part - value) < 0.005);
  if (hit) return `${whole || ''}${hit[1]}`; // 10½, and just ½ under an inch
  return String(Number(inches.toFixed(2)));
}

/** A length in inches as `15' 7¼"`: feet, a space, then inches (a fraction sign for an exact ¼, ½ or ¾, else a decimal). */
function lengthText(totalInches) {
  const total = Math.round(Math.max(0, totalInches) * 100) / 100;
  let feet = Math.floor(total / 12 + 1e-9);
  let inches = Math.round((total - feet * 12) * 100) / 100;
  if (inches >= 12) { feet += 1; inches = 0; }
  return `${feet}' ${inchText(inches)}"`;
}

/** Formats `15.4` as `15' 4"` and `10.10.5` as `10' 10½"`. Decimal feet stay as feet. Blank or unreadable values give ''. */
export function formatDimension(value) {
  const read = readDimension(value);
  if (read.inches === undefined) return '';
  return read.decimalFeet ? `${Number((read.inches / 12).toFixed(3))} ft` : lengthText(read.inches);
}

// ── Calculating with feet and inches ──────────────────────────────────

const INCH_IN_METRES = 0.0254;
const SQFT_IN_SQM = 0.09290304;

/** Inches in a dimension (15.4 is 184; 4'10.5" is 58.5). Blank or invalid values count as 0. */
export function toInches(value) {
  return readDimension(value).inches || 0;
}

/**
 * Inches back to text, to the nearest quarter inch, in the form typed in the box: 184 is "15.4", 180 is "15",
 * and 187.25 is "15.7.25" (a third part is the part of an inch).
 */
export function inchesToText(totalInches) {
  const quarters = Math.round(Math.max(0, Number(totalInches) || 0) * 4);
  const total = Math.floor(quarters / 4);
  const part = ['', '25', '5', '75'][quarters % 4];
  const inches = total % 12;
  const feet = Math.floor(total / 12);
  if (part) return `${feet}.${inches}.${part}`;
  return inches ? `${feet}.${inches}` : String(feet);
}

/** Adds two lengths: 5.8 + 3.6 is 9.2 (5 ft 8 in + 3 ft 6 in = 9 ft 2 in). */
export function addFeetInches(a, b) {
  return inchesToText(toInches(a) + toInches(b));
}

/** Subtracts b from a. `negative` is true when b is longer than a (the text is then empty). */
export function subtractFeetInches(a, b) {
  const difference = toInches(a) - toInches(b);
  return difference < 0 ? { text: '', negative: true } : { text: inchesToText(difference), negative: false };
}

/** Room perimeter 2 × (length + width), as `feet.inches` text. */
export function perimeterFeetInches(length, width) {
  return inchesToText(2 * (toInches(length) + toInches(width)));
}

const round = (value, places) => Math.round(value * 10 ** places) / 10 ** places;

/** A length in feet.inches as metres, to 3 decimals. */
export function feetInchesToMetres(value) {
  return round(toInches(value) * INCH_IN_METRES, 3);
}

/** Metres as feet.inches text, to the nearest inch. */
export function metresToFeetInches(metres) {
  return inchesToText((Number(metres) || 0) / INCH_IN_METRES);
}

export const sqftToSqm = (sqft) => round((Number(sqft) || 0) * SQFT_IN_SQM, 3);
export const sqmToSqft = (sqm) => round((Number(sqm) || 0) / SQFT_IN_SQM, 2);

/** Length × width in square feet, to 2 decimals (the same figure a bill entry uses). */
export function areaSqft(length, width) {
  return round(parseFeetInches(length) * parseFeetInches(width), 2);
}

const plain = (value) => (String(value).trim() !== '' && Number.isFinite(Number(value)) ? Number(value) : null);

/** What the chosen operation gives: lines to show, and the feet.inches text that can be put into a box. */
export function calculateFeetInches(operation, conversion, a, b) {
  if (operation === 'convert') {
    const value = String(a).trim();
    if (!value) return { lines: [] };
    if (conversion === 'ft-m') {
      const error = feetInchesError(value);
      return error ? { error } : { lines: [`${formatDimension(value)} = ${feetInchesToMetres(value)} m`] };
    }
    const number = plain(value);
    if (number === null || number < 0) return { error: tr('Enter a number.') };
    if (conversion === 'm-ft') { const text = metresToFeetInches(number); return { lines: [`${number} m = ${formatDimension(text)}`], text }; }
    if (conversion === 'sqft-sqm') return { lines: [`${number} sqft = ${sqftToSqm(number)} sqm`] };
    return { lines: [`${number} sqm = ${sqmToSqft(number)} sqft`] };
  }
  const errorA = feetInchesError(a);
  const errorB = feetInchesError(b);
  if (errorA || errorB) return { error: errorA || errorB };
  if (!String(a).trim() || !String(b).trim()) return { lines: [] };
  if (operation === 'add') { const text = addFeetInches(a, b); return { lines: [`${formatDimension(text)} (${parseFeetInches(text).toFixed(2)} ft)`], text }; }
  if (operation === 'sub') {
    const result = subtractFeetInches(a, b);
    return result.negative ? { error: tr('B is longer than A.') } : { lines: [`${formatDimension(result.text)} (${parseFeetInches(result.text).toFixed(2)} ft)`], text: result.text };
  }
  if (operation === 'perimeter') { const text = perimeterFeetInches(a, b); return { lines: [`2 × (${formatDimension(a)} + ${formatDimension(b)}) = ${formatDimension(text)}`], text }; }
  const sqft = areaSqft(a, b);
  return { lines: [`${formatDimension(a)} × ${formatDimension(b)} = ${sqft} sqft`, `${sqftToSqm(sqft)} sqm`], area: sqft };
}

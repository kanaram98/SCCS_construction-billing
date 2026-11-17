/**
 * Feet-and-inches measurement helpers.
 *
 * Dimensions are entered as `feet.inches` text, so `15.4` means 15 ft 4 in
 * (not 15.4 ft). Inches are limited to 0–11.
 */

const FEET_INCHES_PATTERN = /^(\d+)(?:\.(\d{1,2}))?$/;
const DISPLAY_PATTERN = /^(-?\d+)(?:\.(\d{1,2}))?$/;

/** Returns a user-facing error for an invalid dimension, or `null` when valid or empty. */
export function feetInchesError(value) {
  const text = String(value ?? '').trim();
  if (!text) return null;
  const match = text.match(FEET_INCHES_PATTERN);
  if (!match) return 'Use feet.inches format, for example 15.4.';
  if (Number(match[2] || 0) > 11) return 'Inches must be from 0 to 11.';
  return null;
}

/** Converts a `feet.inches` value (or a legacy `[feet, inches]` pair) into decimal feet. */
export function parseFeetInches(value) {
  if (Array.isArray(value)) {
    const feet = Number(value[0]);
    const inches = Number(value[1]);
    if (!Number.isFinite(feet) || !Number.isFinite(inches) || feet < 0 || inches < 0 || inches > 11) return 0;
    return feet + inches / 12;
  }
  if (feetInchesError(value)) return 0;
  const match = String(value ?? '').trim().match(FEET_INCHES_PATTERN);
  if (!match) return 0;
  return (Number(match[1]) || 0) + (Number(match[2]) || 0) / 12;
}

/** Returns the inches part of a `feet.inches` value. */
export function inchesPart(value) {
  const match = String(value ?? '').trim().match(/^-?\d+\.(\d{1,2})$/);
  return match ? Number(match[1]) : 0;
}

/** Formats `15.4` as `15'4"`. Returns an empty string for blank or unreadable values. */
export function formatDimension(value) {
  const match = String(value ?? '').trim().match(DISPLAY_PATTERN);
  return match ? `${match[1]}'${match[2] || 0}"` : '';
}

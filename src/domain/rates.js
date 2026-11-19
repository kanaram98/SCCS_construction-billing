import { formatDimension } from './measurements.js';
import { tr } from '../i18n/translate.js';

export const DEFAULT_RATES = Object.freeze([
  { id: 'floor-tiles', name: 'Floor tiles', unit: 'sqft', type: 'area', rate: 85 },
  { id: 'skirting', name: 'Skirting', unit: 'rft', type: 'length', rate: 30 },
  { id: 'gas-hole', name: 'Gas hole', unit: 'nos', type: 'count', rate: 250 }
]);

/** How a work item is measured, shown in the "Measured as" picker. */
export const MEASUREMENT_TYPES = Object.freeze([
  { id: 'area', label: 'Length × breadth' },
  { id: 'length', label: 'Length' },
  { id: 'lenw', label: 'Length (width noted)' },
  { id: 'volume', label: 'Length × breadth × height' },
  { id: 'count', label: 'Count (nos)' },
  { id: 'direct', label: 'Enter quantity' }
]);

/**
 * Dimension fields used by each measurement type, in display order.
 * `required: false` means the field is recorded but does not affect the quantity.
 */
const DIMENSION_FIELDS = Object.freeze({
  area: [{ key: 'length', label: 'Length', required: true }, { key: 'width', label: 'Width', required: true }],
  length: [{ key: 'length', label: 'Length', required: true }],
  lenw: [{ key: 'length', label: 'Length', required: true }, { key: 'width', label: 'Width', required: false }],
  volume: [
    { key: 'length', label: 'Length', required: true },
    { key: 'width', label: 'Width', required: true },
    { key: 'height', label: 'Height', required: true }
  ],
  count: [],
  direct: []
});

export function getDimensionFields(type) {
  return DIMENSION_FIELDS[type] || [];
}

export function usesDimension(type, key) {
  return getDimensionFields(type).some((field) => field.key === key);
}

/** Direct-quantity items have no count; every other type multiplies by a count. */
export function usesCount(type) {
  return type !== 'direct';
}

export function createRate() {
  return { name: 'New work item', unit: 'nos', type: 'count', rate: 0 };
}

export function measurementTypeLabel(type) {
  return MEASUREMENT_TYPES.find((entry) => entry.id === type)?.label || type;
}

/** Field errors for the rate form, keyed by field ('' when valid). */
export function getRateErrors(rate) {
  const value = Number(rate.rate);
  return {
    name: String(rate.name ?? '').trim() ? '' : tr('Enter an item name.'),
    unit: String(rate.unit ?? '').trim() ? '' : tr('Enter a unit, e.g. sqft.'),
    type: MEASUREMENT_TYPES.some((entry) => entry.id === rate.type) ? '' : tr('Choose how it is measured.'),
    rate: String(rate.rate ?? '').trim() !== '' && Number.isFinite(value) && value >= 0 ? '' : tr('Enter a rate of zero or more.')
  };
}

export function isRateValid(rate) {
  return Object.values(getRateErrors(rate)).every((error) => !error);
}

/**
 * Finds the work item behind a bill entry. The entry keeps the price it was made with
 * (so changing a price never rewrites existing bills); if the work item is gone, the
 * entry's own saved copy is used.
 */
export function resolveRate(item, rates) {
  const live = rates.find((rate) => rate.id === item.rateId);
  if (!live) return item;
  // The price an entry was made with stays; name, unit and how it is measured follow the work item.
  const own = item.rate;
  return own === undefined || own === null || own === '' ? live : { ...live, rate: own };
}

/** Human-readable measurement summary for an entry, e.g. `12'0" × 10'6"`. */
export function describeMeasurement(item, rate) {
  if (rate.type === 'direct') return tr('Manual quantity');
  if (rate.type === 'count') return tr('Count');
  const dimensions = getDimensionFields(rate.type)
    .filter((field) => field.required || item[field.key])
    .map((field) => formatDimension(item[field.key]))
    .filter(Boolean);
  return dimensions.join(' × ') || tr('Measurements needed');
}

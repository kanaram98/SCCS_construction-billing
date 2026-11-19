import { formatDimension } from './measurements.js';
import { tr } from '../i18n/translate.js';

/**
 * The labour rates of the firm's civil work quotation. Area work is priced per sqft (length × width × nos);
 * running-feet work per rft (length × nos, the width is only noted).
 */
export const CIVIL_LABOUR_RATES = Object.freeze([
  { id: 'slab-chipping', name: "Slab Chipping & Cleaning", unit: 'sqft', type: 'area', rate: 30 },
  { id: 'waterproofing-coat', name: "Water Proofing Chemical Coating (Double Coat)", unit: 'sqft', type: 'area', rate: 20 },
  { id: 'reti-slab-finishing', name: "1\" Reti Cement Slab Finishing", unit: 'sqft', type: 'area', rate: 20 },
  { id: 'brick-katka-khoba', name: "Brick Katka Khoba", unit: 'sqft', type: 'area', rate: 25 },
  { id: 'araldite-reti-dana', name: "Araldite Reti-Dana Bonding", unit: 'rft', type: 'lenw', rate: 15 },
  { id: 'granite-frame-fitting', name: "Granite Window & Door Frame Cutting & Fitting", unit: 'rft', type: 'lenw', rate: 100 },
  { id: 'granite-moulding', name: "Granite Moulding", unit: 'rft', type: 'lenw', rate: 85 },
  { id: 'pcc-tile-leveling', name: "Flooring P.C.C Tile Leveling", unit: 'sqft', type: 'area', rate: 25 },
  { id: 'tile-cutting-6x4', name: "6' x 4' (feet) Tile Cutting & Fitting", unit: 'sqft', type: 'area', rate: 90 },
  { id: 'wall-tile-cutting-2x4', name: "2' x 4' (feet) Wall Tile Cutting & Fitting", unit: 'sqft', type: 'area', rate: 70 },
  { id: 'tile-cutting-2x2', name: "2' x 2' (feet) Tile Cutting & Fitting", unit: 'sqft', type: 'area', rate: 60 },
  { id: 'pata-chamfer-granite', name: "Pata Chemfer Granite", unit: 'rft', type: 'lenw', rate: 55 },
  { id: 'dhar-polish', name: "Dhar Polish", unit: 'rft', type: 'lenw', rate: 35 }
]);

export const DEFAULT_RATES = Object.freeze([...CIVIL_LABOUR_RATES]);

/** The civil work rates this list does not have yet (matched by name), as new rates with their own ids. */
export function missingCivilRates(rates) {
  const have = new Set((rates || []).map((rate) => String(rate.name || '').trim().toLowerCase()));
  return CIVIL_LABOUR_RATES.filter((rate) => !have.has(rate.name.toLowerCase())).map((rate) => ({ ...rate }));
}

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
  perimeter: [{ key: 'length', label: 'Length', required: true }, { key: 'width', label: 'Width', required: true }],
  wall: [
    { key: 'length', label: 'Length', required: true },
    { key: 'width', label: 'Width', required: true },
    { key: 'height', label: 'Height', required: true }
  ],
  count: [],
  direct: []
});

/**
 * How one entry can be measured, whatever its work item says: the entry picks the way (a skirting entry
 * can be a plain length or a room perimeter). `calc` on the entry holds the choice; empty follows the work item.
 */
export const ENTRY_FORMULAS = Object.freeze([
  { id: 'area', label: 'Length × breadth', formula: 'Length × Width × Nos', unit: 'sqft' },
  { id: 'length', label: 'Length', formula: 'Length × Nos', unit: 'rft' },
  { id: 'perimeter', label: 'Room perimeter', formula: '2 × (Length + Width) × Nos', unit: 'rft' },
  { id: 'wall', label: 'Wall area (all four walls)', formula: '2 × (Length + Width) × Height × Nos', unit: 'sqft' },
  { id: 'volume', label: 'Length × breadth × height', formula: 'Length × Width × Height × Nos', unit: 'cft' },
  { id: 'count', label: 'Count (nos)', formula: 'Nos', unit: 'nos' },
  { id: 'direct', label: 'Enter quantity', formula: 'Quantity', unit: '' }
]);

/** Units suggested when an entry is typed as a quantity (the only way of measuring where the unit is free). */
export const UNIT_CHOICES = Object.freeze(['sqft', 'sqm', 'rft', 'm', 'cft', 'cum', 'nos']);

/** The unit that goes with a way of measuring (a perimeter is in rft), or '' when it has none. */
export function formulaUnit(type) {
  return ENTRY_FORMULAS.find((entry) => entry.id === type)?.unit || '';
}

export function formulaLabel(type) {
  return ENTRY_FORMULAS.find((entry) => entry.id === type)?.label || measurementTypeLabel(type);
}

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
  // The price an entry was made with stays; name and unit follow the work item, and so does how it is measured
  // unless the entry chose its own way (`calc`).
  const own = item.rate;
  const base = !live ? item : own === undefined || own === null || own === '' ? live : { ...live, rate: own };
  return measuredAs(base, item.calc, item.calcUnit);
}

/**
 * The work item as one entry measures it. The entry may pick another way of measuring (`calc`); the unit then goes
 * with that way (a perimeter is in rft). Only an entry typed as a quantity has a free unit (`calcUnit`).
 */
export function measuredAs(base, calc, calcUnit) {
  const type = calc && calc !== base.type && ENTRY_FORMULAS.some((entry) => entry.id === calc) ? calc : base.type;
  const own = typeof calcUnit === 'string' ? calcUnit.trim() : '';
  let unit = base.unit;
  if (type === 'direct') unit = own || base.unit;
  else if (type !== base.type) unit = formulaUnit(type) || base.unit;
  return type === base.type && unit === base.unit ? base : { ...base, type, unit };
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

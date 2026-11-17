import { DEFAULT_RATES } from './rates.js';
import { newId } from './ids.js';
import { todayIso } from './formatters.js';

/** Converts a legacy `[feet, inches]` dimension into `feet.inches` text. */
function legacyDimension(value) {
  return Array.isArray(value) ? `${value[0] || 0}.${value[1] || 0}` : value || '';
}

function migrateItem(item, rates) {
  // Legacy ids may be numbers or strings, so compare loosely.
  // eslint-disable-next-line eqeqeq
  const rate = rates.find((entry) => entry.id == item.rid) || {};
  return {
    id: String(item.id ?? newId()),
    rateId: String(item.rid ?? ''),
    name: rate.name || 'Work item',
    unit: rate.unit || '',
    type: rate.type || 'count',
    rate: Number(rate.rate) || 0,
    count: item.n ?? 1,
    length: legacyDimension(item.l),
    width: legacyDimension(item.b),
    height: legacyDimension(item.h),
    quantity: item.q ?? 0,
    note: item.d || ''
  };
}

function migrateBill(oldBill, billIndex, rates) {
  const oldProject = oldBill.p || {};
  return {
    id: String(oldBill.id ?? newId()),
    number: String(oldProject.no || billIndex + 1),
    date: oldProject.date || todayIso(),
    projectName: oldProject.name || '',
    client: oldProject.client || '',
    clientAddress: oldProject.caddr || '',
    clientGstin: oldProject.cgst || '',
    firstLevelName: oldProject.l1 || 'Section',
    secondLevelName: oldProject.l2 || 'Area',
    discount: oldProject.disc || '',
    taxRate: oldProject.gst || '',
    advance: oldProject.adv || '',
    footer: oldProject.foot || '',
    sections: (oldBill.floors || []).map((floor) => ({
      id: String(floor.id ?? newId()),
      name: floor.name || 'Section',
      areas: (floor.rooms || []).map((room) => ({
        id: String(room.id ?? newId()),
        name: room.name || 'Area',
        items: (room.items || []).map((item) => migrateItem(item, rates))
      }))
    }))
  };
}

/** Migrates data saved by the original standalone app (`billing_v1`). */
export function migrateLegacyState(legacy) {
  if (!legacy || !Array.isArray(legacy.bills)) return null;
  const rates = Array.isArray(legacy.rates) ? legacy.rates : DEFAULT_RATES;
  const bills = legacy.bills.map((oldBill, index) => migrateBill(oldBill, index, rates));
  // eslint-disable-next-line eqeqeq
  const active = bills.find((bill) => bill.id == legacy.bid) || bills[0];
  return {
    bills,
    activeBillId: active?.id || null,
    rates: rates.map((rate) => ({ ...rate, id: String(rate.id) })),
    firm: legacy.firm || { name: '', address: '', phone: '', gstin: '', bank: '' }
  };
}

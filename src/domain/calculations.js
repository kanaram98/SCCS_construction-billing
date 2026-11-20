import { parseFeetInches } from './measurements.js';
import { resolveRate } from './rates.js';
import { roundTo2 } from './formatters.js';
import { sumAdjustments, sumPayments } from './payments.js';

function nonNegativeNumber(value) {
  const number = Number(value);
  return Number.isFinite(number) && number >= 0 ? number : 0;
}

export function getItemQuantity(item, rate) {
  const count = nonNegativeNumber(item.count);
  const length = parseFeetInches(item.length);
  const width = parseFeetInches(item.width);
  const height = parseFeetInches(item.height);
  const quantity = {
    area: length * width * count,
    length: length * count,
    lenw: length * count,
    volume: length * width * height * count,
    perimeter: 2 * (length + width) * count,
    wall: 2 * (length + width) * height * count,
    count,
    direct: nonNegativeNumber(item.quantity)
  }[rate?.type] || 0;
  return roundTo2(quantity);
}

export function getLineAmount(item, rate) {
  return Math.round(getItemQuantity(item, rate) * nonNegativeNumber(rate?.rate));
}

export function getItemsTotal(items, rates) {
  return (items || []).reduce((sum, item) => sum + getLineAmount(item, resolveRate(item, rates)), 0);
}

/**
 * The lines of a group of entries (a room, or a floor's rooms together): entries of the same work item with the
 * same unit and price are added into one line. The quantity is the sum of the entries' quantities and the amount is
 * that quantity × the price, rounded to a rupee, so a line always reads as quantity × rate.
 * @returns {{ key: string, rateId?: string, name: string, unit: string, rate: number, type: string, quantity: number, amount: number, items: object[] }[]}
 */
export function groupItemLines(items, rates) {
  const groups = new Map();
  for (const item of items || []) {
    const rate = resolveRate(item, rates);
    const key = `${item.rateId || item.name || ''}|${rate.unit || ''}|${nonNegativeNumber(rate.rate)}`;
    const group = groups.get(key) || { key, rateId: item.rateId, name: rate.name || item.name, unit: rate.unit || '', rate: nonNegativeNumber(rate.rate), type: rate.type, quantity: 0, items: [] };
    group.quantity += getItemQuantity(item, rate);
    group.items.push(item);
    groups.set(key, group);
  }
  return [...groups.values()].map((group) => {
    const quantity = roundTo2(group.quantity);
    return { ...group, quantity, amount: Math.round(quantity * group.rate) };
  });
}

/** How a bill adds up: 'room' (new bills: one line per work item in each room) or 'entry' (older bills: every entry). */
export const billStyleOf = (bill) => (bill?.billStyle === 'room' ? 'room' : 'entry');

export function getAreaTotal(area, rates, style = 'entry') {
  return style === 'room'
    ? groupItemLines(area.items, rates).reduce((sum, line) => sum + line.amount, 0)
    : getItemsTotal(area.items, rates);
}

export function getSectionTotal(section, rates, style = 'entry') {
  return (section.areas || []).reduce((sum, area) => sum + getAreaTotal(area, rates, style), 0);
}

/** Whether GST applies to this bill. Bills saved before the switch existed keep their GST. */
export function hasGst(bill) {
  return bill.gstEnabled !== false;
}

export function getBillTotals(bill, rates) {
  const style = billStyleOf(bill);
  const subtotal = (bill.sections || []).reduce((sum, section) => sum + getSectionTotal(section, rates, style), 0);
  const discount = nonNegativeNumber(bill.discount);
  const taxRate = hasGst(bill) ? Math.min(100, nonNegativeNumber(bill.taxRate)) : 0;
  const tax = Math.round(Math.max(0, subtotal - discount) * taxRate / 100);
  const total = Math.max(0, subtotal - discount + tax);
  const advance = nonNegativeNumber(bill.advance);
  const received = sumPayments(bill);
  const adjusted = sumAdjustments(bill);
  const cashPaid = advance + received; // money received on this bill itself
  const paid = cashPaid + adjusted; // plus project advance applied to it
  // A bill closed with a discount ("client pays less") owes that much less; the bill total itself does not change.
  const writtenOff = bill.settlement?.kind === 'discount' ? nonNegativeNumber(bill.settlement.amount) : 0;
  return { subtotal, discount, tax, total, advance, received, adjusted, cashPaid, paid, writtenOff, balance: total - paid - writtenOff };
}

/** How GST is shown: split into CGST + SGST within a state, or IGST between states. */
export const GST_TYPES = Object.freeze({
  intra: 'CGST + SGST (same state)',
  inter: 'IGST (other state)'
});

const percent = (value) => `${Number(value.toFixed(3))}%`;

/**
 * Tax lines for the bill's GST type. The parts always add up to `totals.tax`.
 * @returns {{ label: string, amount: number }[]} empty when there is no tax
 */
export function getTaxLines(bill, totals) {
  if (!totals.tax) return [];
  const rate = Math.min(100, nonNegativeNumber(bill.taxRate));
  if (bill.gstType === 'inter') return [{ label: `IGST (${percent(rate)})`, amount: totals.tax }];
  const central = Math.round(totals.tax / 2);
  return [
    { label: `CGST (${percent(rate / 2)})`, amount: central },
    { label: `SGST (${percent(rate / 2)})`, amount: totals.tax - central }
  ];
}

export const PAYMENT_STATUSES = Object.freeze([
  { id: 'unpaid', label: 'Unpaid' },
  { id: 'partial', label: 'Partially paid' },
  { id: 'paid', label: 'Paid' }
]);

export function paymentStatusLabel(status) {
  return PAYMENT_STATUSES.find((entry) => entry.id === status)?.label || 'Unpaid';
}

/** Payment status from the advance plus recorded payments. */
export function getPaymentStatus(bill, rates, totals = getBillTotals(bill, rates)) {
  const { total, paid } = totals;
  if (total <= 0) return 'unpaid';
  if (paid >= total) return 'paid';
  if (paid > 0) return 'partial';
  return 'unpaid';
}

/** Totals and status for one bill, computed once for list views. */
export function summarizeBill(bill, rates) {
  const totals = getBillTotals(bill, rates);
  return { totals, status: getPaymentStatus(bill, rates, totals) };
}

/** Groups every entry in the bill by work item, summing quantities and amounts. */
export function aggregateItemTotals(bill, rates) {
  const grouped = new Map();
  const roomStyle = billStyleOf(bill) === 'room';
  (bill.sections || []).forEach((section) => (section.areas || []).forEach((area) => {
    if (roomStyle) {
      // A room-style bill adds up room by room, so the item totals are the sum of the room lines and tie to the bill.
      groupItemLines(area.items, rates).forEach((line) => {
        const key = line.rateId || line.name || `item-${grouped.size}`;
        const group = grouped.get(key) || { name: line.name, unit: line.unit, type: line.type, rate: line.rate, quantity: 0, amount: 0 };
        group.quantity += line.quantity;
        group.amount += line.amount;
        grouped.set(key, group);
      });
      return;
    }
    (area.items || []).forEach((item) => {
      const rate = resolveRate(item, rates);
      const key = item.rateId || item.name || `item-${grouped.size}`;
      const group = grouped.get(key) || {
        name: rate.name || item.name,
        unit: rate.unit || item.unit,
        type: rate.type,
        rate: rate.rate,
        quantity: 0,
        amount: 0
      };
      group.quantity += getItemQuantity(item, rate);
      group.amount += getLineAmount(item, rate);
      grouped.set(key, group);
    });
  }));
  return [...grouped.values()].map((group) => ({ ...group, quantity: roundTo2(group.quantity) }));
}

export function countBillContents(bill) {
  const sections = bill.sections || [];
  return sections.reduce((counts, section) => {
    const areas = section.areas || [];
    counts.areas += areas.length;
    counts.items += areas.reduce((sum, area) => sum + (area.items || []).length, 0);
    return counts;
  }, { sections: sections.length, areas: 0, items: 0 });
}

export function countSectionItems(section) {
  return (section.areas || []).reduce((sum, area) => sum + (area.items || []).length, 0);
}

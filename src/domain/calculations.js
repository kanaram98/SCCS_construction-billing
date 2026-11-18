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

export function getAreaTotal(area, rates) {
  return getItemsTotal(area.items, rates);
}

export function getSectionTotal(section, rates) {
  return (section.areas || []).reduce((sum, area) => sum + getAreaTotal(area, rates), 0);
}

/** Whether GST applies to this bill. Bills saved before the switch existed keep their GST. */
export function hasGst(bill) {
  return bill.gstEnabled !== false;
}

export function getBillTotals(bill, rates) {
  const subtotal = (bill.sections || []).reduce((sum, section) => sum + getSectionTotal(section, rates), 0);
  const discount = nonNegativeNumber(bill.discount);
  const taxRate = hasGst(bill) ? Math.min(100, nonNegativeNumber(bill.taxRate)) : 0;
  const tax = Math.round(Math.max(0, subtotal - discount) * taxRate / 100);
  const total = Math.max(0, subtotal - discount + tax);
  const advance = nonNegativeNumber(bill.advance);
  const received = sumPayments(bill);
  const adjusted = sumAdjustments(bill);
  const cashPaid = advance + received; // money received on this bill itself
  const paid = cashPaid + adjusted; // plus project advance applied to it
  return { subtotal, discount, tax, total, advance, received, adjusted, cashPaid, paid, balance: total - paid };
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
  (bill.sections || []).forEach((section) => (section.areas || []).forEach((area) =>
    (area.items || []).forEach((item) => {
      const rate = resolveRate(item, rates);
      const key = item.rateId || item.name || `item-${grouped.size}`;
      const group = grouped.get(key) || {
        name: rate.name || item.name,
        unit: rate.unit || item.unit,
        rate: rate.rate,
        quantity: 0,
        amount: 0
      };
      group.quantity += getItemQuantity(item, rate);
      group.amount += getLineAmount(item, rate);
      grouped.set(key, group);
    })));
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

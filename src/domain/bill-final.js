/**
 * A final bill is locked: its prices are frozen (each item keeps the rate it had
 * when the bill was finalized, even if the Rates list changes later) and its
 * measurements, discount and GST cannot be edited. Payments can still be added.
 * Reopening links the items to the live rates again.
 */
import { resolveRate } from './rates.js';

export const isFinal = (bill) => Boolean(bill?.final);

/** Copies each item's current rate into the item and detaches it from the live rate. */
export function finalizeBill(bill, rates, now = new Date()) {
  if (isFinal(bill)) return bill;
  return {
    ...bill,
    final: true,
    finalizedAt: now.toISOString(),
    sections: (bill.sections || []).map((section) => ({
      ...section,
      areas: (section.areas || []).map((area) => ({
        ...area,
        items: (area.items || []).map((item) => {
          const rate = resolveRate(item, rates);
          const { rateId, ...rest } = item;
          return { ...rest, name: rate.name, unit: rate.unit, type: rate.type, rate: rate.rate, sourceRateId: rateId || item.sourceRateId || '' };
        })
      }))
    }))
  };
}

/** Unlocks the bill; items follow the live rates again where those rates still exist. */
export function reopenBill(bill, rates) {
  if (!isFinal(bill)) return bill;
  const { final: _final, finalizedAt: _at, ...rest } = bill;
  return {
    ...rest,
    sections: (bill.sections || []).map((section) => ({
      ...section,
      areas: (section.areas || []).map((area) => ({
        ...area,
        items: (area.items || []).map((item) => {
          const { sourceRateId, ...others } = item;
          return sourceRateId && rates.some((rate) => rate.id === sourceRateId) ? { ...others, rateId: sourceRateId } : others;
        })
      }))
    }))
  };
}

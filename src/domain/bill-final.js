/**
 * Marking a bill ready freezes it: each entry keeps the price it was made with and is detached
 * from the live Rates list, and the firm details are saved as printed. Going back to draft
 * (the contractor re-edits, e.g. to add a discount) links the entries to the rates again; the
 * prices they already have stay.
 */
import { resolveRate } from './rates.js';
import { canMoveToDraft, isDraft, isFinal, isReady, withAudit } from './bill-guard.js';

export { isFinal };

/** The firm details printed on a bill; copied into a ready bill so later changes do not alter it. */
const FIRM_SNAPSHOT_FIELDS = ['name', 'tagline', 'address', 'phone', 'gstin', 'gstRegistered'];
export const firmSnapshot = (firm) => Object.fromEntries(FIRM_SNAPSHOT_FIELDS.filter((key) => firm?.[key] !== undefined).map((key) => [key, firm[key]]));

/** The firm as printed on this bill: frozen at the time it was marked ready. */
export const firmForBill = (bill, firm) => (bill?.firmSnapshot ? { ...firm, ...bill.firmSnapshot } : firm);

/** Draft → ready: copies each entry's price and detaches it from the live rate. */
export function markReady(bill, rates, now = new Date(), firm = null) {
  if (!isDraft(bill)) return bill;
  return withAudit({
    ...bill,
    status: 'ready',
    readyAt: now.toISOString(),
    ...(firm ? { firmSnapshot: firmSnapshot(firm) } : {}),
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
  }, 'ready', '', now);
}

/**
 * Ready → draft. The contractor may do this only while no money is on the bill; the admin always
 * (`admin: true`), and then the reason is kept. Entries follow the rates again where those still exist.
 */
export function backToDraft(bill, rates, { reason = '', admin = false, now = new Date() } = {}) {
  if (!isReady(bill) || !canMoveToDraft(bill, { admin })) return bill;
  const { readyAt: _at, firmSnapshot: _firm, ...rest } = bill;
  return withAudit({
    ...rest,
    status: 'draft',
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
  }, 'back-to-draft', reason, now);
}

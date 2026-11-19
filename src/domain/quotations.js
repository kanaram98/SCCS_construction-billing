/**
 * Quotations: a named, numbered set of prices agreed with the client of one project.
 *
 *   quotation: { id, projectId, number: 'Q-0003', rev: 1, name, status: 'draft' | 'final', lines, finalizedAt? }
 *   lines:     [{ rateId, name, unit, type, rate }]   a snapshot of the work items and their prices
 *
 * A draft can be edited by anyone who works on the bills. Final freezes it for good; changing a
 * final quotation means making a new version (same number, rev + 1), which only the admin does.
 * A bill or estimate points at one quotation (`quotationId`, with its label saved on the bill) and
 * prices new entries from it; every entry keeps the price it was made with.
 *
 * The standard Rates list stays the starting point: a new quotation is a copy of it.
 */
import { newId } from './ids.js';
import { isEntryLocked } from './bill-guard.js';

export const isQuotationFinal = (quotation) => quotation?.status === 'final';

/** 'Q-0003' or 'Q-0003 v2'. */
export const quotationLabel = (quotation) => (quotation ? `${quotation.number}${(quotation.rev || 1) > 1 ? ` v${quotation.rev}` : ''}` : '');

/** A quotation of a project, newest first. */
export const quotationsOfProject = (quotations, projectId) =>
  quotations.filter((quotation) => quotation.projectId === projectId).sort((a, b) => String(b.createdAt || '').localeCompare(String(a.createdAt || '')) || b.rev - a.rev);

export function nextQuotationNumber(quotations) {
  const highest = quotations.reduce((max, quotation) => Math.max(max, Number(/^Q-(\d+)/.exec(quotation.number || '')?.[1]) || 0), 0);
  return `Q-${String(highest + 1).padStart(4, '0')}`;
}

const line = (rate) => ({ rateId: rate.id, name: rate.name, unit: rate.unit, type: rate.type, rate: Number(rate.rate) || 0 });

/** A new draft quotation for a project: a copy of today's standard rates (retired items left out). */
export function createQuotation({ projectId, name, rates, quotations }) {
  return {
    id: newId(),
    projectId,
    number: nextQuotationNumber(quotations),
    rev: 1,
    name: String(name || '').trim() || 'Quotation',
    status: 'draft',
    lines: rates.filter((rate) => !rate.archived).map(line)
  };
}

export const finalizeQuotation = (quotation, now = new Date()) =>
  (isQuotationFinal(quotation) ? quotation : { ...quotation, status: 'final', finalizedAt: now.toISOString() });

const META = ['createdAt', 'updatedAt', 'deletedAt', 'version', 'updatedBy', 'order', 'finalizedAt', 'syncedAt'];

/** A new draft copy of a quotation with the next revision number. */
export function newQuotationVersion(quotations, quotation) {
  const rev = quotations.filter((entry) => entry.number === quotation.number).reduce((max, entry) => Math.max(max, entry.rev || 1), 0) + 1;
  const copy = Object.fromEntries(Object.entries(quotation).filter(([key]) => !META.includes(key)));
  return { ...copy, id: newId(), rev, status: 'draft', lines: quotation.lines.map((entry) => ({ ...entry })) };
}

export const setLinePrice = (quotation, rateId, price) => ({
  ...quotation,
  lines: quotation.lines.map((entry) => (entry.rateId === rateId ? { ...entry, rate: Number(price) || 0 } : entry))
});

export const removeLine = (quotation, rateId) => ({ ...quotation, lines: quotation.lines.filter((entry) => entry.rateId !== rateId) });

export const addLine = (quotation, rate) => (quotation.lines.some((entry) => entry.rateId === rate.id) ? quotation : { ...quotation, lines: [...quotation.lines, line(rate)] });

/** The lines as work items (for printing and for pricing). */
export const quotationRates = (quotation) => (quotation?.lines || []).map((entry) => ({ id: entry.rateId, name: entry.name, unit: entry.unit, type: entry.type, rate: entry.rate }));

/**
 * The Rates list priced from a quotation: its lines override the standard price; items it does not
 * list keep the standard price. With no quotation, the standard rates.
 */
export function quotedRates(rates, quotation) {
  if (!quotation) return rates;
  const priced = new Map(quotation.lines.map((entry) => [entry.rateId, entry]));
  const known = new Set(rates.map((rate) => rate.id));
  const own = rates.map((rate) => (priced.has(rate.id) ? { ...rate, rate: priced.get(rate.id).rate } : rate));
  const gone = quotationRates(quotation).filter((rate) => !known.has(rate.id)); // work items deleted since
  return [...own, ...gone];
}

/** How many bills and estimates point at a quotation. */
export const quotationUsage = (quotationId, bills) => bills.filter((bill) => bill.quotationId === quotationId).length;

/** Where a work item is used: entries, bills, and how many of those bills are still drafts. */
export function rateUsage(rateId, bills) {
  let entries = 0;
  const used = new Set();
  const drafts = new Set();
  for (const bill of bills) {
    for (const section of bill.sections || []) {
      for (const area of section.areas || []) {
        for (const item of area.items || []) {
          if (item.rateId !== rateId && item.sourceRateId !== rateId) continue;
          entries += 1;
          used.add(bill.id);
          if (!isEntryLocked(bill) && item.rateId === rateId) drafts.add(bill.id);
        }
      }
    }
  }
  return { entries, bills: used.size, drafts: drafts.size };
}

/**
 * Re-prices the entries of one work item in every draft bill.
 * `priceFor(bill)` gives the price for that bill, or null to leave the bill alone.
 */
export function repriceDrafts(bills, rateId, priceFor) {
  return bills.map((bill) => {
    if (isEntryLocked(bill)) return bill;
    const price = priceFor(bill);
    if (price === null || price === undefined) return bill;
    let changed = false;
    const sections = (bill.sections || []).map((section) => ({
      ...section,
      areas: (section.areas || []).map((area) => ({
        ...area,
        items: (area.items || []).map((item) => {
          if (item.rateId !== rateId || Number(item.rate) === Number(price)) return item;
          changed = true;
          return { ...item, rate: price };
        })
      }))
    }));
    return changed ? { ...bill, sections } : bill;
  });
}

/** Ids of every entry in a bill. */
export function itemIds(bill) {
  return new Set((bill.sections || []).flatMap((section) => (section.areas || []).flatMap((area) => (area.items || []).map((item) => item.id))));
}

/** Sets entries to the price in `rates`, except those whose id is in `keepIds`. */
export function repriceBill(bill, rates, keepIds = new Set()) {
  return {
    ...bill,
    sections: (bill.sections || []).map((section) => ({
      ...section,
      areas: (section.areas || []).map((area) => ({
        ...area,
        items: (area.items || []).map((item) => {
          const rate = keepIds.has(item.id) ? null : rates.find((entry) => entry.id === item.rateId);
          return rate ? { ...item, rate: rate.rate } : item;
        })
      }))
    }))
  };
}

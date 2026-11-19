/** Searching a bill's entries by work item, note, unit, measurement or section/area name. */
import { describeMeasurement, resolveRate } from './rates.js';

const normalize = (value) => String(value ?? '').toLowerCase();

export function itemMatches(item, rates, query) {
  const rate = resolveRate(item, rates);
  const haystack = [rate.name, item.name, item.note, rate.unit, describeMeasurement(item, rate)].map(normalize).join(' ');
  const squash = (value) => value.replace(/\s+/g, ''); // 12'6" finds 12' 6"
  return haystack.includes(query) || squash(haystack).includes(squash(query));
}

/**
 * Narrows the bill to what matches `query`. A matching section or area name
 * keeps everything inside it; otherwise only matching entries are kept.
 * @returns {Array<{ section: object, areas: Array<{ area: object, items: object[] }> }> | null}
 *   null when the query is blank (show everything)
 */
export function searchEntries(sections, rates, rawQuery) {
  const query = normalize(rawQuery).trim();
  if (!query) return null;
  return sections.flatMap((section) => {
    const sectionMatches = normalize(section.name).includes(query);
    const areas = section.areas.flatMap((area) => {
      const keepAll = sectionMatches || normalize(area.name).includes(query);
      const items = keepAll ? area.items : area.items.filter((item) => itemMatches(item, rates, query));
      return keepAll || items.length ? [{ area, items }] : [];
    });
    return sectionMatches || areas.length ? [{ section, areas }] : [];
  });
}

export function countSearchResults(results) {
  return (results || []).reduce((sum, { areas }) => sum + areas.reduce((count, { items }) => count + items.length, 0), 0);
}

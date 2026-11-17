/**
 * Names the app generates (sample bill content, "Floor 3"-style defaults) are
 * saved in the language that was active when they were created. When the user
 * switches language, those untouched generated names are converted too.
 * Anything the user typed themselves never matches and is left alone.
 */
import { makeTranslator } from '../i18n/translate.js';

/** English source text of every name the app can generate. */
export const GENERATED_NAMES = Object.freeze([
  'Section', 'Area', 'Floor', 'Room',
  'Sample: 2BHK flat (you can delete this)', 'Sample client',
  'Ground floor', 'First floor', 'Hall', 'Kitchen', 'Bedroom', 'Vitrified 2×2'
]);

/** Map from a generated name in one language to the same name in another. */
function nameMap(from, to) {
  const source = makeTranslator(from);
  const target = makeTranslator(to);
  return new Map(GENERATED_NAMES.map((key) => [source(key), target(key)]));
}

/** Converts one value if it is a generated name, including numbered ones like "मंज़िल 3". */
function convert(value, map) {
  if (typeof value !== 'string' || !value) return value;
  if (map.has(value)) return map.get(value);
  const numbered = value.match(/^(.*) (\d+)$/);
  if (numbered && map.has(numbered[1])) return `${map.get(numbered[1])} ${numbered[2]}`;
  return value;
}

/** Returns bills with generated names converted from one language to another. */
export function relabelGeneratedNames(bills, from, to) {
  if (!from || !to || from === to) return bills;
  const map = nameMap(from, to);
  return bills.map((bill) => ({
    ...bill,
    projectName: convert(bill.projectName, map),
    client: convert(bill.client, map),
    sections: (bill.sections || []).map((section) => ({
      ...section,
      name: convert(section.name, map),
      areas: (section.areas || []).map((area) => ({
        ...area,
        name: convert(area.name, map),
        items: (area.items || []).map((item) => ({ ...item, note: convert(item.note, map) }))
      }))
    }))
  }));
}

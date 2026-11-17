import { newId } from './ids.js';
import { todayIso } from './formatters.js';
import { tr } from '../i18n/translate.js';

export function createBill(number = '1') {
  return {
    id: newId(),
    number,
    date: todayIso(),
    projectName: '',
    clientId: '',
    client: '',
    clientPhone: '',
    clientAddress: '',
    clientGstin: '',
    firstLevelName: 'Section',
    secondLevelName: 'Area',
    discount: '',
    taxRate: '',
    gstType: 'intra',
    advance: '',
    payments: [],
    footer: '',
    sections: []
  };
}

export function createSection(name, areas = []) {
  return { id: newId(), name, areas };
}

export function createArea(name, items = []) {
  return { id: newId(), name, items };
}

/** New bill item that snapshots the rate's name, unit, type and price. */
export function createItem(rate, values = {}) {
  return {
    count: 1,
    length: '',
    width: '',
    height: '',
    quantity: 0,
    note: '',
    ...values,
    id: newId(),
    rateId: rate.id,
    name: rate.name,
    unit: rate.unit,
    type: rate.type,
    rate: rate.rate
  };
}

/** Copies items with fresh ids. */
export function cloneItems(items = []) {
  return items.map((item) => ({ ...item, id: newId() }));
}

/** Deep-copies a section/area tree with fresh ids at every level. */
export function cloneSections(sections = []) {
  return sections.map((section) => ({
    ...section,
    id: newId(),
    areas: (section.areas || []).map((area) => ({ ...area, id: newId(), items: cloneItems(area.items) }))
  }));
}

/** Next numeric bill number after the highest existing one. */
export function getNextBillNumber(bills) {
  return String(Math.max(0, ...bills.map((entry) => Number.parseInt(entry.number, 10) || 0)) + 1);
}

export function duplicateBill(source, number) {
  const copy = structuredCloneSafe(source);
  return {
    ...copy,
    id: newId(),
    number,
    projectName: tr('{name} (copy)', { name: source.projectName || tr('Untitled') }),
    payments: [],
    sections: cloneSections(copy.sections)
  };
}

function structuredCloneSafe(value) {
  return typeof structuredClone === 'function' ? structuredClone(value) : JSON.parse(JSON.stringify(value));
}

/** Default label for the next section/area, e.g. "Floor 3". */
export function nextLevelName(levelName, fallback, existingCount) {
  return `${tr(levelName || fallback)} ${existingCount + 1}`;
}

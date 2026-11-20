/**
 * Renderer-independent model of each printable document.
 *
 * `buildDocument` returns the table columns and the rows split into "chunks";
 * every chunk after the first starts on a new page. The HTML print preview and
 * the PDF exporter both render from this model so they always agree.
 *
 * Row kinds: normal | section | area | total | sectionTotal | grandTotal | words
 */
import {
  aggregateItemTotals,
  billStyleOf,
  getAreaTotal,
  groupItemLines,
  getBillTotals,
  getItemQuantity,
  getLineAmount,
  getSectionTotal,
  getTaxLines
} from '../domain/calculations.js';
import { resolveRate, usesCount, usesDimension } from '../domain/rates.js';
import { formatQuantity } from '../domain/formatters.js';
import { resolveLayout } from '../domain/bill-layout.js';
import { formatDimension } from '../domain/measurements.js';
import { amountInWordsFor } from '../domain/amount-in-words.js';
import { makeTranslator } from '../i18n/translate.js';

/** Full-width italic row with the amount in words. */
const wordsRow = (amount, context) => ({
  kind: 'words',
  cells: [context.t('Amount in words: {words}', { words: amountInWordsFor(amount, context.language) })]
});

export const DOCUMENT_COLUMNS = Object.freeze({
  bill: ['Item', 'Qty', 'Unit', 'Rate', 'Amount'],
  measurement: ['Item', 'Nos', 'Length', 'Width', 'Height', 'Qty', 'Unit'],
  summary: ['Category', 'Amount'],
  items: ['Item', 'Qty', 'Unit', 'Rate', 'Amount']
});

/** Row kinds that span the full table width as a heading band. */
export const BAND_KINDS = new Set(['section', 'area']);

const row = (kind, cells) => ({ kind, cells });

/** Label + amount row padded to the 5-column bill/items layout. */
const amountRow = (kind, label, amount) => row(kind, [label, '', '', '', amount]);

function numbered(label, index, settings) {
  return `${settings.rowNumbers ? `${index + 1}. ` : ''}${label}`;
}

function itemRow(documentType, item, rate, index, context, { name: nameOverride } = {}) {
  const { settings, money } = context;
  const name = nameOverride ?? `${numbered(item.name || context.t('Work item'), index, settings)}${item.note ? `\n${item.note}` : ''}`;
  const quantity = formatQuantity(getItemQuantity(item, rate), rate.type);
  if (documentType === 'measurement') {
    const dimension = (key) => usesDimension(rate.type, key) ? formatDimension(item[key]) : '';
    return row('normal', [
      name,
      usesCount(rate.type) ? String(item.count || '') : '',
      dimension('length'),
      dimension('width'),
      dimension('height'),
      quantity,
      rate.unit || ''
    ]);
  }
  return row('normal', [name, quantity, rate.unit || '', money(rate.rate), money(getLineAmount(item, rate))]);
}

/** One line of the bill for a group of entries of the same work item (a room's, or a floor's). */
function lineRow(line, index, context) {
  const { settings, money } = context;
  return row('normal', [numbered(line.name || context.t('Work item'), index, settings), formatQuantity(line.quantity, line.type), line.unit, money(line.rate), money(line.amount)]);
}

const sumLines = (lines) => lines.reduce((sum, line) => sum + line.amount, 0);
const sectionItems = (section) => (section.areas || []).flatMap((area) => area.items || []);

/** What the section's lines add up to in the layout being printed. */
function displayedSectionSum(section, context) {
  if (context.layout === 'floor') return sumLines(groupItemLines(sectionItems(section), context.rates));
  if (context.layout === 'room') return (section.areas || []).reduce((sum, area) => sum + sumLines(groupItemLines(area.items, context.rates)), 0);
  return getSectionTotal(section, context.rates, 'entry');
}

/** A group's entries in a measurement sheet, with a total row (shown for a group of several, always for a floor). */
function groupMeasurementRows(group, context, { place, always, nameOf }) {
  const rate = (item) => resolveRate(item, context.rates);
  const rows = group.items.map((item, index) => itemRow('measurement', item, rate(item), index, context, { name: nameOf(item) }));
  if (group.items.length > 1 || always) {
    rows.push(row('groupTotal', [
      context.t('{item} · {place} total (goes to the bill)', { item: group.name, place }),
      '', '', '', '', formatQuantity(group.quantity, group.type), group.unit
    ]));
  }
  return rows;
}

function areaRows(documentType, area, context) {
  const rows = [row('area', [area.name])];
  const { layout } = context;
  if (documentType === 'measurement' && layout === 'room') {
    groupItemLines(area.items, context.rates).forEach((group) => {
      rows.push(...groupMeasurementRows(group, context, {
        place: area.name,
        always: false,
        nameOf: (item) => `${item.name || context.t('Work item')}${item.note ? `\n${item.note}` : ''}`
      }));
    });
    return rows;
  }
  if (documentType === 'bill' && layout === 'room') {
    const lines = groupItemLines(area.items, context.rates);
    lines.forEach((line, index) => rows.push(lineRow(line, index, context)));
    rows.push(amountRow('total', context.t('{name} total', { name: area.name }), context.money(sumLines(lines))));
    return rows;
  }
  (area.items || []).forEach((item, index) => {
    rows.push(itemRow(documentType, item, resolveRate(item, context.rates), index, context));
  });
  if (documentType === 'bill') {
    rows.push(amountRow('total', context.t('{name} total', { name: area.name }), context.money(getAreaTotal(area, context.rates, 'entry'))));
  }
  return rows;
}

/** The section total row of a bill. A "Round off" row comes first when the lines shown differ from the real total. */
function sectionTotalRow(documentType, section, context) {
  if (documentType !== 'bill') return [];
  const real = getSectionTotal(section, context.rates, billStyleOf(context.bill));
  const difference = real - displayedSectionSum(section, context);
  return [
    ...(difference ? [amountRow('round', context.t('Round off'), `${difference > 0 ? '+' : '−'} ${context.money(Math.abs(difference))}`)] : []),
    amountRow('sectionTotal', context.t('{name} total', { name: section.name }), context.money(real))
  ];
}

/** A floor shown as one set of lines for all its rooms (the "By floor" layout). */
function floorRows(documentType, section, context) {
  const groups = groupItemLines(sectionItems(section), context.rates);
  if (documentType === 'bill') return groups.map((line, index) => lineRow(line, index, context));
  const roomOf = new Map();
  (section.areas || []).forEach((area) => (area.items || []).forEach((item) => roomOf.set(item, area.name)));
  return groups.flatMap((group) => [
    row('area', [group.name]),
    ...groupMeasurementRows(group, context, {
      place: section.name,
      always: true,
      nameOf: (item) => `${roomOf.get(item) || ''}${item.note ? ` · ${item.note}` : ''}`
    })
  ]);
}

function sectionRows(documentType, section, context) {
  const byFloor = context.layout === 'floor' && (documentType === 'bill' || documentType === 'measurement');
  return [
    row('section', [section.name]),
    ...(byFloor ? floorRows(documentType, section, context) : (section.areas || []).flatMap((area) => areaRows(documentType, area, context))),
    ...sectionTotalRow(documentType, section, context)
  ];
}

/** Bill and measurement sheet rows, split according to the page-break setting. */
function detailChunks(documentType, bill, context) {
  const sections = bill.sections || [];
  const { pageBreak } = context.settings;
  if (!sections.length) return [[row('normal', [context.t('No entries yet')])]];
  if (pageBreak === 'none') return [sections.flatMap((section) => sectionRows(documentType, section, context))];
  // By floor has no rooms to break between, so a page per room becomes a page per floor.
  if (pageBreak === 'section' || context.layout === 'floor') return sections.map((section) => sectionRows(documentType, section, context));

  // One page per area; the section heading travels with its first area.
  return sections.flatMap((section) => {
    const areas = section.areas || [];
    if (!areas.length) return [[row('section', [section.name]), row('normal', [context.t('No areas yet')])]];
    return areas.map((area, areaIndex) => [
      ...(areaIndex === 0 ? [row('section', [section.name])] : []),
      ...areaRows(documentType, area, context),
      ...(areaIndex === areas.length - 1 ? sectionTotalRow(documentType, section, context) : [])
    ]);
  });
}

function billTotalRows(bill, context) {
  const totals = getBillTotals(bill, context.rates);
  const { money, t } = context;
  return [
    amountRow('sectionTotal', t('Subtotal'), money(totals.subtotal)),
    ...(totals.discount ? [amountRow('normal', t('Discount'), `- ${money(totals.discount)}`)] : []),
    ...getTaxLines(bill, totals).map((line) => amountRow('normal', line.label, money(line.amount))),
    amountRow('grandTotal', t('Total'), money(totals.total)),
    wordsRow(totals.total, context),
    ...(totals.advance ? [amountRow('normal', t('Advance received'), `- ${money(totals.advance)}`)] : []),
    ...(totals.received ? [amountRow('normal', t('Payments received'), `- ${money(totals.received)}`)] : []),
    ...(totals.adjusted ? [amountRow('normal', t('Adjusted from advance'), `- ${money(totals.adjusted)}`)] : []),
    ...(totals.writtenOff ? [amountRow('normal', t('Discount allowed'), `- ${money(totals.writtenOff)}`)] : []),
    ...(totals.paid || totals.writtenOff ? [amountRow('grandTotal', t('Balance due'), money(totals.balance))] : [])
  ];
}

/** Running (RA) account for the summary: every earlier bill listed one by one, then work and payments to date. */
function runningAccountRows({ runningAccount: account, money, t }) {
  return [
    row('section', [t('Running account'), '']),
    ...account.trail.map((entry) => row('normal', [`${entry.label}${entry.date ? ` · ${entry.date}` : ''}${entry.current ? ` (${t('this bill')})` : ''}`, money(entry.total)])),
    amountRow('sectionTotal', t('Total work to date'), money(account.totalToDate)),
    ...(account.receivedToDate ? [amountRow('normal', t('Received to date'), `- ${money(account.receivedToDate)}`)] : []),
    ...(account.discountToDate ? [amountRow('normal', t('Discount allowed'), `- ${money(account.discountToDate)}`)] : []),
    amountRow('grandTotal', t('Balance due to date'), money(account.balanceToDate)),
    ...(account.dueApartToDate ? [amountRow('normal', t('Still due on earlier bills (not included above)'), money(account.dueApartToDate))] : [])
  ];
}

function summaryRows(bill, context) {
  const { settings, money, rates } = context;
  const rows = (bill.sections || []).flatMap((section, sectionIndex) => {
    const style = billStyleOf(bill);
    const sectionTotal = money(getSectionTotal(section, rates, style));
    if (settings.summaryDetail === 'section') {
      return [row('normal', [numbered(section.name, sectionIndex, settings), sectionTotal])];
    }
    return [
      row('section', [numbered(section.name, sectionIndex, settings), '']),
      ...(section.areas || []).map((area, areaIndex) =>
        row('normal', [numbered(area.name, areaIndex, settings), money(getAreaTotal(area, rates, style))])),
      row('sectionTotal', [context.t('{name} total', { name: section.name }), sectionTotal])
    ];
  });
  const { total } = getBillTotals(bill, rates);
  rows.push(row('grandTotal', [context.t('Grand total'), money(total)]), wordsRow(total, context));
  if (context.runningAccount) rows.push(...runningAccountRows(context));
  return rows;
}

function itemTotalRows(bill, context) {
  const { settings, money } = context;
  const groups = aggregateItemTotals(bill, context.rates);
  return [
    ...groups.map((group, index) => row('normal', [
      numbered(group.name, index, settings),
      formatQuantity(group.quantity, group.type),
      group.unit || '',
      money(group.rate),
      money(group.amount)
    ])),
    amountRow('grandTotal', context.t('Item totals'), money(groups.reduce((sum, group) => sum + group.amount, 0)))
  ];
}

/**
 * A measurement sheet leaves out a dimension column (Nos, Length, Width, Height) that no entry fills in, so a
 * sheet with no heights has no Height column. The Item, Qty and Unit columns always stay.
 */
function dropEmptyMeasurementColumns(columns, chunks) {
  const full = columns.length;
  const entries = chunks.flat().filter((entry) => entry.kind === 'normal' && entry.cells.length === full);
  const drop = new Set(entries.length ? [1, 2, 3, 4].filter((index) => entries.every((entry) => entry.cells[index] === '')) : []);
  if (!drop.size) return { columns, chunks };
  const keep = (cells) => cells.filter((_cell, index) => !drop.has(index));
  return {
    columns: keep(columns),
    chunks: chunks.map((chunk) => chunk.map((entry) => (entry.cells.length === full ? { ...entry, cells: keep(entry.cells) } : entry)))
  };
}

/**
 * @param {'summary'|'bill'|'measurement'|'items'} documentType
 * @param {{ money: (value: number) => string, language?: 'en'|'hi' }} options currency formatter and bill language
 * @returns {{ columns: string[], chunks: { kind: string, cells: string[] }[][] }}
 */
export function buildDocument(documentType, bill, rates, settings, { money, language = 'en', runningAccount = null }) {
  const t = makeTranslator(language);
  // The layout of the bill and of the measurement sheet is chosen when printing (settings.layouts); the summary's is its own setting.
  const layout = documentType === 'bill' || documentType === 'measurement' ? resolveLayout(bill, settings.layouts, documentType) : 'entry';
  const context = { bill, rates, settings, money, language, t, runningAccount, layout };
  const columns = DOCUMENT_COLUMNS[documentType].map((column) => t(column));
  if (documentType === 'measurement' && layout === 'floor') columns[0] = t('Room');
  if (documentType === 'summary') return { columns, chunks: [summaryRows(bill, context)] };
  if (documentType === 'items') return { columns, chunks: [itemTotalRows(bill, context)] };

  const chunks = detailChunks(documentType, bill, context);
  if (documentType === 'bill') chunks[chunks.length - 1].push(...billTotalRows(bill, context));
  if (documentType === 'measurement') return dropEmptyMeasurementColumns(columns, chunks);
  return { columns, chunks };
}

/**
 * Collapses a row into HTML table cells: bands span the full width, and totals
 * merge their empty middle cells into the label.
 * @returns {{ text: string, span: number }[]}
 */
export function toTableCells(row, columnCount) {
  const { cells } = row;
  if (BAND_KINDS.has(row.kind) || cells.length === 1) return [{ text: cells[0], span: columnCount }];
  if (row.kind === 'groupTotal') return [{ text: cells[0], span: columnCount - 2 }, { text: cells[cells.length - 2], span: 1 }, { text: cells[cells.length - 1], span: 1 }];
  const middleIsEmpty = cells.slice(1, -1).every((cell) => cell === '');
  if (cells.length > 2 && middleIsEmpty) {
    return [{ text: cells[0], span: columnCount - 1 }, { text: cells[cells.length - 1], span: 1 }];
  }
  return cells.map((cell) => ({ text: cell, span: 1 }));
}

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
  getAreaTotal,
  getBillTotals,
  getItemQuantity,
  getLineAmount,
  getSectionTotal,
  getTaxLines
} from '../domain/calculations.js';
import { resolveRate, usesCount, usesDimension } from '../domain/rates.js';
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
export const TOTAL_KINDS = new Set(['total', 'sectionTotal', 'grandTotal']);

const row = (kind, cells) => ({ kind, cells });

/** Label + amount row padded to the 5-column bill/items layout. */
const amountRow = (kind, label, amount) => row(kind, [label, '', '', '', amount]);

function numbered(label, index, settings) {
  return `${settings.rowNumbers ? `${index + 1}. ` : ''}${label}`;
}

function itemRow(documentType, item, rate, index, context) {
  const { settings, money } = context;
  const name = `${numbered(item.name || context.t('Work item'), index, settings)}${item.note ? `\n${item.note}` : ''}`;
  const quantity = String(getItemQuantity(item, rate));
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

function areaRows(documentType, area, context) {
  const rows = [row('area', [area.name])];
  (area.items || []).forEach((item, index) => {
    rows.push(itemRow(documentType, item, resolveRate(item, context.rates), index, context));
  });
  if (documentType === 'bill') {
    rows.push(amountRow('total', context.t('{name} total', { name: area.name }), context.money(getAreaTotal(area, context.rates))));
  }
  return rows;
}

function sectionTotalRow(documentType, section, context) {
  return documentType === 'bill'
    ? [amountRow('sectionTotal', context.t('{name} total', { name: section.name }), context.money(getSectionTotal(section, context.rates)))]
    : [];
}

function sectionRows(documentType, section, context) {
  return [
    row('section', [section.name]),
    ...(section.areas || []).flatMap((area) => areaRows(documentType, area, context)),
    ...sectionTotalRow(documentType, section, context)
  ];
}

/** Bill and measurement sheet rows, split according to the page-break setting. */
function detailChunks(documentType, bill, context) {
  const sections = bill.sections || [];
  const { pageBreak } = context.settings;
  if (!sections.length) return [[row('normal', [context.t('No entries yet')])]];
  if (pageBreak === 'none') return [sections.flatMap((section) => sectionRows(documentType, section, context))];
  if (pageBreak === 'section') return sections.map((section) => sectionRows(documentType, section, context));

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
    ...(context.runningAccount ? runningAccountRows(context) : [
      ...(totals.advance ? [amountRow('normal', t('Advance received'), `- ${money(totals.advance)}`)] : []),
      ...(totals.received ? [amountRow('normal', t('Payments received'), `- ${money(totals.received)}`)] : []),
      ...(totals.paid ? [amountRow('grandTotal', t('Balance due'), money(totals.balance))] : [])
    ])
  ];
}

/** Running (RA) bill account: earlier bills, work and payments to date. */
function runningAccountRows({ runningAccount: account, money, t }) {
  return [
    ...(account.previousCount ? [amountRow('normal', account.raNumber === 2
      ? t('Previous bill (RA 1)')
      : t('Previous bills (RA 1–{last})', { last: account.raNumber - 1 }), money(account.previousTotal))] : []),
    amountRow('sectionTotal', t('Total work to date'), money(account.totalToDate)),
    ...(account.receivedToDate ? [amountRow('normal', t('Received to date'), `- ${money(account.receivedToDate)}`)] : []),
    amountRow('grandTotal', t('Balance due to date'), money(account.balanceToDate))
  ];
}

function summaryRows(bill, context) {
  const { settings, money, rates } = context;
  const rows = (bill.sections || []).flatMap((section, sectionIndex) => {
    const sectionTotal = money(getSectionTotal(section, rates));
    if (settings.summaryDetail === 'section') {
      return [row('normal', [numbered(section.name, sectionIndex, settings), sectionTotal])];
    }
    return [
      row('section', [numbered(section.name, sectionIndex, settings), '']),
      ...(section.areas || []).map((area, areaIndex) =>
        row('normal', [numbered(area.name, areaIndex, settings), money(getAreaTotal(area, rates))])),
      row('sectionTotal', [context.t('{name} total', { name: section.name }), sectionTotal])
    ];
  });
  const { total } = getBillTotals(bill, rates);
  rows.push(row('grandTotal', [context.t('Grand total'), money(total)]), wordsRow(total, context));
  return rows;
}

function itemTotalRows(bill, context) {
  const { settings, money } = context;
  const groups = aggregateItemTotals(bill, context.rates);
  return [
    ...groups.map((group, index) => row('normal', [
      numbered(group.name, index, settings),
      String(group.quantity),
      group.unit || '',
      money(group.rate),
      money(group.amount)
    ])),
    amountRow('grandTotal', context.t('Item totals'), money(groups.reduce((sum, group) => sum + group.amount, 0)))
  ];
}

/**
 * @param {'summary'|'bill'|'measurement'|'items'} documentType
 * @param {{ money: (value: number) => string, language?: 'en'|'hi' }} options currency formatter and bill language
 * @returns {{ columns: string[], chunks: { kind: string, cells: string[] }[][] }}
 */
export function buildDocument(documentType, bill, rates, settings, { money, language = 'en', runningAccount = null }) {
  const t = makeTranslator(language);
  const context = { rates, settings, money, language, t, runningAccount };
  const columns = DOCUMENT_COLUMNS[documentType].map((column) => t(column));
  if (documentType === 'summary') return { columns, chunks: [summaryRows(bill, context)] };
  if (documentType === 'items') return { columns, chunks: [itemTotalRows(bill, context)] };

  const chunks = detailChunks(documentType, bill, context);
  if (documentType === 'bill') chunks[chunks.length - 1].push(...billTotalRows(bill, context));
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
  const middleIsEmpty = cells.slice(1, -1).every((cell) => cell === '');
  if (cells.length > 2 && middleIsEmpty) {
    return [{ text: cells[0], span: columnCount - 1 }, { text: cells[cells.length - 1], span: 1 }];
  }
  return cells.map((cell) => ({ text: cell, span: 1 }));
}

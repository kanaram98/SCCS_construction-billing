/** Documents that can be included in a print / PDF export. */
export const PRINT_DOCUMENTS = Object.freeze([
  { id: 'summary', label: 'Summary bill', pdfTitle: 'Summary' },
  { id: 'bill', label: 'Individual bill', pdfTitle: 'Bill' },
  { id: 'measurement', label: 'Measurement sheet', pdfTitle: 'Measurement Sheet' },
  { id: 'items', label: 'Item totals', pdfTitle: 'Item Totals' }
]);

export const PAPER_SIZES = Object.freeze({
  a4: { label: 'A4', widthMm: 210, heightMm: 297 },
  letter: { label: 'Letter', widthMm: 216, heightMm: 279 },
  a3: { label: 'A3', widthMm: 297, heightMm: 420 }
});

export const ORIENTATIONS = Object.freeze({ portrait: 'Portrait', landscape: 'Landscape' });
export const FONT_SIZES = Object.freeze([8, 9, 10, 11, 12]);
export const MARGIN_RANGE = Object.freeze({ min: 5, max: 30 });
export const SIGNATURE_WIDTH_RANGE = Object.freeze({ min: 20, max: 70 });

export const HEADER_MODES = Object.freeze({ all: 'Repeat on every page', first: 'First page only' });
export const PAGE_BREAKS = Object.freeze({
  area: 'New page for each area',
  section: 'New page for each section',
  none: 'Continuous'
});
export const SUMMARY_DETAILS = Object.freeze({ area: 'Sections and areas', section: 'Section totals only' });
export const SIGNATURE_MODES = Object.freeze({
  last: 'Last document only',
  all: 'Every document',
  off: 'Blank line only'
});

const DOCUMENT_IDS = PRINT_DOCUMENTS.map(({ id }) => id);
const DEFAULT_DOCUMENT_ORDER = ['summary', 'bill', 'measurement', 'items'];

export function getPrintDocument(documentId) {
  return PRINT_DOCUMENTS.find((entry) => entry.id === documentId);
}

export function createDefaultPrintSettings() {
  return {
    paper: 'a4',
    orientation: 'portrait',
    margin: 12,
    fontSize: 9,
    documents: { summary: true, bill: true, measurement: true, items: false },
    documentOrder: [...DEFAULT_DOCUMENT_ORDER],
    headerMode: 'all',
    pageBreak: 'area',
    rowNumbers: false,
    summaryDetail: 'area',
    pageNumbers: true,
    signatureMode: 'last',
    signatureWidth: 35,
    previewDocument: 'bill'
  };
}

function boundedNumber(value, fallback, min, max) {
  const parsed = Number(value);
  if (value == null || value === '' || !Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, parsed));
}

function oneOf(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

function validDocumentOrder(order) {
  const unique = Array.isArray(order) ? order.filter((id, index) =>
    DOCUMENT_IDS.includes(id) && order.indexOf(id) === index) : [];
  return [...unique, ...DEFAULT_DOCUMENT_ORDER.filter((id) => !unique.includes(id))];
}

/**
 * Fills in defaults and clamps every print setting to a valid value.
 * `legacyDocuments` and `legacySignatureLayout` migrate older saved data.
 */
export function normalizePrintSettings(settings, legacyDocuments = [], legacySignatureLayout) {
  const defaults = createDefaultPrintSettings();
  const saved = settings && typeof settings === 'object' ? settings : {};
  const legacyOrder = Array.isArray(legacyDocuments)
    ? legacyDocuments.filter((id) => DOCUMENT_IDS.includes(id))
    : [];
  const documentOrder = validDocumentOrder(saved.documentOrder || legacyOrder);
  const documents = Object.fromEntries(DOCUMENT_IDS.map((id) => [
    id,
    typeof saved.documents?.[id] === 'boolean'
      ? saved.documents[id]
      : legacyOrder.length
        ? legacyOrder.includes(id)
        : defaults.documents[id]
  ]));
  const signatureWidth = saved.signatureWidth == null && legacySignatureLayout
    ? legacySignatureLayout.width
    : saved.signatureWidth;

  return {
    ...defaults,
    ...saved,
    paper: oneOf(saved.paper, Object.keys(PAPER_SIZES), defaults.paper),
    orientation: oneOf(saved.orientation, Object.keys(ORIENTATIONS), defaults.orientation),
    margin: boundedNumber(saved.margin, defaults.margin, MARGIN_RANGE.min, MARGIN_RANGE.max),
    fontSize: oneOf(Number(saved.fontSize), FONT_SIZES, defaults.fontSize),
    documents,
    documentOrder,
    headerMode: oneOf(saved.headerMode, Object.keys(HEADER_MODES), defaults.headerMode),
    pageBreak: oneOf(saved.pageBreak, Object.keys(PAGE_BREAKS), defaults.pageBreak),
    rowNumbers: Boolean(saved.rowNumbers),
    summaryDetail: oneOf(saved.summaryDetail, Object.keys(SUMMARY_DETAILS), defaults.summaryDetail),
    pageNumbers: saved.pageNumbers !== false,
    signatureMode: oneOf(saved.signatureMode, Object.keys(SIGNATURE_MODES), defaults.signatureMode),
    signatureWidth: boundedNumber(signatureWidth, defaults.signatureWidth, SIGNATURE_WIDTH_RANGE.min, SIGNATURE_WIDTH_RANGE.max),
    previewDocument: oneOf(saved.previewDocument, DOCUMENT_IDS, defaults.previewDocument)
  };
}

/** Selected documents in their export order. */
export function getSelectedDocuments(settings) {
  return settings.documentOrder.filter((id) => settings.documents[id]);
}

export function toggleDocument(settings, documentId) {
  return normalizePrintSettings({
    ...settings,
    documents: { ...settings.documents, [documentId]: !settings.documents[documentId] }
  });
}

/** Moves a document up (-1) or down (+1) in the export order. */
export function moveDocument(settings, documentId, direction) {
  const order = [...settings.documentOrder];
  const index = order.indexOf(documentId);
  const target = index + direction;
  if (index < 0 || target < 0 || target >= order.length) return settings;
  [order[index], order[target]] = [order[target], order[index]];
  return normalizePrintSettings({ ...settings, documentOrder: order });
}

/** Whether the signature image appears on the document at `index` of `count` selected documents. */
export function isSignatureVisible(settings, index, count) {
  return settings.signatureMode === 'all' || (settings.signatureMode === 'last' && index === count - 1);
}

export function getPageWidthMm(settings) {
  const paper = PAPER_SIZES[settings.paper] || PAPER_SIZES.a4;
  return settings.orientation === 'landscape' ? paper.heightMm : paper.widthMm;
}

/** Up to three non-empty footer lines. */
export function getFooterLines(footer) {
  return String(footer || '').split('\n').filter((line) => line.trim()).slice(0, 3);
}

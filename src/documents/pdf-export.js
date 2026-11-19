/**
 * PDF renderer for the document model. Loaded on demand because jsPDF is large.
 */
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { buildDocument } from './document-model.js';
import { drawLetterhead } from './letterhead-pdf.js';
import { hasGst } from '../domain/calculations.js';
import { billLabel, documentTitle } from '../domain/bill-kinds.js';
import { makeTranslator } from '../i18n/translate.js';
import { billStatus } from '../domain/bill-guard.js';

const english = makeTranslator('en');
import { deliverPdf } from './pdf-file.js';
import { buildPaymentBlock } from './payment-block.js';
import { formatCurrencyAscii } from '../domain/formatters.js';
import { SIGNATURE_AREA, normalizeSignatureLayout } from '../domain/signature-layout.js';
import {
  getFooterLines,
  getSelectedDocuments,
  isSignatureVisible,
  normalizePrintSettings
} from '../domain/print-settings.js';

const FONT = 'helvetica';
const COLORS = Object.freeze({
  headFill: [235, 238, 242],
  bandFill: [35, 63, 96],
  subtleFill: [232, 235, 239]
});

const ROW_STYLES = Object.freeze({
  section: { fillColor: COLORS.bandFill, textColor: 255, fontStyle: 'bold' },
  area: { fillColor: COLORS.subtleFill, fontStyle: 'bold' },
  sectionTotal: { fillColor: COLORS.subtleFill, fontStyle: 'bold' },
  words: { fontStyle: 'italic' },
  total: { fontStyle: 'bold' },
  grandTotal: { fillColor: COLORS.bandFill, textColor: 255, fontStyle: 'bold' }
});

function drawContainedImage(doc, image, x, y, maxWidth, maxHeight) {
  const properties = doc.getImageProperties(image);
  const scale = Math.min(maxWidth / properties.width, maxHeight / properties.height);
  const width = properties.width * scale;
  const height = properties.height * scale;
  const format = image.startsWith('data:image/png') ? 'PNG' : 'JPEG';
  doc.addImage(image, format, x + (maxWidth - width) / 2, y + (maxHeight - height) / 2, width, height, `img-${image.length}-${image.slice(-24)}`, 'FAST');
}

/** Draws wrapped text and returns the y position below it. */
function drawWrapped(doc, value, x, y, maxWidth, lineHeight) {
  const lines = doc.splitTextToSize(String(value), maxWidth);
  doc.text(lines, x, y);
  return y + lines.length * lineHeight;
}

/** Letterhead for a bill document. Returns the y position where content can start. */
function drawHeader(doc, bill, firm, title, settings) {
  return drawLetterhead(doc, {
    firm,
    title,
    meta: [billLabel(bill, english), `Date: ${bill.date}`],
    billTo: {
      label: 'Bill to',
      lines: [
        bill.client,
        bill.clientAddress,
        bill.clientPhone && `Phone: ${bill.clientPhone}`,
        hasGst(bill) && bill.clientGstin && `Client GSTIN: ${bill.clientGstin}`,
        bill.projectName && `Project: ${bill.projectName}`
      ]
    },
    margin: settings.margin,
    fontSize: settings.fontSize,
    om: true
  });
}

const QR_SIZE = 26;

function paymentBlockHeight(block) {
  if (!block) return 0;
  const textHeight = 6 + block.lines.length * 4.2;
  return Math.max(textHeight, block.qr ? QR_SIZE + 9 : 0) + 4;
}

/** Bordered "Payment details" box with bank/UPI lines and an optional QR code. Returns the y below it. */
function drawPaymentBlock(doc, block, x, y, width, settings) {
  const height = paymentBlockHeight(block);
  doc.setDrawColor(136);
  doc.rect(x, y, width, height);
  doc.setTextColor(20);
  doc.setFontSize(settings.fontSize);
  doc.setFont(FONT, 'bold');
  doc.text('Payment details', x + 3, y + 5.5);
  doc.setFont(FONT, 'normal');
  block.lines.forEach((line, index) => doc.text(line, x + 3, y + 10 + index * 4.2));

  if (block.qr) {
    const { matrix, amount } = block.qr;
    const cell = QR_SIZE / (matrix.length + 2);
    const qrX = x + width - QR_SIZE - 3;
    const qrY = y + 2;
    doc.setFillColor(0, 0, 0);
    // One rectangle per horizontal run of dark modules keeps the PDF small.
    matrix.forEach((row, rowIndex) => {
      let start = -1;
      row.concat(false).forEach((dark, colIndex) => {
        if (dark && start < 0) start = colIndex;
        if (!dark && start >= 0) {
          doc.rect(qrX + (start + 1) * cell, qrY + (rowIndex + 1) * cell, (colIndex - start) * cell, cell, 'F');
          start = -1;
        }
      });
    });
    doc.setFontSize(7);
    doc.text(`Scan to pay ${formatCurrencyAscii(amount)}`, qrX + QR_SIZE / 2, qrY + QR_SIZE + 3.5, { align: 'center' });
  }
  return y + height + 4;
}

/** Payment details, footer lines, signature image, signature line and date line after the table. */
function drawClosing(doc, { bill, rates, firm, settings, documentType, includeSignature, drawPageHeader, runningAccount }) {
  const { margin } = settings;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const footerLines = getFooterLines(bill.footer);
  const paymentBlock = buildPaymentBlock(documentType, bill, rates, firm, settings, undefined, { runningAccount });
  let y = doc.lastAutoTable.finalY + 8;

  if (y + paymentBlockHeight(paymentBlock) + footerLines.length * 5 + SIGNATURE_AREA.height + 16 > pageHeight - margin) {
    doc.addPage();
    y = settings.headerMode === 'all' ? drawPageHeader() + 4 : margin + 4;
    if (settings.headerMode === 'first') drawPageHeader();
  }

  if (paymentBlock) y = drawPaymentBlock(doc, paymentBlock, margin, y, pageWidth - margin * 2, settings);

  doc.setFont(FONT, 'normal');
  doc.setFontSize(settings.fontSize - 1);
  doc.setTextColor(60);
  footerLines.forEach((line) => { y = drawWrapped(doc, line, margin, y, pageWidth - margin * 2, 4.2); });
  if (footerLines.length) y += 4;

  if (firm.signature && includeSignature) {
    const layout = normalizeSignatureLayout({ ...firm.signatureLayout, width: settings.signatureWidth });
    const areaX = pageWidth - margin - SIGNATURE_AREA.width;
    drawContainedImage(doc, firm.signature, areaX + layout.x, y + layout.y, layout.width, layout.height);
  }
  doc.setDrawColor(30);
  doc.line(pageWidth - margin - 60, y + 15, pageWidth - margin, y + 15);
  doc.text('Date: ______________', margin, y + 20);
  doc.text('Signature', pageWidth - margin - 60, y + 20);
}

function drawPageNumbers(doc, settings) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const pageCount = doc.internal.getNumberOfPages();
  for (let page = 1; page <= pageCount; page += 1) {
    doc.setPage(page);
    doc.setFont(FONT, 'normal');
    doc.setFontSize(8);
    doc.text(`Page ${page} of ${pageCount}`, pageWidth - settings.margin, pageHeight - settings.margin / 2, { align: 'right' });
  }
}

function renderDocument(doc, documentType, { bill, rates, firm, settings, includeSignature, runningAccount }) {
  const { margin } = settings;
  const title = documentTitle(documentType, bill, { pdf: true });
  const firstPage = doc.internal.getCurrentPageInfo().pageNumber;
  const drawnHeaders = new Set();
  const drawPageHeader = () => {
    const page = doc.internal.getCurrentPageInfo().pageNumber;
    if (drawnHeaders.has(page)) return undefined;
    drawnHeaders.add(page);
    if (settings.headerMode === 'all' || page === firstPage) return drawHeader(doc, bill, firm, title, settings);
    return margin;
  };

  const headerBottom = drawPageHeader();
  const { columns, chunks } = buildDocument(documentType, bill, rates, settings, { money: formatCurrencyAscii, runningAccount });
  chunks.forEach((rows, chunkIndex) => {
    if (chunkIndex) {
      doc.addPage();
      drawPageHeader();
    }
    autoTable(doc, {
      head: [columns],
      // Single-cell rows (headings, amount in words) span the full width.
      body: rows.map((row) => (row.cells.length === 1 ? [{ content: row.cells[0], colSpan: columns.length }] : row.cells)),
      startY: chunkIndex === 0 || settings.headerMode === 'all' ? headerBottom : margin,
      margin: {
        left: margin,
        right: margin,
        top: settings.headerMode === 'all' ? headerBottom : margin,
        bottom: margin + 7
      },
      theme: 'grid',
      rowPageBreak: 'avoid',
      styles: { font: FONT, fontSize: settings.fontSize, cellPadding: 1.5, overflow: 'linebreak' },
      headStyles: { fillColor: COLORS.headFill, textColor: 20 },
      didParseCell(data) {
        if (data.section !== 'body') return;
        const style = ROW_STYLES[rows[data.row.index]?.kind];
        if (style) data.cell.styles = { ...data.cell.styles, ...style };
      },
      didDrawPage: drawPageHeader
    });
  });

  drawClosing(doc, { bill, rates, firm, settings, documentType, includeSignature, drawPageHeader, runningAccount });
}

/** A faint red DRAFT across every page of a bill that is not ready yet. */
function drawDraftStamp(doc) {
  const pages = doc.getNumberOfPages();
  for (let page = 1; page <= pages; page += 1) {
    doc.setPage(page);
    const width = doc.internal.pageSize.getWidth();
    const height = doc.internal.pageSize.getHeight();
    doc.saveGraphicsState();
    doc.setGState(new doc.GState({ opacity: 0.16 }));
    doc.setTextColor(200, 40, 40);
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(Math.round(width * 0.38));
    doc.text('DRAFT', width / 2, height * 0.45, { align: 'center', angle: 28 });
    doc.restoreGraphicsState();
  }
}

export async function exportBillPdf(bill, rates, firm, printSettings, { shareText, runningAccount = null } = {}) {
  const settings = normalizePrintSettings(printSettings);
  const documents = getSelectedDocuments(settings);
  if (!documents.length) throw new Error('Select at least one document to export.');

  const doc = new jsPDF({ unit: 'mm', format: settings.paper, orientation: settings.orientation });
  documents.forEach((documentType, index) => {
    if (index) doc.addPage();
    renderDocument(doc, documentType, {
      bill,
      rates,
      firm,
      settings,
      runningAccount,
      includeSignature: isSignatureVisible(settings, index, documents.length)
    });
  });

  if (settings.pageNumbers) drawPageNumbers(doc, settings);
  if (billStatus(bill) === 'draft') drawDraftStamp(doc);
  await deliverPdf(doc, bill, { shareText });
}

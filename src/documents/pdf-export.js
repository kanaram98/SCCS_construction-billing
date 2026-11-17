/**
 * PDF renderer for the document model. Loaded on demand because jsPDF is large.
 */
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { buildDocument } from './document-model.js';
import { formatCurrencyAscii } from '../domain/formatters.js';
import { SIGNATURE_AREA, normalizeSignatureLayout } from '../domain/signature-layout.js';
import {
  getFooterLines,
  getPrintDocument,
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
  total: { fontStyle: 'bold' },
  grandTotal: { fillColor: COLORS.bandFill, textColor: 255, fontStyle: 'bold' }
});

function drawContainedImage(doc, image, x, y, maxWidth, maxHeight) {
  const properties = doc.getImageProperties(image);
  const scale = Math.min(maxWidth / properties.width, maxHeight / properties.height);
  const width = properties.width * scale;
  const height = properties.height * scale;
  const format = image.startsWith('data:image/png') ? 'PNG' : 'JPEG';
  doc.addImage(image, format, x + (maxWidth - width) / 2, y + (maxHeight - height) / 2, width, height);
}

/** Draws wrapped text and returns the y position below it. */
function drawWrapped(doc, value, x, y, maxWidth, lineHeight) {
  const lines = doc.splitTextToSize(String(value), maxWidth);
  doc.text(lines, x, y);
  return y + lines.length * lineHeight;
}

/** Firm and bill header. Returns the y position where content can start. */
function drawHeader(doc, bill, firm, title, settings) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const { margin, fontSize } = settings;
  const maxWidth = pageWidth - margin * 2;
  const logoWidth = firm.logo ? Math.min(34, maxWidth * 0.25) : 0;
  const textWidth = maxWidth - (firm.logo ? logoWidth + 4 : 0);
  let y = margin + 4;
  if (firm.logo) drawContainedImage(doc, firm.logo, pageWidth - margin - logoWidth, margin, logoWidth, 18);

  doc.setFont(FONT, 'bold');
  doc.setFontSize(fontSize + 5);
  doc.text(firm.name || 'Firm name', margin, y, { maxWidth: textWidth });
  y += 6;
  doc.setFont(FONT, 'normal');
  doc.setFontSize(fontSize - 1);
  [firm.address, [firm.phone, firm.gstin && `GSTIN: ${firm.gstin}`].filter(Boolean).join('   ')]
    .filter(Boolean)
    .forEach((line) => { y = drawWrapped(doc, line, margin, y, textWidth, 3.8); });

  y = Math.max(y + 1, margin + 20);
  doc.setFont(FONT, 'bold');
  doc.setFontSize(fontSize);
  y = drawWrapped(doc, `${title}   Bill no. ${bill.number}   Date: ${bill.date}`, margin, y, maxWidth, 4.2);
  doc.setFont(FONT, 'normal');
  const project = [
    `Project: ${bill.projectName}`,
    `Client: ${bill.client}`,
    bill.clientPhone && `Phone: ${bill.clientPhone}`,
    bill.clientAddress,
    bill.clientGstin && `Client GSTIN: ${bill.clientGstin}`
  ].filter(Boolean).join('   ');
  y = drawWrapped(doc, project, margin, y, maxWidth, 4.2) + 2;
  doc.setDrawColor(80);
  doc.line(margin, y, pageWidth - margin, y);
  return y + 5;
}

/** Footer lines, signature image, signature line and date line after the table. */
function drawClosing(doc, { bill, firm, settings, includeSignature, drawPageHeader }) {
  const { margin } = settings;
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const footerLines = getFooterLines(bill.footer);
  let y = doc.lastAutoTable.finalY + 8;

  if (y + footerLines.length * 5 + SIGNATURE_AREA.height + 16 > pageHeight - margin) {
    doc.addPage();
    y = settings.headerMode === 'all' ? drawPageHeader() + 4 : margin + 4;
    if (settings.headerMode === 'first') drawPageHeader();
  }

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

function renderDocument(doc, documentType, { bill, rates, firm, settings, includeSignature }) {
  const { margin } = settings;
  const title = getPrintDocument(documentType).pdfTitle;
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
  const { columns, chunks } = buildDocument(documentType, bill, rates, settings, { money: formatCurrencyAscii });
  chunks.forEach((rows, chunkIndex) => {
    if (chunkIndex) {
      doc.addPage();
      drawPageHeader();
    }
    autoTable(doc, {
      head: [columns],
      body: rows.map((row) => row.cells),
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

  drawClosing(doc, { bill, firm, settings, includeSignature, drawPageHeader });
}

function buildFilename(bill) {
  return `Bill-${bill.number || '1'}-${bill.projectName || 'Construction'}`.replace(/[^\w.-]/g, '_') + '.pdf';
}

/** Hands the PDF to the native share sheet when supported, otherwise downloads it. */
async function deliverPdf(doc, filename) {
  const file = new File([doc.output('blob')], filename, { type: 'application/pdf' });
  if (navigator.canShare?.({ files: [file] }) && navigator.share) {
    await navigator.share({ title: filename, files: [file] });
  } else {
    doc.save(filename);
  }
}

export async function exportBillPdf(bill, rates, firm, printSettings) {
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
      includeSignature: isSignatureVisible(settings, index, documents.length)
    });
  });

  if (settings.pageNumbers) drawPageNumbers(doc, settings);
  await deliverPdf(doc, buildFilename(bill));
}

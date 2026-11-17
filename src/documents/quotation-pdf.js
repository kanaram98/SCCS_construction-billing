/**
 * PDF of the rate quotation. English uses jsPDF text (sharp, small files);
 * Hindi is rendered from the on-screen document as images, like Hindi bills.
 * Loaded on demand.
 */
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCurrencyAscii, todayIso } from '../domain/formatters.js';
import { QUOTATION_COLUMNS, quotationRows, splitLines, validUntil } from '../domain/quotation.js';
import { makeTranslator } from '../i18n/translate.js';
import { deliverFile } from '../services/files.js';
import { createImagePdf } from './pdf-image-export.js';
import { drawLetterhead } from './letterhead-pdf.js';

const MARGIN = 14;

export function quotationFilename(firm) {
  return `Rate-quotation-${firm.name || 'firm'}-${todayIso()}`.replace(/[^\w.-]/g, '_') + '.pdf';
}

function textPdf(quotation, rates, firm) {
  const t = makeTranslator('en');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const width = doc.internal.pageSize.getWidth();
  const until = validUntil(quotation);
  const y = drawLetterhead(doc, {
    firm,
    title: quotation.title || 'Rate quotation',
    meta: [`Date: ${todayIso()}`, until && `Valid until: ${until}`],
    billTo: quotation.clientName ? { label: 'To', lines: [quotation.clientName] } : null,
    margin: MARGIN,
    fontSize: 10
  });

  autoTable(doc, {
    head: [QUOTATION_COLUMNS],
    body: quotationRows(rates, { t, money: formatCurrencyAscii }),
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 10, cellPadding: 2 },
    headStyles: { fillColor: [235, 238, 242], textColor: 20 },
    columnStyles: { 0: { cellWidth: 12 }, 4: { halign: 'right' } }
  });

  let y2 = doc.lastAutoTable.finalY + 8;
  const ensureSpace = (needed) => {
    if (y2 + needed > doc.internal.pageSize.getHeight() - MARGIN) {
      doc.addPage();
      y2 = MARGIN + 4;
    }
  };
  const block = (heading, lines) => {
    if (!lines.length) return;
    ensureSpace(10);
    doc.setFont('helvetica', 'bold');
    doc.text(heading, MARGIN, y2);
    y2 += 5;
    doc.setFont('helvetica', 'normal');
    lines.forEach((line) => {
      const wrapped = doc.splitTextToSize(line, width - MARGIN * 2);
      ensureSpace(wrapped.length * 4.5);
      doc.text(wrapped, MARGIN, y2);
      y2 += wrapped.length * 4.5;
    });
    y2 += 3;
  };
  block('Terms & conditions', splitLines(quotation.terms).map((term, index) => `${index + 1}. ${term}`));
  block('Disclaimer', quotation.disclaimer?.trim() ? [quotation.disclaimer.trim()] : []);

  ensureSpace(25);
  y2 += 14;
  if (firm.signature) {
    const props = doc.getImageProperties(firm.signature);
    const scale = Math.min(45 / props.width, 13 / props.height);
    doc.addImage(firm.signature, 'PNG', width - MARGIN - 52, y2 - 1 - props.height * scale, props.width * scale, props.height * scale, 'firm-signature', 'FAST');
  }
  doc.line(width - MARGIN - 60, y2, width - MARGIN, y2);
  doc.text('Signature', width - MARGIN - 60, y2 + 5);
  doc.text('Date: ______________', MARGIN, y2 + 5);
  return doc;
}

/**
 * @param {'en'|'hi'} language
 * @param {Element|null} rendered the on-screen quotation (needed for Hindi)
 */
export async function exportQuotationPdf({ quotation, rates, firm, language, rendered, shareText }) {
  const doc = language === 'hi' && rendered
    ? await createImagePdf([rendered], { paper: 'a4', orientation: 'portrait', margin: 10, pageNumbers: false })
    : textPdf(quotation, rates, firm);
  return deliverFile(new File([doc.output('blob')], quotationFilename(firm), { type: 'application/pdf' }), { text: shareText });
}

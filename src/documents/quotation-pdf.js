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

const MARGIN = 14;

export function quotationFilename(firm) {
  return `Rate-quotation-${firm.name || 'firm'}-${todayIso()}`.replace(/[^\w.-]/g, '_') + '.pdf';
}

function textPdf(quotation, rates, firm) {
  const t = makeTranslator('en');
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const width = doc.internal.pageSize.getWidth();
  let y = MARGIN + 4;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(15);
  doc.text(firm.name || 'Firm name', MARGIN, y);
  y += 6;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  [firm.address, [firm.phone, firm.gstRegistered && firm.gstin && `GSTIN: ${firm.gstin}`].filter(Boolean).join('   ')]
    .filter(Boolean)
    .forEach((line) => { doc.text(String(line), MARGIN, y); y += 4.5; });

  y += 3;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text(quotation.title || 'Rate quotation', MARGIN, y);
  y += 5.5;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  const until = validUntil(quotation);
  doc.text([quotation.clientName && `To: ${quotation.clientName}`, `Date: ${todayIso()}`, until && `Valid until: ${until}`].filter(Boolean).join('   '), MARGIN, y);
  y += 3;
  doc.setDrawColor(80);
  doc.line(MARGIN, y, width - MARGIN, y);

  autoTable(doc, {
    head: [QUOTATION_COLUMNS],
    body: quotationRows(rates, { t, money: formatCurrencyAscii }),
    startY: y + 4,
    margin: { left: MARGIN, right: MARGIN },
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 10, cellPadding: 2 },
    headStyles: { fillColor: [235, 238, 242], textColor: 20 },
    columnStyles: { 0: { cellWidth: 12 }, 4: { halign: 'right' } }
  });

  y = doc.lastAutoTable.finalY + 8;
  const ensureSpace = (needed) => {
    if (y + needed > doc.internal.pageSize.getHeight() - MARGIN) {
      doc.addPage();
      y = MARGIN + 4;
    }
  };
  const block = (heading, lines) => {
    if (!lines.length) return;
    ensureSpace(10);
    doc.setFont('helvetica', 'bold');
    doc.text(heading, MARGIN, y);
    y += 5;
    doc.setFont('helvetica', 'normal');
    lines.forEach((line) => {
      const wrapped = doc.splitTextToSize(line, width - MARGIN * 2);
      ensureSpace(wrapped.length * 4.5);
      doc.text(wrapped, MARGIN, y);
      y += wrapped.length * 4.5;
    });
    y += 3;
  };
  block('Terms & conditions', splitLines(quotation.terms).map((term, index) => `${index + 1}. ${term}`));
  block('Disclaimer', quotation.disclaimer?.trim() ? [quotation.disclaimer.trim()] : []);

  ensureSpace(25);
  y += 12;
  doc.line(width - MARGIN - 60, y, width - MARGIN, y);
  doc.text('Signature', width - MARGIN - 60, y + 5);
  doc.text('Date: ______________', MARGIN, y + 5);
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

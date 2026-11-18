/** Payment receipt as a PDF: English as text; Hindi (or Hindi names) rendered from the on-screen receipt. */
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCurrencyAscii } from '../domain/formatters.js';
import { receiptLines } from '../domain/receipt.js';
import { containsDevanagari } from '../i18n/translate.js';
import { deliverFile } from '../services/files.js';
import { createImagePdf } from './pdf-image-export.js';
import { drawLetterhead } from './letterhead-pdf.js';

const MARGIN = 14;
const english = (text) => text;

export const receiptFilename = (receipt) => `Receipt-${receipt.number}.pdf`;

function textPdf({ receipt, firm }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const y = drawLetterhead(doc, { firm, title: 'Payment receipt', meta: [receipt.number, receipt.date], margin: MARGIN, fontSize: 11 });
  autoTable(doc, {
    body: receiptLines(receipt, english, 'en', formatCurrencyAscii),
    startY: y + 2,
    margin: { left: MARGIN, right: MARGIN },
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 11, cellPadding: 2.6 },
    columnStyles: { 0: { fontStyle: 'bold', cellWidth: 55, fillColor: [243, 245, 248] } }
  });
  const end = doc.lastAutoTable.finalY + 10;
  doc.setFontSize(11);
  doc.text('Thank you.', MARGIN, end);
  const right = doc.internal.pageSize.getWidth() - MARGIN;
  doc.line(right - 55, end + 22, right, end + 22);
  doc.text('Authorised signatory', right, end + 27, { align: 'right' });
  return doc;
}

export async function exportReceiptPdf({ receipt, firm, language, rendered }) {
  const needsImage = language === 'hi' || containsDevanagari([receipt.client, receipt.projectName, receipt.note, firm.name, firm.address, firm.tagline]);
  const doc = needsImage && rendered
    ? await createImagePdf([rendered], { paper: 'a4', orientation: 'portrait', margin: 10, pageNumbers: false })
    : textPdf({ receipt, firm });
  return deliverFile(new File([doc.output('blob')], receiptFilename(receipt), { type: 'application/pdf' }));
}

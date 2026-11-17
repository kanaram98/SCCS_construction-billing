/**
 * Monthly labour register PDF (landscape A4): attendance grid and wage summary.
 * English uses jsPDF text; Hindi (or Hindi names) is rendered from the
 * on-screen document as images, like Hindi bills. Loaded on demand.
 */
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCurrencyAscii, todayIso } from '../domain/formatters.js';
import { daysOfMonth, monthLabel, registerCell } from '../domain/labour.js';
import { containsDevanagari } from '../i18n/translate.js';
import { deliverFile } from '../services/files.js';
import { createImagePdf } from './pdf-image-export.js';
import { drawLetterhead } from './letterhead-pdf.js';

const MARGIN = 10;

export function labourFilename(month) {
  return `Labour-register-${month}.pdf`;
}

function textPdf(report, firm) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'landscape' });
  const days = daysOfMonth(report.month);
  const y = drawLetterhead(doc, {
    firm,
    title: 'Labour attendance register',
    meta: [monthLabel(report.month, 'en'), `Date: ${todayIso()}`],
    margin: MARGIN,
    fontSize: 9
  });

  autoTable(doc, {
    head: [['Name', ...days.map((date) => String(Number(date.slice(8)))), 'P']],
    body: report.rows.map((row) => [row.worker.name, ...row.marks.map(registerCell), String(row.units)]),
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 7, cellPadding: 1, halign: 'center' },
    headStyles: { fillColor: [235, 238, 242], textColor: 20 },
    columnStyles: { 0: { halign: 'left', cellWidth: 34 }, [days.length + 1]: { fontStyle: 'bold' } },
    didParseCell: ({ cell, section }) => {
      if (section === 'body' && cell.raw === 'A') cell.styles.textColor = [200, 30, 30];
    }
  });

  autoTable(doc, {
    head: [['Name', 'Days', 'P', 'Wages', 'Previous', 'Paid', 'Balance']],
    body: [
      ...report.rows.map((row) => [row.worker.name, row.days, row.units, formatCurrencyAscii(row.earned), formatCurrencyAscii(row.opening), formatCurrencyAscii(row.paid), formatCurrencyAscii(row.balance)]),
      ['Total', '', report.totals.units, formatCurrencyAscii(report.totals.earned), '', formatCurrencyAscii(report.totals.paid), formatCurrencyAscii(report.totals.balance)]
    ],
    startY: doc.lastAutoTable.finalY + 6,
    margin: { left: MARGIN, right: MARGIN },
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 1.6 },
    headStyles: { fillColor: [235, 238, 242], textColor: 20 },
    columnStyles: { 3: { halign: 'right' }, 4: { halign: 'right' }, 5: { halign: 'right' }, 6: { halign: 'right', fontStyle: 'bold' } },
    didParseCell: ({ cell, row, section }) => {
      if (section === 'body' && row.index === report.rows.length) cell.styles.fontStyle = 'bold';
    }
  });

  doc.setFontSize(8);
  doc.text('A = absent, 1 = full day, 0.5 = half day, 2 = double', MARGIN, doc.lastAutoTable.finalY + 6);
  return doc;
}

/**
 * @param {'en'|'hi'} language
 * @param {Element|null} rendered the on-screen register (needed for Hindi)
 */
export async function exportLabourPdf({ report, firm, language, rendered }) {
  const needsImage = language === 'hi' || containsDevanagari({ rows: report.rows.map((row) => row.worker.name), firm: firm.name });
  const doc = needsImage && rendered
    ? await createImagePdf([rendered], { paper: 'a4', orientation: 'landscape', margin: 8, pageNumbers: false })
    : textPdf(report, firm);
  return deliverFile(new File([doc.output('blob')], labourFilename(report.month), { type: 'application/pdf' }));
}

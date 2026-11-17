/**
 * Monthly labour register PDF (landscape A4): attendance grid and wage summary.
 * English uses jsPDF text; Hindi (or Hindi names) is rendered from the
 * on-screen document as images, like Hindi bills. Loaded on demand.
 */
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCurrencyAscii, todayIso } from '../domain/formatters.js';
import { countedUnits, daysOfMonth, formatUnits, monthLabel, registerCell } from '../domain/labour.js';
import { containsDevanagari } from '../i18n/translate.js';
import { deliverFile } from '../services/files.js';
import { createImagePdf } from './pdf-image-export.js';
import { drawLetterhead } from './letterhead-pdf.js';

const MARGIN = 10;
/** Absent cells are filled red, as on screen. */
const ABSENT_STYLE = { fillColor: [229, 57, 53], textColor: 255, fontStyle: 'bold' };

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
      if (section === 'body' && cell.raw === 'A') Object.assign(cell.styles, ABSENT_STYLE);
    }
  });

  const units = countedUnits(report.totals.counts);
  const money = formatCurrencyAscii;
  const countCells = (counts) => units.map((value) => (counts[value] ? String(counts[value]) : ''));
  autoTable(doc, {
    head: [['Name', ...units.map(formatUnits), 'Total P', 'Wages', 'Previous', 'Amount paid', 'Balance']],
    body: [
      ...report.rows.map((row) => [row.worker.name, ...countCells(row.counts), String(row.units), money(row.earned), money(row.opening), money(row.paid), money(row.balance)]),
      ['Total', ...countCells(report.totals.counts), String(report.totals.units), money(report.totals.earned), '', money(report.totals.paid), money(report.totals.balance)]
    ],
    startY: doc.lastAutoTable.finalY + 6,
    margin: { left: MARGIN, right: MARGIN },
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 1.6, halign: 'center' },
    headStyles: { fillColor: [235, 238, 242], textColor: 20 },
    columnStyles: { 0: { halign: 'left' } },
    didParseCell: ({ cell, column, row, section }) => {
      if (section === 'head' && column.index === 1 && units[0] === 0) Object.assign(cell.styles, ABSENT_STYLE);
      if (section === 'body' && column.index > units.length + 1) cell.styles.halign = 'right';
      if (section === 'body' && row.index === report.rows.length) Object.assign(cell.styles, { fontStyle: 'bold', fillColor: [243, 245, 248] });
    }
  });

  const width = doc.internal.pageSize.getWidth();
  let y2 = doc.lastAutoTable.finalY + 6;
  if (y2 + 26 > doc.internal.pageSize.getHeight() - MARGIN) {
    doc.addPage();
    y2 = MARGIN + 6;
  }
  doc.setFontSize(8);
  doc.text('A = absent, 1 = full day, 0.5 = half day, 2 = double', MARGIN, y2);
  y2 += 18;
  doc.setFontSize(9);
  if (firm.signature) {
    const props = doc.getImageProperties(firm.signature);
    const scale = Math.min(45 / props.width, 13 / props.height);
    doc.addImage(firm.signature, 'PNG', width - MARGIN - 52, y2 - 1 - props.height * scale, props.width * scale, props.height * scale, 'firm-signature', 'FAST');
  }
  doc.line(width - MARGIN - 60, y2, width - MARGIN, y2);
  doc.text('Signature', width - MARGIN - 30, y2 + 5, { align: 'center' });
  doc.text('Date: ______________', MARGIN, y2 + 5);
  return doc;
}

/**
 * @param {'en'|'hi'} language
 * @param {Element|null} rendered the on-screen register (needed for Hindi)
 */
export async function exportLabourPdf({ report, firm, language, rendered, shareText }) {
  const needsImage = language === 'hi' || containsDevanagari({ rows: report.rows.map((row) => row.worker.name), firm: firm.name });
  const doc = needsImage && rendered
    ? await createImagePdf([rendered], { paper: 'a4', orientation: 'landscape', margin: 8, pageNumbers: false })
    : textPdf(report, firm);
  return deliverFile(new File([doc.output('blob')], labourFilename(report.month), { type: 'application/pdf' }), { text: shareText });
}

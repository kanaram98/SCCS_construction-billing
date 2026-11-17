/**
 * Labour PDFs:
 *  - the monthly register for all workers (landscape A4), for the contractor;
 *  - one worker's attendance sheet (portrait A4), to share with that worker.
 * English uses jsPDF text; Hindi (or Hindi names / descriptions) is rendered
 * from the on-screen document as images, like Hindi bills. Loaded on demand.
 */
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCurrencyAscii, todayIso } from '../domain/formatters.js';
import { PAYMENT_MODES } from '../domain/payments.js';
import { calendarWeeks, countedUnits, daysOfMonth, formatUnits, monthLabel, registerCell } from '../domain/labour.js';
import { containsDevanagari } from '../i18n/translate.js';
import { deliverFile } from '../services/files.js';
import { createImagePdf } from './pdf-image-export.js';
import { drawLetterhead } from './letterhead-pdf.js';

const MARGIN = 10;
/** Absent cells are filled red, as on screen. */
const ABSENT_STYLE = { fillColor: [229, 57, 53], textColor: 255, fontStyle: 'bold' };
const HEAD_STYLE = { fillColor: [235, 238, 242], textColor: 20 };
const TOTAL_STYLE = { fontStyle: 'bold', fillColor: [243, 245, 248] };
const money = formatCurrencyAscii;
const LEGEND = 'A = absent, 1 = full day, 0.5 = half day, 2 = double';

export function labourFilename(month) {
  return `Labour-register-${month}.pdf`;
}

export function workerSheetFilename(worker, month) {
  // Keep Hindi names readable; replace only characters file systems reject.
  return `Attendance-${worker.name || 'worker'}-${month}`.replace(/[\\/:*?"<>|\s]+/g, '_') + '.pdf';
}

/** Moves to a new page when fewer than `needed` mm are left. Returns the y to draw at. */
function ensureSpace(doc, y, needed) {
  if (y + needed <= doc.internal.pageSize.getHeight() - MARGIN) return y;
  doc.addPage();
  return MARGIN + 6;
}

function heading(doc, text, y) {
  const top = ensureSpace(doc, y, 20);
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text(text, MARGIN, top);
  doc.setFont('helvetica', 'normal');
  return top + 3;
}

/** Advances / payments with date, description and mode. Returns the y below it. */
function paymentsTable(doc, payments, startY, { showName = false } = {}) {
  if (!payments.length) {
    doc.setFontSize(9);
    doc.text('No advances or payments this month.', MARGIN, startY + 4);
    return startY + 8;
  }
  const total = payments.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
  autoTable(doc, {
    head: [['#', 'Date', ...(showName ? ['Name'] : []), 'Description', 'Paid by', 'Amount']],
    body: [
      ...payments.map((payment, index) => [
        index + 1, payment.date, ...(showName ? [payment.workerName] : []),
        payment.note || '-', PAYMENT_MODES[payment.mode] || 'Cash', money(payment.amount)
      ]),
      [{ content: 'Total', colSpan: showName ? 5 : 4 }, money(total)]
    ],
    startY,
    margin: { left: MARGIN, right: MARGIN },
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 1.6 },
    headStyles: HEAD_STYLE,
    columnStyles: { 0: { cellWidth: 9, halign: 'center' }, [showName ? 5 : 4]: { halign: 'right' } },
    didParseCell: ({ cell, row, section }) => {
      if (section === 'body' && row.index === payments.length) Object.assign(cell.styles, TOTAL_STYLE);
    }
  });
  return doc.lastAutoTable.finalY + 4;
}

/** Signature lines: `left` label on the left, the firm's signature on the right. */
function signatures(doc, firm, y, left) {
  const width = doc.internal.pageSize.getWidth();
  const top = ensureSpace(doc, y, 28) + 18;
  doc.setFontSize(9);
  if (firm.signature) {
    const props = doc.getImageProperties(firm.signature);
    const scale = Math.min(45 / props.width, 13 / props.height);
    doc.addImage(firm.signature, 'PNG', width - MARGIN - 52, top - 1 - props.height * scale, props.width * scale, props.height * scale, 'firm-signature', 'FAST');
  }
  doc.line(width - MARGIN - 60, top, width - MARGIN, top);
  doc.text(left.right, width - MARGIN - 30, top + 5, { align: 'center' });
  if (left.line) doc.line(MARGIN, top, MARGIN + 60, top);
  doc.text(left.text, left.line ? MARGIN + 30 : MARGIN, top + 5, left.line ? { align: 'center' } : undefined);
}

// ── All workers: monthly register ─────────────────────────────────────

function registerPdf(report, firm) {
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
    headStyles: HEAD_STYLE,
    columnStyles: { 0: { halign: 'left', cellWidth: 34 }, [days.length + 1]: { fontStyle: 'bold' } },
    didParseCell: ({ cell, section }) => {
      if (section === 'body' && cell.raw === 'A') Object.assign(cell.styles, ABSENT_STYLE);
    }
  });

  const units = countedUnits(report.totals.counts);
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
    headStyles: HEAD_STYLE,
    columnStyles: { 0: { halign: 'left' } },
    didParseCell: ({ cell, column, row, section }) => {
      if (section === 'head' && column.index === 1 && units[0] === 0) Object.assign(cell.styles, ABSENT_STYLE);
      if (section === 'body' && column.index > units.length + 1) cell.styles.halign = 'right';
      if (section === 'body' && row.index === report.rows.length) Object.assign(cell.styles, TOTAL_STYLE);
    }
  });

  doc.setFontSize(8);
  doc.text(LEGEND, MARGIN, doc.lastAutoTable.finalY + 5);
  const after = paymentsTable(doc, report.payments, heading(doc, 'Advances and payments', doc.lastAutoTable.finalY + 13), { showName: true });
  signatures(doc, firm, after, { text: 'Date: ______________', right: 'Signature' });
  return doc;
}

// ── One worker: attendance sheet ──────────────────────────────────────

function workerPdf(row, firm) {
  const { worker } = row;
  const doc = new jsPDF({ unit: 'mm', format: 'a4', orientation: 'portrait' });
  const width = doc.internal.pageSize.getWidth();
  let y = drawLetterhead(doc, {
    firm,
    title: 'Attendance sheet',
    meta: [monthLabel(row.month, 'en'), `Date: ${todayIso()}`],
    billTo: {
      label: 'Worker',
      lines: [worker.name, [worker.role, `${money(worker.dailyWage)}/day`].filter(Boolean).join(' - '), worker.phone && `Mobile: ${worker.phone}`]
    },
    margin: MARGIN,
    fontSize: 10
  });

  // Month calendar: day number and mark in each cell; absent days red.
  const marks = Object.fromEntries(row.marks.map((mark, index) => [index + 1, mark]));
  autoTable(doc, {
    head: [['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']],
    body: calendarWeeks(row.month).map((week) => week.map((date) => {
      if (!date) return '';
      const day = Number(date.slice(8));
      const cell = registerCell(marks[day]);
      return `${day}\n${cell === 'A' || !cell ? cell : `${cell}P`}`;
    })),
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 10, cellPadding: 1.8, halign: 'center' },
    headStyles: HEAD_STYLE,
    bodyStyles: { minCellHeight: 12 },
    didParseCell: ({ cell, section }) => {
      if (section !== 'body') return;
      if (cell.raw === '') cell.styles.fillColor = [246, 247, 249];
      else if (String(cell.raw).endsWith('\nA')) Object.assign(cell.styles, ABSENT_STYLE);
    }
  });

  const units = countedUnits(row.counts);
  autoTable(doc, {
    head: [[...units.map(formatUnits), 'Days present', 'Total P']],
    body: [[...units.map((value) => String(row.counts[value] || 0)), String(row.days), String(row.units)]],
    startY: doc.lastAutoTable.finalY + 5,
    margin: { left: MARGIN, right: MARGIN },
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 10, cellPadding: 1.8, halign: 'center' },
    headStyles: HEAD_STYLE,
    didParseCell: ({ cell, column, section }) => {
      if (section === 'head' && column.index === 0 && units[0] === 0) Object.assign(cell.styles, ABSENT_STYLE);
      if (column.index === units.length + 1) cell.styles.fontStyle = 'bold';
    }
  });

  autoTable(doc, {
    body: [
      [`Wages this month (${row.units}P)`, money(row.earned)],
      ['Previous balance', money(row.opening)],
      ['Advances / payments this month', `- ${money(row.paid)}`],
      [row.balance < 0 ? 'Advance to adjust' : 'Balance due', money(Math.abs(row.balance))]
    ],
    startY: doc.lastAutoTable.finalY + 5,
    margin: { left: width * 0.4, right: MARGIN },
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 10, cellPadding: 1.8 },
    columnStyles: { 1: { halign: 'right' } },
    didParseCell: ({ cell, row: tableRow }) => {
      if (tableRow.index === 3) Object.assign(cell.styles, TOTAL_STYLE);
    }
  });

  y = paymentsTable(doc, row.payments, heading(doc, 'Advances and payments', doc.lastAutoTable.finalY + 10));
  doc.setFontSize(8);
  doc.text(LEGEND, MARGIN, y);
  signatures(doc, firm, y + 2, { text: 'Worker\'s signature', right: 'Contractor\'s signature', line: true });
  return doc;
}

const needsImagePdf = (language, value) => language === 'hi' || containsDevanagari(value);

/**
 * Monthly register for all workers.
 * @param {Element|null} rendered the on-screen register (needed for Hindi)
 */
export async function exportLabourPdf({ report, firm, language, rendered, shareText }) {
  const useImage = needsImagePdf(language, { rows: report.rows.map((row) => row.worker.name), payments: report.payments.map((payment) => payment.note), firm: firm.name });
  const doc = useImage && rendered
    ? await createImagePdf([rendered], { paper: 'a4', orientation: 'landscape', margin: 8, pageNumbers: false })
    : registerPdf(report, firm);
  return deliverFile(new File([doc.output('blob')], labourFilename(report.month), { type: 'application/pdf' }), { text: shareText });
}

/**
 * One worker's attendance sheet, to share with them.
 * @param {Element|null} rendered the on-screen worker sheet (needed for Hindi)
 */
export async function exportWorkerPdf({ row, firm, language, rendered, shareText }) {
  const useImage = needsImagePdf(language, { worker: [row.worker.name, row.worker.role], payments: row.payments.map((payment) => payment.note), firm: firm.name });
  const doc = useImage && rendered
    ? await createImagePdf([rendered], { paper: 'a4', orientation: 'portrait', margin: 10, pageNumbers: false })
    : workerPdf(row, firm);
  return deliverFile(new File([doc.output('blob')], workerSheetFilename(row.worker, row.month), { type: 'application/pdf' }), { text: shareText });
}

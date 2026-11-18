/**
 * Daily expense sheet: PDF (English as text; Hindi or Hindi notes rendered from
 * the on-screen sheet) and CSV for Excel. Loaded on demand.
 */
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCurrencyAscii, todayIso } from '../domain/formatters.js';
import { monthLabel } from '../domain/labour.js';
import { EXPENSE_CATEGORIES, projectName, totalAmount } from '../domain/projects.js';
import { containsDevanagari } from '../i18n/translate.js';
import { deliverFile } from '../services/files.js';
import { createImagePdf } from './pdf-image-export.js';
import { drawLetterhead } from './letterhead-pdf.js';

const MARGIN = 12;

export function expenseFilename(projectLabel, month, extension) {
  return `Expenses-${projectLabel || 'all'}-${month}`.replace(/[\\/:*?"<>|\s]+/g, '_') + `.${extension}`;
}

function textPdf({ days, projects, projectLabel, showProject, month, firm }) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const y = drawLetterhead(doc, {
    firm,
    title: 'Daily site expenses',
    meta: [projectLabel, monthLabel(month, 'en'), `Date: ${todayIso()}`],
    margin: MARGIN,
    fontSize: 10
  });
  const body = [];
  const dayRows = [];
  for (const day of days) {
    day.items.forEach((expense, index) => body.push([
      index === 0 ? day.date : '', ...(showProject ? [projectName(projects, expense.projectId)] : []),
      EXPENSE_CATEGORIES[expense.category] || expense.category, expense.note, formatCurrencyAscii(expense.amount)
    ]));
    dayRows.push(body.length);
    body.push([{ content: 'Day total', colSpan: showProject ? 4 : 3 }, formatCurrencyAscii(day.total)]);
  }
  const total = totalAmount(days.flatMap((day) => day.items));
  body.push([{ content: 'Total', colSpan: showProject ? 4 : 3 }, formatCurrencyAscii(total)]);
  autoTable(doc, {
    head: [['Date', ...(showProject ? ['Project'] : []), 'Category', 'Note', 'Amount']],
    body,
    startY: y,
    margin: { left: MARGIN, right: MARGIN },
    theme: 'grid',
    styles: { font: 'helvetica', fontSize: 9, cellPadding: 1.8 },
    headStyles: { fillColor: [235, 238, 242], textColor: 20 },
    columnStyles: { [showProject ? 4 : 3]: { halign: 'right', cellWidth: 28 } },
    didParseCell: ({ cell, row, section }) => {
      if (section !== 'body') return;
      if (dayRows.includes(row.index)) Object.assign(cell.styles, { fontStyle: 'bold', fillColor: [243, 245, 248] });
      if (row.index === body.length - 1) Object.assign(cell.styles, { fontStyle: 'bold', fillColor: [225, 230, 238] });
    }
  });
  return doc;
}

/** PDF of the daily expense table; Hindi (or Hindi notes) uses the rendered sheet. */
export async function exportExpensePdf({ rendered, language, ...data }) {
  const needsImage = language === 'hi' || containsDevanagari(data.days.flatMap((day) => day.items.map((expense) => expense.note))) || containsDevanagari(data.projectLabel);
  const doc = needsImage && rendered
    ? await createImagePdf([rendered], { paper: 'a4', orientation: 'portrait', margin: 10, pageNumbers: false })
    : textPdf(data);
  return deliverFile(new File([doc.output('blob')], expenseFilename(data.projectLabel, data.month, 'pdf'), { type: 'application/pdf' }));
}

const csvCell = (value) => {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** CSV for Excel / Google Sheets (UTF-8 with a byte-order mark so Hindi opens correctly). */
export async function exportExpenseCsv({ days, projects, projectLabel, month }) {
  const rows = [['Date', 'Project', 'Category', 'Note', 'Amount']];
  for (const day of days) {
    for (const expense of day.items) {
      rows.push([expense.date, projectName(projects, expense.projectId), EXPENSE_CATEGORIES[expense.category] || expense.category, expense.note, expense.amount]);
    }
  }
  rows.push(['Total', '', '', '', totalAmount(days.flatMap((day) => day.items))]);
  const csv = '\uFEFF' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
  return deliverFile(new File([csv], expenseFilename(projectLabel, month, 'csv'), { type: 'text/csv' }));
}

/**
 * Project statement as PDF (English as text; Hindi or Hindi notes rendered from
 * the on-screen document) and CSV for Excel. Loaded on demand.
 */
import { jsPDF } from 'jspdf';
import autoTable from 'jspdf-autotable';
import { formatCurrencyAscii, todayIso } from '../domain/formatters.js';
import { containsDevanagari } from '../i18n/translate.js';
import { deliverFile } from '../services/files.js';
import { createImagePdf } from './pdf-image-export.js';
import { drawLetterhead } from './letterhead-pdf.js';
import { periodText, statementTables } from './statement-tables.js';

const MARGIN = 12;
const english = (text) => text;

export function statementFilename(project, period, extension) {
  const when = period.from || period.to ? `${period.from || 'start'}_${period.to || 'now'}` : 'all';
  return `Statement-${project.name}-${when}`.replace(/[\\/:*?"<>|\s]+/g, '_') + `.${extension}`;
}

function textPdf({ statement, firm }) {
  const { project } = statement;
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  let y = drawLetterhead(doc, {
    firm,
    title: 'Project statement',
    meta: [project.name, periodText(statement.period, english), `Date: ${todayIso()}`],
    billTo: { label: 'Client', lines: [project.client, project.clientPhone, project.clientAddress, project.address && `Site: ${project.address}`] },
    margin: MARGIN,
    fontSize: 10
  });
  for (const table of statementTables(statement, english, formatCurrencyAscii)) {
    if (y > 255) { doc.addPage(); y = MARGIN; }
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(10);
    doc.setTextColor(40);
    doc.text(table.title, MARGIN, y + 4);
    const numeric = Object.fromEntries(table.head.map((_cell, index) => [index, index >= table.numericFrom ? { halign: 'right' } : {}]));
    autoTable(doc, {
      head: [table.head],
      body: table.rows.map((entry) => entry.cells),
      startY: y + 6,
      margin: { left: MARGIN, right: MARGIN },
      theme: 'grid',
      styles: { font: 'helvetica', fontSize: 9, cellPadding: 1.8 },
      headStyles: { fillColor: [235, 238, 242], textColor: 20 },
      columnStyles: numeric,
      didParseCell: ({ cell, column, row, section }) => {
        if (section === 'head' && column.index >= table.numericFrom) cell.styles.halign = 'right';
        if (section === 'body' && table.rows[row.index]?.bold) Object.assign(cell.styles, { fontStyle: 'bold', fillColor: [243, 245, 248] });
      }
    });
    y = doc.lastAutoTable.finalY + 6;
  }
  return doc;
}

/** PDF of the statement; Hindi (or Hindi names/notes) uses the rendered document. */
export async function exportStatementPdf({ rendered, language, ...data }) {
  const { project, advances } = data.statement;
  const needsImage = language === 'hi' || containsDevanagari([project.name, project.client, project.address, ...advances.map((advance) => advance.note)]);
  const doc = needsImage && rendered
    ? await createImagePdf([rendered], { paper: 'a4', orientation: 'portrait', margin: 10, pageNumbers: false })
    : textPdf(data);
  return deliverFile(new File([doc.output('blob')], statementFilename(project, data.statement.period, 'pdf'), { type: 'application/pdf' }));
}

const csvCell = (value) => {
  const text = String(value ?? '');
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
};

/** CSV for Excel / Google Sheets: every table one after the other (UTF-8 with a byte-order mark). */
export async function exportStatementCsv({ statement }) {
  const { project } = statement;
  const rows = [['Project statement'], ['Project', project.name], ['Client', project.client], ['Period', periodText(statement.period, english)], []];
  for (const table of statementTables(statement, english, (amount) => amount)) {
    rows.push([table.title], table.head, ...table.rows.map((entry) => entry.cells), []);
  }
  const csv = '\uFEFF' + rows.map((row) => row.map(csvCell).join(',')).join('\r\n');
  return deliverFile(new File([csv], statementFilename(project, statement.period, 'csv'), { type: 'text/csv' }));
}

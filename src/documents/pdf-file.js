import { deliverFile } from '../services/files.js';

/** File name for a bill's PDF, e.g. "Bill-12-Lake_View_Villa.pdf". */
export function pdfFilename(bill) {
  return `Bill-${bill.number || '1'}-${bill.projectName || 'Construction'}`.replace(/[^\w.-]/g, '_') + '.pdf';
}

/** Hands a finished jsPDF document to the share sheet, or downloads it. */
export function deliverPdf(doc, bill) {
  return deliverFile(new File([doc.output('blob')], pdfFilename(bill), { type: 'application/pdf' }));
}

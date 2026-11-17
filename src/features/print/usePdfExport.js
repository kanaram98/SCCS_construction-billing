import { useState } from 'react';

/**
 * PDF download and browser print, guarded by export validation.
 * jsPDF is imported lazily so it only loads when the user exports.
 */
export function usePdfExport({ bill, rates, firm, printSettings, exportErrors, selectedDocuments }) {
  const [message, setMessage] = useState('');

  function blockedReason(action) {
    if (exportErrors.length) return `Fix the listed issues before ${action}.`;
    if (!selectedDocuments.length) return `Select at least one document to ${action === 'printing' ? 'print' : 'export'}.`;
    return '';
  }

  async function downloadPdf() {
    const reason = blockedReason('exporting the PDF');
    if (reason) {
      setMessage(reason);
      return;
    }
    try {
      setMessage('Preparing PDF…');
      const { exportBillPdf } = await import('../../documents/pdf-export.js');
      await exportBillPdf(bill, rates, firm, printSettings);
      setMessage('PDF ready to save or share.');
    } catch (error) {
      console.error('Could not export PDF.', error);
      setMessage(`PDF export failed: ${error.message || 'Unknown error'}`);
    }
  }

  function print() {
    const reason = blockedReason('printing');
    if (reason) {
      setMessage(reason);
      return;
    }
    window.print();
  }

  return { message, downloadPdf, print, canExport: !exportErrors.length && selectedDocuments.length > 0 };
}

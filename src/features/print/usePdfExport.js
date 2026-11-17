import { useNotify } from '../../components/ui';

/**
 * PDF download and browser print, guarded by export validation.
 * jsPDF is imported lazily so it only loads when the user exports.
 */
export function usePdfExport({ bill, rates, firm, printSettings, exportErrors, selectedDocuments }) {
  const notify = useNotify();

  function blockedReason(action) {
    if (exportErrors.length) return `Fix the listed issues before ${action}.`;
    if (!selectedDocuments.length) return `Select at least one document to ${action === 'printing' ? 'print' : 'export'}.`;
    return '';
  }

  async function downloadPdf() {
    const reason = blockedReason('exporting the PDF');
    if (reason) {
      notify(reason, 'warning');
      return;
    }
    try {
      notify('Preparing PDF…', 'info');
      const { exportBillPdf } = await import('../../documents/pdf-export.js');
      await exportBillPdf(bill, rates, firm, printSettings);
      notify('PDF ready to save or share.');
    } catch (error) {
      if (error?.name === 'AbortError') return; // user closed the share sheet
      console.error('Could not export PDF.', error);
      notify(`PDF export failed: ${error.message || 'Unknown error'}`, 'error');
    }
  }

  function print() {
    const reason = blockedReason('printing');
    if (reason) {
      notify(reason, 'warning');
      return;
    }
    window.print();
  }

  return { downloadPdf, print, canExport: !exportErrors.length && selectedDocuments.length > 0 };
}

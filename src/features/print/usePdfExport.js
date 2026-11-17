import { useNotify } from '../../components/ui';
import { getLanguage, tr as t } from '../../i18n/translate.js';
import { resolveBillLanguage } from '../../domain/print-settings.js';

/** Rendered documents in the hidden print batch (used for Hindi image PDFs). */
const renderedDocuments = () => [...document.querySelectorAll('.print-batch .print-document')];

/**
 * PDF download and browser print, guarded by export validation.
 * jsPDF is imported lazily so it only loads when the user exports.
 */
export function usePdfExport({ bill, rates, firm, printSettings, exportErrors, selectedDocuments }) {
  const notify = useNotify();

  function blockedReason(action) {
    const printing = action === 'printing';
    if (exportErrors.length) return printing ? t('Fix the listed issues before printing.') : t('Fix the listed issues before exporting the PDF.');
    if (!selectedDocuments.length) return printing ? t('Select at least one document to print.') : t('Select at least one document to export.');
    return '';
  }

  async function downloadPdf() {
    const reason = blockedReason('exporting the PDF');
    if (reason) {
      notify(reason, 'warning');
      return;
    }
    try {
      notify(t('Preparing PDF…'), 'info');
      if (resolveBillLanguage(printSettings, getLanguage()) === 'hi') {
        // jsPDF cannot shape Hindi text, so Hindi bills are exported from the rendered preview.
        const { exportImagePdf } = await import('../../documents/pdf-image-export.js');
        await exportImagePdf(bill, renderedDocuments(), printSettings);
      } else {
        const { exportBillPdf } = await import('../../documents/pdf-export.js');
        await exportBillPdf(bill, rates, firm, printSettings);
      }
      notify(t('PDF ready to save or share.'));
    } catch (error) {
      if (error?.name === 'AbortError') return; // user closed the share sheet
      console.error('Could not export PDF.', error);
      notify(t('PDF export failed: {reason}', { reason: error.message || t('Unknown error') }), 'error');
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

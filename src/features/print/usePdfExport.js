import { useNotify } from '../../components/ui';
import { containsDevanagari, getLanguage, makeTranslator, tr as t } from '../../i18n/translate.js';
import { resolveBillLanguage } from '../../domain/print-settings.js';
import { getBillTotals } from '../../domain/calculations.js';
import { billShareMessage, whatsappNumber, whatsappUrl } from '../../domain/whatsapp.js';
import { canSharePdfFiles, isShareCancelled } from '../../services/files.js';

/** Rendered documents in the hidden print batch (used for Hindi image PDFs). */
const renderedDocuments = () => [...document.querySelectorAll('.print-batch .print-document')];

/**
 * PDF download, WhatsApp sharing and browser print, guarded by export validation.
 * The PDF libraries are imported lazily so they only load when the user exports.
 */
export function usePdfExport({ bill, rates, firm, printSettings, exportErrors, selectedDocuments, runningAccount = null }) {
  const notify = useNotify();
  const billLanguage = resolveBillLanguage(printSettings, getLanguage());

  function blockedReason(action) {
    const printing = action === 'printing';
    if (exportErrors.length) return printing ? t('Fix the listed issues before printing.') : t('Fix the listed issues before exporting the PDF.');
    if (!selectedDocuments.length) return printing ? t('Select at least one document to print.') : t('Select at least one document to export.');
    return '';
  }

  /** Builds the PDF in the bill's language and shares or downloads it. */
  async function createPdf(options = {}) {
    // jsPDF's fonts have no Hindi letters, so a Hindi bill — or one with Hindi names in it —
    // is exported from the rendered preview instead.
    if (billLanguage === 'hi' || containsDevanagari({ bill, firm: { name: firm.name, address: firm.address } })) {
      const { exportImagePdf } = await import('../../documents/pdf-image-export.js');
      await exportImagePdf(bill, renderedDocuments(), printSettings, options);
    } else {
      const { exportBillPdf } = await import('../../documents/pdf-export.js');
      await exportBillPdf(bill, rates, firm, printSettings, { ...options, runningAccount });
    }
  }

  async function run(task, successMessage) {
    try {
      notify(t('Preparing PDF…'), 'info');
      await task();
      if (successMessage) notify(successMessage);
    } catch (error) {
      if (isShareCancelled(error)) return;
      console.error('Could not export PDF.', error);
      notify(t('PDF export failed: {reason}', { reason: error.message || t('Unknown error') }), 'error');
    }
  }

  async function downloadPdf() {
    const reason = blockedReason('exporting the PDF');
    if (reason) {
      notify(reason, 'warning');
      return;
    }
    await run(() => createPdf(), t('PDF ready to save or share.'));
  }

  /**
   * Phones: share the PDF with a summary message (the user picks WhatsApp and the client).
   * Computers: open WhatsApp with the message, addressed to the client when their number is known.
   */
  async function shareOnWhatsApp() {
    const reason = blockedReason('exporting the PDF');
    if (reason) {
      notify(reason, 'warning');
      return;
    }
    const message = billShareMessage({ bill, firm, totals: getBillTotals(bill, rates), t: makeTranslator(billLanguage) });
    if (canSharePdfFiles()) {
      notify(t('Choose WhatsApp in the share menu, then the client.'), 'info');
      await run(() => createPdf({ shareText: message }));
      return;
    }
    window.open(whatsappUrl(bill.clientPhone, message), '_blank', 'noopener');
    if (!whatsappNumber(bill.clientPhone)) notify(t('Add the client’s phone number in Project to open their chat directly.'), 'info');
  }

  function print() {
    const reason = blockedReason('printing');
    if (reason) {
      notify(reason, 'warning');
      return;
    }
    window.print();
  }

  return { downloadPdf, shareOnWhatsApp, print, canExport: !exportErrors.length && selectedDocuments.length > 0 };
}

import { useMemo, useRef } from 'react';
import { useNotify } from '../../components/ui';
import { useBilling } from '../../state/BillingContext.jsx';
import { resolveBillLanguage } from '../../domain/print-settings.js';
import { canSharePdfFiles, isShareCancelled } from '../../services/files.js';
import { whatsappUrl } from '../../domain/whatsapp.js';
import { getLanguage, makeTranslator, tr as t } from '../../i18n/translate.js';

/** PDF and WhatsApp sharing of a printable rate list (standard rates or one quotation). `rates` are the items to print. */
export function useQuotationExport({ quotation, rates }) {
  const { data } = useBilling();
  const notify = useNotify();
  const previewRef = useRef(null);
  const { firm } = data;
  const language = resolveBillLanguage(data.printSettings, getLanguage());
  const docT = useMemo(() => makeTranslator(language), [language]);

  async function exportPdf(shareText) {
    try {
      notify(t('Preparing PDF…'), 'info');
      const { exportQuotationPdf } = await import('../../documents/quotation-pdf.js');
      await exportQuotationPdf({ quotation, rates, firm, language, rendered: previewRef.current?.querySelector('.quotation-document'), shareText });
      if (!shareText) notify(t('PDF ready to save or share.'));
    } catch (error) {
      if (isShareCancelled(error)) return;
      console.error('Could not export quotation.', error);
      notify(t('PDF export failed: {reason}', { reason: error.message || t('Unknown error') }), 'error');
    }
  }

  function shareOnWhatsApp() {
    const message = [
      docT(quotation.title || 'Rate quotation') + (firm.name ? ` — ${firm.name}` : ''),
      ...rates.map((rate) => `• ${rate.name}: ₹${Number(rate.rate) || 0}/${rate.unit}`),
      firm.phone ? `📞 ${firm.phone}` : ''
    ].filter(Boolean).join('\n');
    if (canSharePdfFiles()) {
      notify(t('Choose WhatsApp in the share menu, then the client.'), 'info');
      exportPdf(message);
    } else {
      window.open(whatsappUrl('', message), '_blank', 'noopener');
    }
  }

  return { exportPdf, shareOnWhatsApp, previewRef, docT, firm };
}

import { useBilling } from '../state/BillingContext.jsx';
import { useNotify } from '../components/ui';
import { getBillTotals } from '../domain/calculations.js';
import { resolveBillLanguage } from '../domain/print-settings.js';
import { paymentReminderMessage, whatsappNumber, whatsappUrl } from '../domain/whatsapp.js';
import { getLanguage, makeTranslator, tr } from '../i18n/translate.js';

/**
 * Opens WhatsApp with a payment reminder for a bill, addressed to the client
 * when their phone number is saved. Written in the bill language.
 */
export function useWhatsAppReminder() {
  const { data } = useBilling();
  const notify = useNotify();

  return {
    /** Whether the bill has anything left to remind about. */
    canRemind: (bill) => getBillTotals(bill, data.rates).balance > 0,
    remind(bill) {
      const t = makeTranslator(resolveBillLanguage(data.printSettings, getLanguage()));
      const message = paymentReminderMessage({ bill, firm: data.firm, totals: getBillTotals(bill, data.rates), t });
      window.open(whatsappUrl(bill.clientPhone, message), '_blank', 'noopener');
      if (!whatsappNumber(bill.clientPhone)) notify(tr('Add the client’s phone number in Project to open their chat directly.'), 'info');
    }
  };
}

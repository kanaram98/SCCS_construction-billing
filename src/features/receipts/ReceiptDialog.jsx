import { useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import DownloadIcon from '@mui/icons-material/Download';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import { ResponsiveDialog, useNotify } from '../../components/ui';
import { useBilling } from '../../state/BillingContext.jsx';
import { receiptMessage } from '../../domain/receipt.js';
import { whatsappNumber, whatsappUrl } from '../../domain/whatsapp.js';
import { isShareCancelled } from '../../services/files.js';
import { getLanguage, makeTranslator, tr as t } from '../../i18n/translate.js';
import FitToWidth from '../print/preview/FitToWidth.jsx';
import ReceiptDocument from './ReceiptDocument.jsx';

const PORTRAIT_WIDTH_PX = 794;

/** Preview of a payment receipt with PDF and WhatsApp buttons. `receipt` null = closed. */
export default function ReceiptDialog({ receipt, onClose }) {
  const { data } = useBilling();
  const notify = useNotify();
  const sheetRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const language = getLanguage();
  const docT = makeTranslator(language);

  async function pdf() {
    setBusy(true);
    try {
      const { exportReceiptPdf } = await import('../../documents/receipt-export.js');
      await exportReceiptPdf({ receipt, firm: data.firm, language, rendered: sheetRef.current?.querySelector('.receipt-document') });
      notify(t('File ready to save or share.'));
    } catch (error) {
      if (!isShareCancelled(error)) notify(t('Export failed: {reason}', { reason: error.message || t('Unknown error') }), 'error');
    } finally {
      setBusy(false);
    }
  }

  function whatsapp() {
    window.open(whatsappUrl(receipt.clientPhone, receiptMessage(receipt, data.firm, docT, language)), '_blank', 'noopener');
    if (!whatsappNumber(receipt.clientPhone)) notify(t('Add the client’s phone number in the project to open their chat directly.'), 'info');
  }

  return (
    <ResponsiveDialog open={Boolean(receipt)} title={t('Payment receipt')} onClose={onClose} maxWidth="sm">
      {receipt && (
        <>
          <Box ref={sheetRef} sx={{ border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden', bgcolor: '#fff', mb: 1.5 }}>
            <FitToWidth contentWidth={PORTRAIT_WIDTH_PX}>
              <ReceiptDocument receipt={receipt} firm={data.firm} t={docT} language={language} />
            </FitToWidth>
          </Box>
          <Stack direction="row" spacing={1}>
            <Button fullWidth variant="outlined" startIcon={<DownloadIcon />} onClick={pdf} disabled={busy}>PDF</Button>
            <Button fullWidth variant="contained" startIcon={<WhatsAppIcon />} onClick={whatsapp} sx={{ bgcolor: '#25D366', color: '#0b3d1f', '&:hover': { bgcolor: '#1ebe5a' } }}>WhatsApp</Button>
          </Stack>
        </>
      )}
    </ResponsiveDialog>
  );
}

import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import DownloadIcon from '@mui/icons-material/Download';
import PrintIcon from '@mui/icons-material/Print';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import { tr as t } from '../../i18n/translate.js';

/** PDF, Print and WhatsApp for a rate list. */
export default function QuotationActions({ exporter, disabled }) {
  return (
    <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
      <Button fullWidth variant="outlined" startIcon={<DownloadIcon />} onClick={() => exporter.exportPdf()} disabled={disabled}>PDF</Button>
      <Button fullWidth variant="outlined" startIcon={<PrintIcon />} onClick={() => window.print()} disabled={disabled}>{t('Print')}</Button>
      <Button
        fullWidth
        variant="contained"
        startIcon={<WhatsAppIcon />}
        onClick={exporter.shareOnWhatsApp}
        disabled={disabled}
        sx={{ bgcolor: '#25D366', color: '#0b3d1f', '&:hover': { bgcolor: '#1ebe5a' } }}
      >
        WhatsApp
      </Button>
    </Stack>
  );
}

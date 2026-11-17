import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import DownloadIcon from '@mui/icons-material/Download';
import PrintIcon from '@mui/icons-material/Print';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import { IssuesAlert, SelectField } from '../../components/ui';
import { getPrintDocument, isSignatureVisible } from '../../domain/print-settings.js';
import DocumentPreview, { getPaperWidthPx } from './preview/DocumentPreview.jsx';
import FitToWidth from './preview/FitToWidth.jsx';
import { tr as t, trn } from '../../i18n/translate.js';

/** Export actions on top, the scaled page preview straight below. */
export default function PreviewTab({ bill, firm, rates, printSettings, selectedDocuments, previewDocument, exportErrors, exporter, onPreviewChange, onSignatureLayoutChange }) {
  return (
    <>
      <Stack direction="row" spacing={1} sx={{ mb: 1.5, alignItems: 'center' }}>
        <SelectField
          label={t('Document')}
          value={previewDocument}
          options={selectedDocuments.map((id) => ({ value: id, label: getPrintDocument(id).label }))}
          onChange={onPreviewChange}
          sx={{ bgcolor: 'background.paper' }}
        />
        <Button variant="contained" startIcon={<DownloadIcon />} onClick={exporter.downloadPdf} disabled={!exporter.canExport} sx={{ flexShrink: 0 }}>
          {t('PDF')}
        </Button>
        <Button variant="outlined" startIcon={<PrintIcon />} onClick={exporter.print} disabled={!exporter.canExport} sx={{ flexShrink: 0 }}>
          {t('Print')}
        </Button>
      </Stack>
      <Button
        fullWidth
        variant="contained"
        startIcon={<WhatsAppIcon />}
        onClick={exporter.shareOnWhatsApp}
        disabled={!exporter.canExport}
        sx={{ mb: 1.5, py: 1, ...{ bgcolor: '#25D366', color: '#0b3d1f', '&:hover': { bgcolor: '#1ebe5a' } } }}
      >
        {t('Send on WhatsApp')}
      </Button>

      <IssuesAlert issues={exportErrors} severity="error" suffix={t('to fix before export')} />

      <Paper variant="outlined" sx={{ p: { xs: 1, sm: 2 }, bgcolor: 'action.selected' }}>
        <FitToWidth contentWidth={getPaperWidthPx(printSettings)}>
          <DocumentPreview
            bill={bill}
            firm={firm}
            rates={rates}
            printSettings={printSettings}
            className="print-preview"
            documentType={previewDocument}
            signatureVisible={isSignatureVisible(printSettings, selectedDocuments.indexOf(previewDocument), selectedDocuments.length)}
            editableSignature
            onSignatureLayoutChange={onSignatureLayoutChange}
          />
        </FitToWidth>
      </Paper>
      <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
        {trn(selectedDocuments.length, '{count} document in the export.', '{count} documents in the export.')}
        {printSettings.signatureMode !== 'off' && firm.signature ? t(' Drag the signature to reposition it.') : ''}
      </Typography>
    </>
  );
}

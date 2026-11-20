import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import { resolveBillLanguage } from '../../domain/print-settings.js';
import DownloadIcon from '@mui/icons-material/Download';
import PrintIcon from '@mui/icons-material/Print';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import { IssuesAlert, SelectField } from '../../components/ui';
import { getPrintDocument, isSignatureVisible } from '../../domain/print-settings.js';
import DocumentPreview, { getPaperWidthPx } from './preview/DocumentPreview.jsx';
import FitToWidth from './preview/FitToWidth.jsx';
import { BILL_LAYOUTS, layoutOptions, resolveLayout } from '../../domain/bill-layout.js';
import { getLanguage, tr as t, trn } from '../../i18n/translate.js';

/** Export actions on top, the scaled page preview straight below. */
export default function PreviewTab({ bill, firm, rates, printSettings, selectedDocuments, previewDocument, exportErrors, exporter, onPreviewChange, onSignatureLayoutChange, runningAccount, onBillLanguageChange, onLayoutChange }) {
  const billLanguage = resolveBillLanguage(printSettings, getLanguage());
  // Layout of the document being previewed: the bill and the measurement sheet by room or by floor, the summary by its detail setting.
  const layoutChoices = previewDocument === 'summary' ? ['room', 'floor'] : previewDocument === 'bill' || previewDocument === 'measurement' ? layoutOptions(bill) : [];
  const layoutValue = previewDocument === 'summary' ? (printSettings.summaryDetail === 'section' ? 'floor' : 'room') : resolveLayout(bill, printSettings.layouts, previewDocument);
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

      <Stack direction="row" spacing={1} sx={{ mb: 1.5, alignItems: 'center' }}>
        <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>{t('Bill language')}</Typography>
        <ToggleButtonGroup
          size="small"
          exclusive
          color="primary"
          value={billLanguage}
          onChange={(_event, value) => value && onBillLanguageChange(value)}
          aria-label={t('Bill language')}
        >
          <ToggleButton value="en" sx={{ px: 2, textTransform: 'none' }}>English</ToggleButton>
          <ToggleButton value="hi" sx={{ px: 2 }}>हिंदी</ToggleButton>
        </ToggleButtonGroup>
      </Stack>

      {layoutChoices.length > 0 && (
        <Stack direction="row" spacing={1} sx={{ mb: 1.5, alignItems: 'center' }}>
          <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>{t('Layout')}</Typography>
          <ToggleButtonGroup size="small" exclusive color="primary" value={layoutValue} onChange={(_event, value) => value && onLayoutChange(previewDocument, value)} aria-label={t('Layout')}>
            {layoutChoices.map((choice) => <ToggleButton key={choice} value={choice} sx={{ px: 2, textTransform: 'none' }}>{t(BILL_LAYOUTS[choice])}</ToggleButton>)}
          </ToggleButtonGroup>
        </Stack>
      )}

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
            showPageBreaks
            onSignatureLayoutChange={onSignatureLayoutChange}
            runningAccount={runningAccount}
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

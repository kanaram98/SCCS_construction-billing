import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import Paper from '@mui/material/Paper';
import PrintIcon from '@mui/icons-material/Print';
import { ResponsiveDialog } from '../../components/ui';
import { getPrintDocument, isSignatureVisible } from '../../domain/print-settings.js';
import DocumentPreview, { getPaperWidthPx } from './preview/DocumentPreview.jsx';
import FitToWidth from './preview/FitToWidth.jsx';
import { tr as t } from '../../i18n/translate.js';

/** Shows every selected document the way it will print, then prints them all. */
export default function PrintPreviewDialog({ open, onClose, onPrint, bill, firm, rates, printSettings, selectedDocuments, runningAccount }) {
  return (
    <ResponsiveDialog
      open={open}
      title={t('Print preview')}
      onClose={onClose}
      maxWidth="md"
      actions={(
        <>
          <Button onClick={onClose}>{t('Cancel')}</Button>
          <Button variant="contained" startIcon={<PrintIcon />} onClick={onPrint}>{t('Print now')}</Button>
        </>
      )}
    >
      {open && (
        <Stack spacing={2}>
          {selectedDocuments.map((documentType, index) => (
            <div key={documentType}>
              <Typography variant="subtitle2" sx={{ mb: 0.5 }}>{t(getPrintDocument(documentType).label)}</Typography>
              <Paper variant="outlined" sx={{ p: 1, bgcolor: 'action.selected' }}>
                <FitToWidth contentWidth={getPaperWidthPx(printSettings)}>
                  <DocumentPreview
                    bill={bill}
                    firm={firm}
                    rates={rates}
                    printSettings={printSettings}
                    documentType={documentType}
                    showPageBreaks
                    signatureVisible={isSignatureVisible(printSettings, index, selectedDocuments.length)}
                    runningAccount={runningAccount}
                  />
                </FitToWidth>
              </Paper>
            </div>
          ))}
        </Stack>
      )}
    </ResponsiveDialog>
  );
}

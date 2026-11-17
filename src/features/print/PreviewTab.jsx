import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import DownloadIcon from '@mui/icons-material/Download';
import PrintIcon from '@mui/icons-material/Print';
import { IssuesAlert, SelectField } from '../../components/ui';
import { getPrintDocument, isSignatureVisible } from '../../domain/print-settings.js';
import DocumentPreview, { getPaperWidthPx } from './preview/DocumentPreview.jsx';
import FitToWidth from './preview/FitToWidth.jsx';

/** Export actions on top, the scaled page preview straight below. */
export default function PreviewTab({ bill, firm, rates, printSettings, selectedDocuments, previewDocument, exportErrors, exporter, onPreviewChange, onSignatureLayoutChange }) {
  return (
    <>
      <Stack direction="row" spacing={1} sx={{ mb: 1.5, alignItems: 'center' }}>
        <SelectField
          label="Document"
          value={previewDocument}
          options={selectedDocuments.map((id) => ({ value: id, label: getPrintDocument(id).label }))}
          onChange={onPreviewChange}
          sx={{ bgcolor: 'background.paper' }}
        />
        <Button variant="contained" startIcon={<DownloadIcon />} onClick={exporter.downloadPdf} disabled={!exporter.canExport} sx={{ flexShrink: 0 }}>
          PDF
        </Button>
        <Button variant="outlined" startIcon={<PrintIcon />} onClick={exporter.print} disabled={!exporter.canExport} sx={{ flexShrink: 0 }}>
          Print
        </Button>
      </Stack>

      <IssuesAlert issues={exportErrors} severity="error" suffix="to fix before export" />

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
        {selectedDocuments.length} {selectedDocuments.length === 1 ? 'document' : 'documents'} in the export.
        {printSettings.signatureMode !== 'off' && firm.signature ? ' Drag the signature to reposition it.' : ''}
      </Typography>
    </>
  );
}

import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import DownloadIcon from '@mui/icons-material/Download';
import PrintIcon from '@mui/icons-material/Print';
import { Card, MessageList, Notice } from '../../components/ui';
import { pluralize } from '../../domain/formatters.js';

export default function ExportPanel({ documentCount, exportErrors, exporter }) {
  return (
    <Card
      className="no-print"
      title="Export"
      description={`${documentCount} ${pluralize(documentCount, 'document')} will be included in the selected order.`}
    >
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
        <Button variant="contained" size="large" startIcon={<DownloadIcon />} onClick={exporter.downloadPdf} disabled={!exporter.canExport}>
          Download / share PDF
        </Button>
        <Button variant="outlined" size="large" startIcon={<PrintIcon />} onClick={exporter.print} disabled={!exporter.canExport}>
          Print
        </Button>
      </Stack>
      {exportErrors.length > 0 && (
        <Notice tone="error" title="Complete these details before exporting" sx={{ mt: 2, mb: 0 }}>
          <MessageList messages={exportErrors} />
        </Notice>
      )}
    </Card>
  );
}

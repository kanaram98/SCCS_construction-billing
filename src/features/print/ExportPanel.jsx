import { Button, Card, MessageList } from '../../components/ui';
import { pluralize } from '../../domain/formatters.js';

export default function ExportPanel({ documentCount, exportErrors, exporter }) {
  return (
    <Card title="Export" className="no-print">
      <p>{documentCount} {pluralize(documentCount, 'document')} will be included in the selected order.</p>
      <div className="button-row">
        <Button variant="primary" onClick={exporter.downloadPdf} disabled={!exporter.canExport}>Download / share PDF</Button>
        <Button onClick={exporter.print} disabled={!exporter.canExport}>Print / Save as PDF</Button>
      </div>
      {exportErrors.length > 0 && (
        <div className="notice error validation-summary" role="alert">
          <strong>Complete these details before exporting</strong>
          <MessageList messages={exportErrors} />
        </div>
      )}
      {exporter.message && <p className="notice" role="status">{exporter.message}</p>}
    </Card>
  );
}

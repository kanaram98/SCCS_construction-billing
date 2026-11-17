import { useMemo } from 'react';
import Typography from '@mui/material/Typography';
import { useBilling } from '../../state/BillingContext.jsx';
import { Card, EmptyState, PageHeading, SelectField } from '../../components/ui';
import { getExportErrors } from '../../domain/validation.js';
import { getPrintDocument, getSelectedDocuments, isSignatureVisible } from '../../domain/print-settings.js';
import { usePdfExport } from './usePdfExport.js';
import PrintPageStyle from './PrintPageStyle.jsx';
import ExportPanel from './ExportPanel.jsx';
import DocumentSelection from './DocumentSelection.jsx';
import { LayoutSettings, PageSetupSettings } from './PageSettings.jsx';
import SignatureSettings from './SignatureSettings.jsx';
import DocumentPreview, { getPaperWidthPx } from './preview/DocumentPreview.jsx';
import FitToWidth from './preview/FitToWidth.jsx';

export default function PrintPage() {
  const { data, bill, actions } = useBilling();
  const { firm, rates, printSettings } = data;
  const print = actions.print;

  const exportErrors = useMemo(
    () => getExportErrors({ bill, bills: data.bills, rates, firm }),
    [bill, data.bills, rates, firm]
  );
  const selectedDocuments = getSelectedDocuments(printSettings);
  const previewDocument = selectedDocuments.includes(printSettings.previewDocument)
    ? printSettings.previewDocument
    : selectedDocuments[0] || 'bill';
  const exporter = usePdfExport({ bill, rates, firm, printSettings, exportErrors, selectedDocuments });
  const previewProps = { bill, firm, rates, printSettings };

  return (
    <section className="print-page">
      <PrintPageStyle settings={printSettings} />
      <div className="no-print">
        <PageHeading title="PDF / Print" description="Choose documents, adjust the layout and export." />
      </div>
      <ExportPanel documentCount={selectedDocuments.length} exportErrors={exportErrors} exporter={exporter} />
      <DocumentSelection
        settings={printSettings}
        selectedCount={selectedDocuments.length}
        onToggle={print.toggleDocument}
        onMove={print.moveDocument}
      />
      <PageSetupSettings settings={printSettings} onChange={print.update} />
      <LayoutSettings
        settings={printSettings}
        footer={bill.footer}
        onChange={print.update}
        onFooterChange={(footer) => actions.bills.update({ footer })}
      />
      <SignatureSettings
        settings={printSettings}
        hasSignature={Boolean(firm.signature)}
        onChange={print.update}
        onWidthChange={print.setSignatureWidth}
        onResetPlacement={print.resetSignatureLayout}
      />

      {selectedDocuments.length ? (
        <>
          <Card className="no-print" title="Preview">
            <SelectField
              label="Document"
              value={previewDocument}
              options={selectedDocuments.map((id) => ({ value: id, label: getPrintDocument(id).label }))}
              onChange={(value) => print.update({ previewDocument: value })}
              sx={{ mb: 2 }}
            />
            {/* Interactive preview of one document, scaled to fit the screen (hidden when printing). */}
            <FitToWidth contentWidth={getPaperWidthPx(printSettings)}>
              <DocumentPreview
                {...previewProps}
                className="print-preview"
                documentType={previewDocument}
                signatureVisible={isSignatureVisible(
                  printSettings,
                  selectedDocuments.indexOf(previewDocument),
                  selectedDocuments.length
                )}
                editableSignature
                onSignatureLayoutChange={print.setSignatureLayout}
              />
            </FitToWidth>
            {printSettings.signatureMode !== 'off' && firm.signature && (
              <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
                Signature position and size are saved on this device.
              </Typography>
            )}
          </Card>
          {/* Every selected document, shown only when printing. */}
          <div className="print-batch">
            {selectedDocuments.map((documentType, index) => (
              <DocumentPreview
                {...previewProps}
                key={documentType}
                documentType={documentType}
                signatureVisible={isSignatureVisible(printSettings, index, selectedDocuments.length)}
              />
            ))}
          </div>
        </>
      ) : (
        <EmptyState title="Nothing selected" description="Select at least one document above to preview and export it." />
      )}
    </section>
  );
}

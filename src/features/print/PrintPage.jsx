import { useMemo } from 'react';
import { useBilling } from '../../state/BillingContext.jsx';
import { Card, EmptyState, SelectField } from '../../components/ui';
import { getExportErrors } from '../../domain/validation.js';
import { getPrintDocument, getSelectedDocuments, isSignatureVisible } from '../../domain/print-settings.js';
import { usePdfExport } from './usePdfExport.js';
import PrintPageStyle from './PrintPageStyle.jsx';
import ExportPanel from './ExportPanel.jsx';
import DocumentSelection from './DocumentSelection.jsx';
import { LayoutSettings, PageSetupSettings } from './PageSettings.jsx';
import SignatureSettings from './SignatureSettings.jsx';
import DocumentPreview from './preview/DocumentPreview.jsx';

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
    <section>
      <PrintPageStyle settings={printSettings} />
      <h1>PDF export and print</h1>
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

      <Card className="no-print">
        <SelectField
          label="Preview"
          value={selectedDocuments.length ? previewDocument : ''}
          disabled={!selectedDocuments.length}
          placeholder={selectedDocuments.length ? undefined : 'No documents selected'}
          options={selectedDocuments.map((id) => ({ value: id, label: getPrintDocument(id).label }))}
          onChange={(value) => print.update({ previewDocument: value })}
        />
        {printSettings.signatureMode !== 'off' && firm.signature && (
          <div className="signature-placement-help">
            <span>Position and size changes are saved on this device.</span>
          </div>
        )}
      </Card>

      {selectedDocuments.length ? (
        <>
          {/* Interactive on-screen preview of one document (hidden when printing). */}
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

import { useMemo, useState } from 'react';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import VisibilityIcon from '@mui/icons-material/VisibilityOutlined';
import TuneIcon from '@mui/icons-material/Tune';
import { useBilling } from '../../state/BillingContext.jsx';
import { EmptyState } from '../../components/ui';
import { getExportErrors } from '../../domain/validation.js';
import { getSelectedDocuments, isSignatureVisible } from '../../domain/print-settings.js';
import { usePdfExport } from './usePdfExport.js';
import PrintPageStyle from './PrintPageStyle.jsx';
import PreviewTab from './PreviewTab.jsx';
import DocumentSelection from './DocumentSelection.jsx';
import { LayoutSettings, PageSetupSettings } from './PageSettings.jsx';
import SignatureSettings from './SignatureSettings.jsx';
import DocumentPreview from './preview/DocumentPreview.jsx';
import { tr as t } from '../../i18n/translate.js';

const TABS = { preview: 'preview', settings: 'settings' };

/** PDF / Print screen: a Preview tab (default) and a Settings tab. */
export default function PrintPage() {
  const { data, bill, actions } = useBilling();
  const { firm, rates, printSettings } = data;
  const print = actions.print;
  const [tab, setTab] = useState(TABS.preview);

  const exportErrors = useMemo(
    () => getExportErrors({ bill, bills: data.bills, rates, firm }),
    [bill, data.bills, rates, firm]
  );
  const selectedDocuments = getSelectedDocuments(printSettings);
  const previewDocument = selectedDocuments.includes(printSettings.previewDocument)
    ? printSettings.previewDocument
    : selectedDocuments[0] || 'bill';
  const exporter = usePdfExport({ bill, rates, firm, printSettings, exportErrors, selectedDocuments });

  return (
    <section className="print-page">
      <PrintPageStyle settings={printSettings} />

      <Paper variant="outlined" className="no-print" sx={{ mb: 2 }}>
        <Tabs value={tab} onChange={(_event, value) => setTab(value)} variant="fullWidth" aria-label={t('PDF and print')}>
          <Tab value={TABS.preview} label={t('Preview')} icon={<VisibilityIcon fontSize="small" />} iconPosition="start" sx={{ minHeight: 52 }} />
          <Tab value={TABS.settings} label={t('Settings')} icon={<TuneIcon fontSize="small" />} iconPosition="start" sx={{ minHeight: 52 }} />
        </Tabs>
      </Paper>

      {tab === TABS.preview && (
        <div className="no-print">
          {selectedDocuments.length ? (
            <PreviewTab
              bill={bill}
              firm={firm}
              rates={rates}
              printSettings={printSettings}
              selectedDocuments={selectedDocuments}
              previewDocument={previewDocument}
              exportErrors={exportErrors}
              exporter={exporter}
              onPreviewChange={(value) => print.update({ previewDocument: value })}
              onSignatureLayoutChange={print.setSignatureLayout}
            />
          ) : (
            <EmptyState
              title={t('No documents selected')}
              description={t('Choose which documents to include in Settings.')}
              action={<Button variant="contained" onClick={() => setTab(TABS.settings)}>{t('Open settings')}</Button>}
            />
          )}
        </div>
      )}

      {tab === TABS.settings && (
        <div className="no-print">
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
          <Button fullWidth variant="contained" startIcon={<VisibilityIcon />} onClick={() => setTab(TABS.preview)}>
            {t('Back to preview')}
          </Button>
        </div>
      )}

      {/* Every selected document, rendered only for browser printing. */}
      <div className="print-batch">
        {selectedDocuments.map((documentType, index) => (
          <DocumentPreview
            key={documentType}
            bill={bill}
            firm={firm}
            rates={rates}
            printSettings={printSettings}
            documentType={documentType}
            signatureVisible={isSignatureVisible(printSettings, index, selectedDocuments.length)}
          />
        ))}
      </div>
    </section>
  );
}

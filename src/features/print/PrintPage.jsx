import { useMemo, useState } from 'react';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import PrintPreviewDialog from './PrintPreviewDialog.jsx';
import VisibilityIcon from '@mui/icons-material/VisibilityOutlined';
import TuneIcon from '@mui/icons-material/Tune';
import { useBilling } from '../../state/BillingContext.jsx';
import { EmptyState } from '../../components/ui';
import { getExportErrors } from '../../domain/validation.js';
import { PRINT_DOCUMENTS, getSelectedDocuments, isSignatureVisible } from '../../domain/print-settings.js';
import { usePdfExport } from './usePdfExport.js';
import { getRunningAccount } from '../../domain/bill-kinds.js';
import BillPicker from './BillPicker.jsx';
import { firmForBill } from '../../domain/bill-final.js';
import PrintPageStyle from './PrintPageStyle.jsx';
import PreviewTab from './PreviewTab.jsx';
import DocumentSelection from './DocumentSelection.jsx';
import { LayoutSettings, PageSetupSettings } from './PageSettings.jsx';
import SignatureSettings from './SignatureSettings.jsx';
import DocumentPreview from './preview/DocumentPreview.jsx';
import { tr as t } from '../../i18n/translate.js';
import { useNotify } from '../../components/ui';
import { useCloud } from '../account/CloudProvider.jsx';

const TABS = { preview: 'preview', settings: 'settings' };

/** PDF / Print screen: a Preview tab (default) and a Settings tab. */
export default function PrintPage({ focus = {} }) {
  const { data, bill: activeBill, actions } = useBilling();
  /** Any bill can be printed, not only the open one (older bills, a bill found from its ⋮ menu). */
  const [pickedId, setPickedId] = useState(focus.billId || '');
  const bill = data.bills.find((entry) => entry.id === pickedId) || activeBill;
  const { rates, printSettings } = data;
  const cloud = useCloud();
  const notify = useNotify();
  const firmEditable = cloud.can('editFirm');
  /** A final bill prints the firm details as they were when it was made final. */
  const firm = useMemo(() => firmForBill(bill, data.firm), [bill, data.firm]);
  /** Signature size and position belong to the firm details: admin only. */
  const firmOnly = (change) => (firmEditable ? change : () => notify(t('Only the admin can change the signature.'), 'info'));
  const print = actions.print;
  const [tab, setTab] = useState(TABS.preview);
  const [previewingPrint, setPreviewingPrint] = useState(false);
  /** How the bill and the measurement sheet are laid out for this print: { bill, measurement } (not saved; each print starts in the bill's own layout). */
  const [layouts, setLayouts] = useState({});

  const exportErrors = useMemo(
    () => getExportErrors({ bill, bills: data.bills, rates, firm }),
    [bill, data.bills, rates, firm]
  );
  const selectedDocuments = getSelectedDocuments(printSettings);
  const previewDocument = selectedDocuments.includes(printSettings.previewDocument)
    ? printSettings.previewDocument
    : selectedDocuments[0] || 'bill';
  const runningAccount = useMemo(() => getRunningAccount(data.bills, bill, rates), [data.bills, bill, rates]);
  /** The saved print settings plus this print's layouts; only used to draw documents, never saved. */
  const renderSettings = useMemo(() => ({ ...printSettings, layouts }), [printSettings, layouts]);
  const pdfExporter = usePdfExport({ bill, rates, firm, printSettings: renderSettings, exportErrors, selectedDocuments, runningAccount });
  /** Print first shows what will print; "Print now" in that preview opens the browser print dialog. */
  const exporter = {
    ...pdfExporter,
    print: () => {
      if (!pdfExporter.canExport) pdfExporter.print();
      else setPreviewingPrint(true);
    }
  };
  function printNow() {
    setPreviewingPrint(false);
    setTimeout(() => pdfExporter.print(), 300); // let the preview close so it is not in the way of the print
  }

  return (
    <section className="print-page">
      <PrintPageStyle settings={printSettings} />

      <div className="no-print"><BillPicker bills={data.bills} value={bill} onChange={setPickedId} /></div>

      <Paper variant="outlined" className="no-print" sx={{ mb: 2 }}>
        <Tabs value={tab} onChange={(_event, value) => setTab(value)} variant="fullWidth" aria-label={t('PDF and print')}>
          <Tab value={TABS.preview} label={t('Preview')} icon={<VisibilityIcon fontSize="small" />} iconPosition="start" sx={{ minHeight: 52 }} />
          <Tab value={TABS.settings} label={t('Settings')} icon={<TuneIcon fontSize="small" />} iconPosition="start" sx={{ minHeight: 52 }} />
        </Tabs>
      </Paper>

      {tab === TABS.preview && (
        <Stack className="no-print" direction="row" useFlexGap sx={{ flexWrap: 'wrap', gap: 1, mb: 1.5, alignItems: 'center' }} role="group" aria-label={t('Documents to print')}>
          {PRINT_DOCUMENTS.map(({ id, label }) => (
            <Chip
              key={id}
              label={t(label)}
              color={printSettings.documents[id] ? 'primary' : 'default'}
              variant={printSettings.documents[id] ? 'filled' : 'outlined'}
              onClick={() => print.toggleDocument(id)}
              aria-pressed={Boolean(printSettings.documents[id])}
            />
          ))}
        </Stack>
      )}

      {tab === TABS.preview && (
        <div className="no-print">
          {selectedDocuments.length ? (
            <PreviewTab
              bill={bill}
              firm={firm}
              rates={rates}
              printSettings={renderSettings}
              onLayoutChange={(documentType, layout) => (documentType === 'summary' ? print.update({ summaryDetail: layout === 'floor' ? 'section' : 'area' }) : setLayouts((current) => ({ ...current, [documentType]: layout })))}
              selectedDocuments={selectedDocuments}
              previewDocument={previewDocument}
              exportErrors={exportErrors}
              exporter={exporter}
              onPreviewChange={(value) => print.update({ previewDocument: value })}
              onBillLanguageChange={(billLanguage) => print.update({ billLanguage })}
              onSignatureLayoutChange={firmOnly(print.setSignatureLayout)}
              runningAccount={runningAccount}
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
            onWidthChange={firmOnly(print.setSignatureWidth)}
            onResetPlacement={firmOnly(print.resetSignatureLayout)}
          />
          <Button fullWidth variant="contained" startIcon={<VisibilityIcon />} onClick={() => setTab(TABS.preview)}>
            {t('Back to preview')}
          </Button>
        </div>
      )}

      <PrintPreviewDialog
        open={previewingPrint}
        onClose={() => setPreviewingPrint(false)}
        onPrint={printNow}
        bill={bill}
        firm={firm}
        rates={rates}
        printSettings={renderSettings}
        selectedDocuments={selectedDocuments}
        runningAccount={runningAccount}
      />

      {/* Every selected document, rendered only for browser printing. */}
      <div className="print-batch">
        {selectedDocuments.map((documentType, index) => (
          <DocumentPreview
            key={documentType}
            bill={bill}
            firm={firm}
            rates={rates}
            printSettings={renderSettings}
            documentType={documentType}
            signatureVisible={isSignatureVisible(printSettings, index, selectedDocuments.length)}
            runningAccount={runningAccount}
          />
        ))}
      </div>
    </section>
  );
}

import { useMemo, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import DownloadIcon from '@mui/icons-material/Download';
import PrintIcon from '@mui/icons-material/Print';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import { EmptyState, useNotify } from '../../components/ui';
import { useLabour } from './useLabour.js';
import { monthLabel, monthReport } from '../../domain/labour.js';
import { formatCurrency } from '../../domain/formatters.js';
import { canSharePdfFiles, isShareCancelled } from '../../services/files.js';
import { getLanguage, makeTranslator, tr as t } from '../../i18n/translate.js';
import FitToWidth from '../print/preview/FitToWidth.jsx';
import LabourReportDocument from './LabourReportDocument.jsx';
import MonthBar from './MonthBar.jsx';

const LANDSCAPE_WIDTH_PX = 1123; // A4 landscape at 96 dpi

/** Attendance sheet with the firm header: preview, PDF, print and WhatsApp. */
export default function SheetTab({ month, onMonthChange }) {
  const { labour, firm } = useLabour();
  const notify = useNotify();
  const previewRef = useRef(null);
  const [busy, setBusy] = useState(false);
  const language = getLanguage();
  const docT = makeTranslator(language);
  const report = useMemo(() => monthReport(labour, month), [labour, month]);

  async function exportPdf(shareText) {
    setBusy(true);
    try {
      const { exportLabourPdf } = await import('../../documents/labour-pdf.js');
      await exportLabourPdf({ report, firm, language, rendered: previewRef.current?.querySelector('.labour-document'), shareText });
      if (!shareText) notify(t('PDF ready to save or share.'));
    } catch (error) {
      if (!isShareCancelled(error)) notify(t('PDF export failed: {reason}', { reason: error.message || t('Unknown error') }), 'error');
    } finally {
      setBusy(false);
    }
  }

  function shareOnWhatsApp() {
    const message = [
      `${docT('Labour attendance register')} · ${monthLabel(month, language)}`,
      docT('Wages: {amount}', { amount: formatCurrency(report.totals.earned) }),
      firm.name && `— ${firm.name}`
    ].filter(Boolean).join('\n');
    if (canSharePdfFiles()) notify(t('Choose WhatsApp in the share menu.'), 'info');
    exportPdf(message);
  }

  return (
    <>
      <MonthBar month={month} onChange={onMonthChange} />
      {!report.rows.length ? (
        <EmptyState title={t('Nothing this month')} description={t('Mark attendance to see wages here.')} compact />
      ) : (
        <>
          <Stack direction="row" spacing={1} sx={{ mb: 2 }} className="no-print">
            <Button fullWidth variant="outlined" startIcon={<DownloadIcon />} onClick={() => exportPdf()} disabled={busy}>PDF</Button>
            <Button fullWidth variant="outlined" startIcon={<PrintIcon />} onClick={() => window.print()} disabled={busy}>{t('Print')}</Button>
            <Button
              fullWidth
              variant="contained"
              startIcon={<WhatsAppIcon />}
              onClick={shareOnWhatsApp}
              disabled={busy}
              sx={{ bgcolor: '#25D366', color: '#0b3d1f', '&:hover': { bgcolor: '#1ebe5a' } }}
            >
              WhatsApp
            </Button>
          </Stack>
          <Typography variant="caption" color="text.secondary" component="p" sx={{ mb: 1 }} className="no-print">
            {t('Landscape A4. Pinch or turn your phone to read the preview.')}
          </Typography>
          <Box ref={previewRef} className="no-print" sx={{ border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden', bgcolor: '#fff' }}>
            <FitToWidth contentWidth={LANDSCAPE_WIDTH_PX}>
              <LabourReportDocument report={report} firm={firm} t={docT} language={language} />
            </FitToWidth>
          </Box>

          {/* Copy used only for browser printing. */}
          <style>{'@media print{@page{size:A4 landscape;margin:8mm}}'}</style>
          <div className="print-batch">
            <LabourReportDocument report={report} firm={firm} t={docT} language={language} />
          </div>
        </>
      )}
    </>
  );
}

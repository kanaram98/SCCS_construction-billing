import { useMemo, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Collapse from '@mui/material/Collapse';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import DeleteIcon from '@mui/icons-material/DeleteOutlined';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdfOutlined';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import { EmptyState, StatCard, useNotify } from '../../components/ui';
import { useBilling } from '../../state/BillingContext.jsx';
import { useUndoable } from '../../hooks/useUndoable.js';
import { daysOfMonth, monthReport, registerCell, workerBalance, workerMonthMessage } from '../../domain/labour.js';
import { formatCurrency } from '../../domain/formatters.js';
import { whatsappNumber, whatsappUrl } from '../../domain/whatsapp.js';
import { isShareCancelled } from '../../services/files.js';
import { getLanguage, makeTranslator, tr as t } from '../../i18n/translate.js';
import LabourPaymentDialog from './LabourPaymentDialog.jsx';
import LabourReportDocument from './LabourReportDocument.jsx';
import MonthBar from './MonthBar.jsx';

/** Small attendance calendar for one worker's month. */
function MonthGrid({ month, marks }) {
  const days = daysOfMonth(month);
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 0.5, my: 1 }}>
      {days.map((date, index) => {
        const cell = registerCell(marks[index]);
        return (
          <Box
            key={date}
            sx={{
              border: 1, borderColor: 'divider', borderRadius: 1, textAlign: 'center', py: 0.25,
              bgcolor: cell === 'A' ? 'error.light' : cell ? 'success.light' : 'transparent',
              color: cell ? 'common.black' : 'text.secondary'
            }}
          >
            <Typography variant="caption" component="div" sx={{ lineHeight: 1.2, opacity: 0.7 }}>{index + 1}</Typography>
            <Typography variant="caption" component="div" sx={{ fontWeight: 700, lineHeight: 1.2, minHeight: '1.2em' }}>{cell}</Typography>
          </Box>
        );
      })}
    </Box>
  );
}

function Amount({ label, value, strong, color }) {
  return (
    <Box>
      <Typography variant="caption" color="text.secondary" component="div">{label}</Typography>
      <Typography variant="body2" sx={{ fontWeight: strong ? 700 : 500 }} color={color}>{value}</Typography>
    </Box>
  );
}

function WorkerCard({ row, onPay, onShare, onDeletePayment }) {
  const [open, setOpen] = useState(false);
  const { worker } = row;
  return (
    <Card sx={{ mb: 1.5 }}>
      <CardContent sx={{ pb: 1, '&:last-child': { pb: 1 } }}>
        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center' }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle1" noWrap>{worker.name}</Typography>
            <Typography variant="caption" color="text.secondary">
              {t('{units} · {days} days · {absent} absent', { units: `${row.units}P`, days: row.days, absent: row.absent })}
            </Typography>
          </Box>
          <IconButton aria-label={t('Details for {name}', { name: worker.name })} onClick={() => setOpen((value) => !value)} sx={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}>
            <ExpandMoreIcon />
          </IconButton>
        </Stack>
        <Grid container spacing={1} sx={{ mt: 0.5 }}>
          <Grid size={3}><Amount label={t('Wages')} value={formatCurrency(row.earned)} /></Grid>
          <Grid size={3}><Amount label={t('Previous')} value={formatCurrency(row.opening)} /></Grid>
          <Grid size={3}><Amount label={t('Amount paid')} value={formatCurrency(row.paid)} /></Grid>
          <Grid size={3}><Amount label={t('Balance')} value={formatCurrency(row.balance)} strong color={row.balance < 0 ? 'warning.main' : 'primary'} /></Grid>
        </Grid>
        <Collapse in={open} unmountOnExit>
          <MonthGrid month={row.month} marks={row.marks} />
          {row.payments.length > 0 && (
            <>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>{t('Payments this month')}</Typography>
              {row.payments.map((payment) => (
                <Stack key={payment.id} direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
                  <Typography variant="body2">{payment.date} · {formatCurrency(payment.amount)}{payment.note ? ` · ${payment.note}` : ''}</Typography>
                  <IconButton size="small" aria-label={t('Delete payment')} onClick={() => onDeletePayment(payment)}><DeleteIcon fontSize="small" /></IconButton>
                </Stack>
              ))}
            </>
          )}
        </Collapse>
        <Stack direction="row" spacing={1} sx={{ mt: 1, justifyContent: 'flex-end' }}>
          <Button size="small" startIcon={<WhatsAppIcon />} onClick={onShare}>{t('Share')}</Button>
          <Button size="small" variant="outlined" onClick={onPay}>{t('Pay / advance')}</Button>
        </Stack>
      </CardContent>
    </Card>
  );
}

/** Month summary for every worker: attendance, wages, payments and balance. */
export default function ReportTab({ month, onMonthChange }) {
  const { data, actions } = useBilling();
  const notify = useNotify();
  const undoable = useUndoable();
  const documentRef = useRef(null);
  const [paying, setPaying] = useState(null);
  const [exporting, setExporting] = useState(false);
  const { labour, firm } = data;
  const language = getLanguage();
  const report = useMemo(() => monthReport(labour, month), [labour, month]);

  function share(row) {
    const message = workerMonthMessage({ worker: row.worker, summary: row, firm, t: makeTranslator(language), language });
    window.open(whatsappUrl(row.worker.phone, message), '_blank', 'noopener');
    if (!whatsappNumber(row.worker.phone)) notify(t('Add the worker’s mobile number to open their chat directly.'), 'info');
  }

  async function exportPdf() {
    setExporting(true);
    try {
      const { exportLabourPdf } = await import('../../documents/labour-pdf.js');
      await exportLabourPdf({ report, firm, language, rendered: documentRef.current?.querySelector('.labour-document') });
    } catch (error) {
      if (!isShareCancelled(error)) notify(t('PDF export failed: {reason}', { reason: error.message || t('Unknown error') }), 'error');
    } finally {
      setExporting(false);
    }
  }

  return (
    <>
      <MonthBar month={month} onChange={onMonthChange} />
      {!report.rows.length ? (
        <EmptyState title={t('Nothing this month')} description={t('Mark attendance to see wages here.')} compact />
      ) : (
        <>
          <Grid container spacing={1.5} sx={{ mb: 2 }}>
            <Grid size={4}><StatCard label={t('Wages')} value={formatCurrency(report.totals.earned)} /></Grid>
            <Grid size={4}><StatCard label={t('Amount paid')} value={formatCurrency(report.totals.paid)} /></Grid>
            <Grid size={4}><StatCard label={t('Balance')} value={formatCurrency(report.totals.balance)} /></Grid>
          </Grid>
          <Button fullWidth variant="contained" startIcon={<PictureAsPdfIcon />} onClick={exportPdf} disabled={exporting} sx={{ mb: 2 }}>
            {exporting ? t('Preparing PDF…') : t('Attendance register PDF')}
          </Button>
          {report.rows.map((row) => (
            <WorkerCard
              key={row.workerId}
              row={row}
              onPay={() => setPaying(row)}
              onShare={() => share(row)}
              onDeletePayment={(payment) => undoable(t('Payment deleted.'), () => actions.labour.removePayment(payment.id))}
            />
          ))}
          <Box ref={documentRef} sx={{ display: 'none' }} aria-hidden>
            <LabourReportDocument report={report} firm={firm} t={makeTranslator(language)} language={language} />
          </Box>
        </>
      )}
      <LabourPaymentDialog
        open={Boolean(paying)}
        worker={paying?.worker}
        balance={paying ? workerBalance(labour, paying.workerId) : 0}
        onSave={(values) => {
          actions.labour.addPayment({ ...values, workerId: paying.workerId });
          notify(t('Payment saved.'), 'success');
          setPaying(null);
        }}
        onClose={() => setPaying(null)}
      />
    </>
  );
}

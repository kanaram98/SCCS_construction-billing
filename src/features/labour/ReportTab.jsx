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
import DownloadIcon from '@mui/icons-material/Download';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdfOutlined';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import { EmptyState, StatCard, useNotify } from '../../components/ui';
import { useBilling } from '../../state/BillingContext.jsx';
import { useUndoable } from '../../hooks/useUndoable.js';
import { daysOfMonth, formatUnits, monthReport, registerCell, workerBalance, workerMonthMessage } from '../../domain/labour.js';
import { formatCurrency } from '../../domain/formatters.js';
import { PAYMENT_MODES } from '../../domain/payments.js';
import { whatsappNumber, whatsappUrl } from '../../domain/whatsapp.js';
import { canSharePdfFiles, isShareCancelled } from '../../services/files.js';
import { getLanguage, makeTranslator, tr as t } from '../../i18n/translate.js';
import LabourPaymentDialog from './LabourPaymentDialog.jsx';
import MarkCounts from './MarkCounts.jsx';
import MonthBar from './MonthBar.jsx';
import WorkerSheetDocument from './WorkerSheetDocument.jsx';

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
              bgcolor: cell === 'A' ? 'error.main' : cell ? 'success.light' : 'transparent',
              color: cell === 'A' ? 'error.contrastText' : cell ? 'common.black' : 'text.secondary'
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

/** Advances / payments in the month with date, mode and description. Tap one to edit it. */
function PaymentList({ payments, onEdit, onDelete }) {
  if (!payments.length) return null;
  return (
    <Box sx={{ mt: 1.5, p: 1, borderRadius: 1, bgcolor: 'action.hover' }}>
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>{t('Advances and payments')}</Typography>
      {payments.map((payment) => (
        <Stack key={payment.id} direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
          <Box
            component="button"
            type="button"
            onClick={() => onEdit(payment)}
            aria-label={t('Edit payment of {amount} on {date}', { amount: formatCurrency(payment.amount), date: payment.date })}
            sx={{ all: 'unset', cursor: 'pointer', flex: 1, minWidth: 0, py: 0.5 }}
          >
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {formatCurrency(payment.amount)} · {t(PAYMENT_MODES[payment.mode] || 'Cash')}
            </Typography>
            <Typography variant="caption" color="text.secondary" component="div" noWrap>
              {payment.date}{payment.note ? ` · ${payment.note}` : ''}
            </Typography>
          </Box>
          <IconButton size="small" aria-label={t('Delete payment')} onClick={() => onDelete(payment)}><DeleteIcon fontSize="small" /></IconButton>
        </Stack>
      ))}
    </Box>
  );
}

function WorkerCard({ row, busy, onPay, onPdf, onShare, onEditPayment, onDeletePayment }) {
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
        <MarkCounts counts={row.counts} sx={{ mt: 1 }} />
        <Grid container spacing={1} sx={{ mt: 0.5 }}>
          <Grid size={3}><Amount label={t('Wages')} value={formatCurrency(row.earned)} /></Grid>
          <Grid size={3}><Amount label={t('Previous')} value={formatCurrency(row.opening)} /></Grid>
          <Grid size={3}><Amount label={t('Amount paid')} value={formatCurrency(row.paid)} /></Grid>
          <Grid size={3}><Amount label={t('Balance')} value={formatCurrency(row.balance)} strong color={row.balance < 0 ? 'warning.main' : 'primary'} /></Grid>
        </Grid>
        <Collapse in={open} unmountOnExit>
          <MonthGrid month={row.month} marks={row.marks} />
        </Collapse>
        <PaymentList payments={row.payments} onEdit={onEditPayment} onDelete={onDeletePayment} />
        <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
          <Button fullWidth size="small" variant="outlined" startIcon={<DownloadIcon />} onClick={onPdf} disabled={busy} aria-label={t('PDF for {name}', { name: worker.name })}>PDF</Button>
          <Button
            fullWidth
            size="small"
            variant="contained"
            startIcon={<WhatsAppIcon />}
            onClick={onShare}
            disabled={busy}
            aria-label={t('Share with {name}', { name: worker.name })}
            sx={{ bgcolor: '#25D366', color: '#0b3d1f', '&:hover': { bgcolor: '#1ebe5a' } }}
          >
            {t('Share')}
          </Button>
          <Button fullWidth size="small" variant="outlined" onClick={onPay} aria-label={t('Pay {name}', { name: worker.name })}>{t('Pay')}</Button>
        </Stack>
      </CardContent>
    </Card>
  );
}

/** Month summary for every worker: attendance, wages, payments and balance, with a PDF for each worker. */
export default function ReportTab({ month, onMonthChange, onOpenSheet }) {
  const { data, actions } = useBilling();
  const notify = useNotify();
  const undoable = useUndoable();
  const sheetsRef = useRef(null);
  const [paying, setPaying] = useState(null); // { row, payment? }
  const [busyId, setBusyId] = useState('');
  const { labour, firm } = data;
  const language = getLanguage();
  const docT = makeTranslator(language);
  const report = useMemo(() => monthReport(labour, month), [labour, month]);

  async function exportPdf(row, shareText) {
    setBusyId(row.workerId);
    try {
      const { exportWorkerPdf } = await import('../../documents/labour-pdf.js');
      const rendered = sheetsRef.current?.querySelector(`[data-worker="${row.workerId}"]`);
      await exportWorkerPdf({ row, firm, language, rendered, shareText });
    } catch (error) {
      if (!isShareCancelled(error)) notify(t('PDF export failed: {reason}', { reason: error.message || t('Unknown error') }), 'error');
    } finally {
      setBusyId('');
    }
  }

  /** Phones: share the worker's PDF (pick WhatsApp, then the worker). Elsewhere: open their chat and download the PDF to attach. */
  function share(row) {
    const message = workerMonthMessage({ worker: row.worker, summary: row, firm, t: docT, language });
    if (canSharePdfFiles()) {
      notify(t('Choose WhatsApp in the share menu, then {name}.', { name: row.worker.name }), 'info');
      exportPdf(row, message);
      return;
    }
    window.open(whatsappUrl(row.worker.phone, message), '_blank', 'noopener');
    exportPdf(row);
    notify(whatsappNumber(row.worker.phone)
      ? t('PDF downloaded. Attach it in the WhatsApp chat.')
      : t('Add the worker’s mobile number to open their chat directly.'), 'info');
  }

  function savePayment(values) {
    if (paying.payment) {
      actions.labour.updatePayment(paying.payment.id, values);
    } else {
      actions.labour.addPayment({ ...values, workerId: paying.row.workerId });
    }
    notify(t('Payment saved.'), 'success');
    setPaying(null);
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
          <Card sx={{ mb: 2 }}>
            <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
              <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
                <Typography variant="subtitle2">{t('Attendance count')}</Typography>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>{t('Total {units}', { units: formatUnits(report.totals.units) })}</Typography>
              </Stack>
              <MarkCounts counts={report.totals.counts} showZero />
              <Button size="small" startIcon={<PictureAsPdfIcon />} onClick={onOpenSheet} sx={{ mt: 1 }}>{t('All workers sheet / PDF')}</Button>
            </CardContent>
          </Card>
          {report.rows.map((row) => (
            <WorkerCard
              key={row.workerId}
              row={row}
              busy={busyId === row.workerId}
              onPay={() => setPaying({ row })}
              onPdf={() => exportPdf(row)}
              onShare={() => share(row)}
              onEditPayment={(payment) => setPaying({ row, payment })}
              onDeletePayment={(payment) => undoable(t('Payment deleted.'), () => actions.labour.removePayment(payment.id))}
            />
          ))}
          {/* Rendered worker sheets, used to make Hindi PDFs. */}
          <Box ref={sheetsRef} sx={{ display: 'none' }} aria-hidden>
            {report.rows.map((row) => <WorkerSheetDocument key={row.workerId} row={row} firm={firm} t={docT} language={language} />)}
          </Box>
        </>
      )}
      <LabourPaymentDialog
        open={Boolean(paying)}
        worker={paying?.row.worker}
        payment={paying?.payment}
        balance={paying ? workerBalance(labour, paying.row.workerId) : 0}
        onSave={savePayment}
        onClose={() => setPaying(null)}
      />
    </>
  );
}

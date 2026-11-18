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
import HistoryIcon from '@mui/icons-material/History';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdfOutlined';
import CurrencyRupeeIcon from '@mui/icons-material/CurrencyRupee';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import SearchIcon from '@mui/icons-material/Search';
import Chip from '@mui/material/Chip';
import InputAdornment from '@mui/material/InputAdornment';
import OutlinedInput from '@mui/material/OutlinedInput';
import PdfLanguageToggle from './PdfLanguageToggle.jsx';
import { EmptyState, StatCard, useConfirm, useNotify } from '../../components/ui';
import { daysOfMonth, formatUnits, monthReport, registerCell, workerBalance, workerMonthMessage } from '../../domain/labour.js';
import { formatCurrency } from '../../domain/formatters.js';
import { PAYMENT_MODES } from '../../domain/payments.js';
import { whatsappNumber, whatsappUrl } from '../../domain/whatsapp.js';
import { canSharePdfFiles, isShareCancelled } from '../../services/files.js';
import { makeTranslator, tr as t } from '../../i18n/translate.js';
import LabourPaymentDialog from './LabourPaymentDialog.jsx';
import MarkCounts from './MarkCounts.jsx';
import MonthBar from './MonthBar.jsx';
import ClosedMonthNotice from './ClosedMonthNotice.jsx';
import { useLabour, useMonthLock, usePdfLanguage } from './useLabour.js';
import { useCloud } from '../account/CloudProvider.jsx';
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

/** "₹2,000 → ₹1,500", "Cash → UPI" … for a payment edit. */
function paymentChangeLines(payment, values) {
  const lines = [];
  if (Number(payment.amount) !== Number(values.amount)) lines.push(`${formatCurrency(payment.amount)} → ${formatCurrency(values.amount)}`);
  if (payment.date !== values.date) lines.push(`${payment.date} → ${values.date}`);
  if (payment.mode !== values.mode) lines.push(`${t(PAYMENT_MODES[payment.mode] || 'Cash')} → ${t(PAYMENT_MODES[values.mode] || 'Cash')}`);
  if ((payment.note || '') !== (values.note || '')) lines.push(`“${payment.note || '—'}” → “${values.note || '—'}”`);
  return lines;
}

/** Advances / payments in the month with date, mode and description. Tap one to edit it. */
function PaymentList({ payments, locked, onEdit, onDelete }) {
  if (!payments.length) return null;
  return (
    <Box sx={{ mt: 1.5, p: 1, borderRadius: 1, bgcolor: 'action.hover' }}>
      <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>{t('Advances and payments')}</Typography>
      {payments.map((payment) => (
        <Stack key={payment.id} direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
          <Box
            component="button"
            type="button"
            onClick={() => !locked && onEdit(payment)}
            disabled={locked}
            aria-label={t('Edit payment of {amount} on {date}', { amount: formatCurrency(payment.amount), date: payment.date })}
            sx={{ all: 'unset', cursor: locked ? 'default' : 'pointer', flex: 1, minWidth: 0, py: 0.5 }}
          >
            <Typography variant="body2" sx={{ fontWeight: 600 }}>
              {formatCurrency(payment.amount)} · {t(PAYMENT_MODES[payment.mode] || 'Cash')}
            </Typography>
            <Typography variant="caption" color="text.secondary" component="div" noWrap>
              {payment.date}{payment.note ? ` · ${payment.note}` : ''}
            </Typography>
          </Box>
          {!locked && <IconButton size="small" aria-label={t('Delete payment')} onClick={() => onDelete(payment)}><DeleteIcon fontSize="small" /></IconButton>}
        </Stack>
      ))}
    </Box>
  );
}

/** One worker: a compact row (name, balance, PDF / share / pay) that opens to the full details. */
function WorkerRow({ row, first, open, busy, locked, onToggle, onPay, onPdf, onShare, onHistory, onEditPayment, onDeletePayment }) {
  const { worker } = row;
  return (
    <Box sx={{ borderTop: first ? 0 : 1, borderColor: 'divider', px: 1.25, py: 0.75 }}>
      <Stack direction="row" spacing={0.25} sx={{ alignItems: 'center' }}>
        <Box
          component="button"
          type="button"
          onClick={onToggle}
          aria-expanded={open}
          aria-label={t('Details for {name}', { name: worker.name })}
          sx={{ all: 'unset', cursor: 'pointer', flex: 1, minWidth: 0, py: 0.5 }}
        >
          <Typography variant="subtitle2" noWrap>{worker.name}</Typography>
          <Typography variant="caption" color="text.secondary" component="div" noWrap>
            {t('{units} · {days} days · {absent} absent', { units: `${row.units}P`, days: row.days, absent: row.absent })}
          </Typography>
        </Box>
        <Box sx={{ textAlign: 'right', mr: 0.5 }}>
          <Typography variant="caption" color="text.secondary" component="div">{t('Balance')}</Typography>
          <Typography variant="body2" sx={{ fontWeight: 700 }} color={row.balance < 0 ? 'warning.main' : row.balance > 0 ? 'primary' : 'text.secondary'}>{formatCurrency(row.balance)}</Typography>
        </Box>
        <IconButton size="small" onClick={onPdf} disabled={busy} aria-label={t('PDF for {name}', { name: worker.name })}><DownloadIcon fontSize="small" /></IconButton>
        <IconButton size="small" onClick={onShare} disabled={busy} aria-label={t('Share with {name}', { name: worker.name })} sx={{ color: '#1ebe5a' }}><WhatsAppIcon fontSize="small" /></IconButton>
        <IconButton size="small" onClick={onPay} aria-label={t('Pay {name}', { name: worker.name })} color="primary"><CurrencyRupeeIcon fontSize="small" /></IconButton>
        <IconButton size="small" onClick={onToggle} aria-label={open ? t('Hide details') : t('Show details')} sx={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }}><ExpandMoreIcon fontSize="small" /></IconButton>
      </Stack>
      <Collapse in={open} unmountOnExit>
        <Box sx={{ pb: 1 }}>
          <MarkCounts counts={row.counts} sx={{ mt: 0.5 }} />
          <Grid container spacing={1} sx={{ mt: 0.5 }}>
            <Grid size={3}><Amount label={t('Wages')} value={formatCurrency(row.earned)} /></Grid>
            <Grid size={3}><Amount label={t('Previous')} value={formatCurrency(row.opening)} /></Grid>
            <Grid size={3}><Amount label={t('Amount paid')} value={formatCurrency(row.paid)} /></Grid>
            <Grid size={3}><Amount label={t('Balance')} value={formatCurrency(row.balance)} strong color={row.balance < 0 ? 'warning.main' : 'primary'} /></Grid>
          </Grid>
          <MonthGrid month={row.month} marks={row.marks} />
          <Button size="small" startIcon={<HistoryIcon />} onClick={onHistory}>{t('History of changes')}</Button>
          <PaymentList payments={row.payments} locked={locked} onEdit={onEditPayment} onDelete={onDeletePayment} />
        </Box>
      </Collapse>
    </Box>
  );
}

/** Month summary for every worker: attendance, wages, payments and balance, with a PDF for each worker. */
export default function ReportTab({ month, onMonthChange, onOpenSheet, onOpenHistory }) {
  const { labour, firm, actions } = useLabour();
  const notify = useNotify();
  const confirm = useConfirm();
  const closed = useMonthLock().isClosed(month);
  const canEditPayments = useCloud().can('editPayment');
  const sheetsRef = useRef(null);
  const [paying, setPaying] = useState(null); // { row, payment? }
  const [busyId, setBusyId] = useState('');
  const [language, setPdfLanguage] = usePdfLanguage();
  const docT = makeTranslator(language);
  const [query, setQuery] = useState('');
  const [dueOnly, setDueOnly] = useState(false);
  const [openId, setOpenId] = useState('');
  const report = useMemo(() => monthReport(labour, month), [labour, month]);
  const shown = useMemo(() => {
    const text = query.trim().toLowerCase();
    return report.rows.filter((row) => (!text || row.worker.name.toLowerCase().includes(text)) && (!dueOnly || row.balance > 0));
  }, [report.rows, query, dueOnly]);

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

  async function savePayment(values) {
    const { row, payment } = paying;
    if (payment) {
      const changes = paymentChangeLines(payment, values);
      if (!changes.length) { setPaying(null); return; }
      const ok = await confirm({
        title: t('Change this payment?'),
        message: `${row.worker.name}: ${changes.join(', ')}. ${t('The old values stay in History.')}`,
        confirmLabel: t('Change')
      });
      if (!ok) return;
      actions.updatePayment(payment.id, values);
    } else {
      actions.addPayment({ ...values, workerId: row.workerId });
    }
    notify(t('Payment saved.'), 'success');
    setPaying(null);
  }

  async function deletePayment(row, payment) {
    const ok = await confirm({
      title: t('Delete this payment?'),
      message: `${row.worker.name}: ${formatCurrency(payment.amount)} · ${t(PAYMENT_MODES[payment.mode] || 'Cash')} · ${payment.date}. ${t('It moves to Recently deleted and can be restored for 30 days.')}`,
      confirmLabel: t('Delete'),
      danger: true
    });
    if (!ok) return;
    actions.deletePayment(payment.id);
    notify(t('Payment deleted.'), 'info', { label: t('Undo'), onClick: () => actions.restorePayment(payment.id) });
  }

  return (
    <>
      <MonthBar month={month} onChange={onMonthChange} />
      <ClosedMonthNotice month={month} />
      {!report.rows.length ? (
        <EmptyState title={t('Nothing this month')} description={t('Mark attendance to see wages here.')} compact />
      ) : (
        <>
          <Grid container spacing={1.5} sx={{ mb: 2 }}>
            <Grid size={4}><StatCard label={t('Wages')} value={formatCurrency(report.totals.earned)} /></Grid>
            <Grid size={4}><StatCard label={t('Amount paid')} value={formatCurrency(report.totals.paid)} /></Grid>
            <Grid size={4}><StatCard label={t('Balance')} value={formatCurrency(report.totals.balance)} /></Grid>
          </Grid>
          <Card sx={{ mb: 1.5 }}>
            <CardContent sx={{ py: 1.25, '&:last-child': { pb: 1.25 } }}>
              <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 0.75 }}>
                <Typography variant="subtitle2">{t('Attendance count')}</Typography>
                <Typography variant="body2" sx={{ fontWeight: 700 }}>{t('Total {units}', { units: formatUnits(report.totals.units) })}</Typography>
              </Stack>
              <MarkCounts counts={report.totals.counts} showZero />
            </CardContent>
          </Card>

          <Stack direction="row" sx={{ mb: 1.5, justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
            <PdfLanguageToggle value={language} onChange={setPdfLanguage} />
            <Button size="small" startIcon={<PictureAsPdfIcon />} onClick={onOpenSheet}>{t('All workers sheet / PDF')}</Button>
          </Stack>

          {report.rows.length > 6 && (
            <Stack direction="row" spacing={1} sx={{ mb: 1.5, alignItems: 'center' }}>
              <OutlinedInput
                size="small"
                fullWidth
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder={t('Search workers')}
                inputProps={{ 'aria-label': t('Search workers') }}
                startAdornment={<InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment>}
              />
              <Chip label={t('Balance due')} color={dueOnly ? 'primary' : 'default'} variant={dueOnly ? 'filled' : 'outlined'} onClick={() => setDueOnly((value) => !value)} sx={{ flexShrink: 0 }} />
            </Stack>
          )}

          {!shown.length ? (
            <EmptyState title={t('No matching workers')} compact />
          ) : (
            <Card sx={{ mb: 2 }}>
              {shown.map((row, index) => (
                <WorkerRow
                  key={row.workerId}
                  row={row}
                  first={index === 0}
                  open={openId === row.workerId}
                  busy={busyId === row.workerId}
                  locked={closed || !canEditPayments}
                  onToggle={() => setOpenId((current) => (current === row.workerId ? '' : row.workerId))}
                  onHistory={() => onOpenHistory(row.workerId)}
                  onPay={() => setPaying({ row })}
                  onPdf={() => exportPdf(row)}
                  onShare={() => share(row)}
                  onEditPayment={(payment) => setPaying({ row, payment })}
                  onDeletePayment={(payment) => deletePayment(row, payment)}
                />
              ))}
            </Card>
          )}
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

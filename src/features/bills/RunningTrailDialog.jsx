import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import LinearProgress from '@mui/material/LinearProgress';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { ResponsiveDialog } from '../../components/ui';
import { billLabel, getRunningAccount, getSeries, nextRunningBlocker } from '../../domain/bill-kinds.js';
import { billStatus } from '../../domain/bill-guard.js';
import { getBillTotals } from '../../domain/calculations.js';
import { formatCurrency } from '../../domain/formatters.js';
import { stageLabel } from './stageText.js';
import { tr as t } from '../../i18n/translate.js';

const STAGE_COLOR = { draft: 'grey.500', ready: 'warning.main', submitted: 'success.main' };

/** What happens to the unpaid part of a bill as the series moves on, as a short line under the bill. */
function handoverNote(entry, totals) {
  if (entry.cancelled) return t('Cancelled: not counted');
  const kind = entry.settlement?.kind;
  if (kind === 'discount') return t('{amount} discount allowed. Nothing carried forward.', { amount: formatCurrency(totals.writtenOff) });
  if (kind === 'carry') return t('{amount} carried into the next bill.', { amount: formatCurrency(totals.balance) });
  if (kind === 'due') return t('{amount} still due on this bill (not added to the next one).', { amount: formatCurrency(totals.balance) });
  const status = billStatus(entry);
  if (status === 'draft') return t('Being worked on. Nothing to pay yet.');
  if (totals.balance > 0.5) return status === 'ready' ? t('{amount} not paid yet.', { amount: formatCurrency(totals.balance) }) : t('{amount} unpaid.', { amount: formatCurrency(totals.balance) });
  return t('Fully paid.');
}

/**
 * The running bills of one piece of work as a flow: each bill in order with its stage, amount, how much
 * was received and what happened to the rest, joined by a line down to the next, and a dashed "next" step
 * at the end. Tap a bill to open it.
 */
export default function RunningTrailDialog({ open, bill, bills, rates, onOpen, onStartNext, onClose }) {
  const live = bill ? bills.filter((entry) => !entry.deletedAt) : [];
  const series = bill ? getSeries(live, bill) : [];
  const latest = series[series.length - 1];
  const account = latest ? getRunningAccount(live, latest, rates) : null;
  const canNext = latest && !nextRunningBlocker(live, latest);
  return (
    <ResponsiveDialog open={open} title={bill?.name ? t('{name}: running bills', { name: bill.name }) : t('Running bills of this work')} onClose={onClose} maxWidth="sm">
      {bill && (
        <>
          <Box>
            {series.map((entry, index) => {
              const totals = getBillTotals(entry, rates);
              const status = billStatus(entry);
              const color = entry.cancelled ? 'error.main' : STAGE_COLOR[status];
              const share = totals.total > 0 ? Math.min(100, Math.round(((totals.paid + totals.writtenOff) / totals.total) * 100)) : 0;
              const last = index === series.length - 1;
              return (
                <Box key={entry.id} sx={{ display: 'flex', gap: 1.25 }}>
                  <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 20, flexShrink: 0 }}>
                    <Box sx={{ width: 16, height: 16, borderRadius: '50%', bgcolor: color, border: 3, borderColor: entry.id === bill.id ? 'primary.main' : 'background.paper', boxShadow: 1, mt: 1.25 }} />
                    <Box sx={{ flex: 1, width: 3, bgcolor: last && !canNext ? 'transparent' : 'divider', my: 0.25 }} />
                  </Box>
                  <Box
                    component="button"
                    type="button"
                    onClick={() => onOpen(entry)}
                    sx={{ flex: 1, minWidth: 0, textAlign: 'left', cursor: 'pointer', font: 'inherit', color: 'inherit', bgcolor: entry.id === bill.id ? 'action.selected' : 'background.paper', border: 1, borderColor: 'divider', borderRadius: 2, p: 1.25, mb: 1 }}
                  >
                    <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', gap: 1, flexWrap: 'wrap' }}>
                      <Typography variant="subtitle2">{billLabel(entry, t)}</Typography>
                      <Chip size="small" color={entry.cancelled ? 'error' : status === 'submitted' ? 'success' : status === 'ready' ? 'warning' : 'default'} variant={status === 'draft' && !entry.cancelled ? 'outlined' : 'filled'} label={t(stageLabel(entry))} />
                    </Stack>
                    <Typography variant="caption" color="text.secondary" component="div">
                      {[entry.date, entry.settledOn ? t('Settled {date}', { date: entry.settledOn }) : ''].filter(Boolean).join(' · ')}
                    </Typography>
                    <Stack direction="row" sx={{ justifyContent: 'space-between', mt: 0.75 }}>
                      <Typography variant="body2">{t('Bill amount {amount}', { amount: formatCurrency(totals.total) })}</Typography>
                      <Typography variant="body2" color="success.main">{t('Received {amount}', { amount: formatCurrency(totals.paid) })}</Typography>
                    </Stack>
                    <LinearProgress variant="determinate" value={share} color={share >= 100 ? 'success' : 'warning'} sx={{ my: 0.75, height: 6, borderRadius: 3 }} />
                    <Typography variant="caption" color="text.secondary">{handoverNote(entry, totals)}</Typography>
                  </Box>
                </Box>
              );
            })}
            {canNext && (
              <Box sx={{ display: 'flex', gap: 1.25 }}>
                <Box sx={{ display: 'flex', flexDirection: 'column', alignItems: 'center', width: 20, flexShrink: 0 }}>
                  <Box sx={{ width: 16, height: 16, borderRadius: '50%', border: 2, borderStyle: 'dashed', borderColor: 'text.disabled', mt: 1.25 }} />
                </Box>
                <Box sx={{ flex: 1, border: 1, borderStyle: 'dashed', borderColor: 'divider', borderRadius: 2, p: 1.25, mb: 1 }}>
                  <Typography variant="subtitle2" color="text.secondary">{t('Next: R{number}', { number: (latest.raNumber || 1) + 1 })}</Typography>
                  <Typography variant="caption" color="text.secondary" component="div" sx={{ mb: 0.75 }}>{t('Not started. It begins empty, with the same project, client and name.')}</Typography>
                  <Button size="small" variant="outlined" onClick={() => onStartNext(latest)}>{t('Start next running bill')}</Button>
                </Box>
              </Box>
            )}
          </Box>
          {account && (
            <Box sx={{ mt: 1, p: 1.25, borderRadius: 1, bgcolor: 'action.hover' }}>
              <Typography variant="body2">{t('Work to date {amount}', { amount: formatCurrency(account.totalToDate) })}</Typography>
              <Typography variant="body2">{t('Received to date {amount}', { amount: formatCurrency(account.receivedToDate) })}</Typography>
              {account.discountToDate > 0 && <Typography variant="body2">{t('Discount allowed {amount}', { amount: formatCurrency(account.discountToDate) })}</Typography>}
              <Typography variant="subtitle2">{t('Balance to date {amount}', { amount: formatCurrency(account.balanceToDate) })}</Typography>
              {account.dueApartToDate > 0 && <Typography variant="caption" color="text.secondary">{t('Still due on earlier bills, not included above: {amount}', { amount: formatCurrency(account.dueApartToDate) })}</Typography>}
            </Box>
          )}
        </>
      )}
    </ResponsiveDialog>
  );
}

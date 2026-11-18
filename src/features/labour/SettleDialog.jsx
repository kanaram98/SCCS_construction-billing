import { useState } from 'react';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import { Notice, ResponsiveDialog, SelectField, SwitchField, TextField } from '../../components/ui';
import { PAYMENT_MODES } from '../../domain/payments.js';
import { formatCurrency } from '../../domain/formatters.js';
import { DEFAULT_LABOUR_PAYMENT_MODE, isDateClosed, localToday } from '../../domain/labour.js';
import { useLabour } from './useLabour.js';
import { tr as t } from '../../i18n/translate.js';

/**
 * "Settle and leave": the worker's last working day, and (if wages are due) the
 * final payment in the same step. Their attendance and payments stay in the reports.
 */
export default function SettleDialog({ open, worker, balance = 0, onSettle, onClose }) {
  return (
    <ResponsiveDialog open={open} title={worker ? t('Settle and leave: {name}', { name: worker.name }) : ''} onClose={onClose} maxWidth="xs">
      {open && worker && <SettleForm key={worker.id} balance={balance} onSettle={onSettle} onClose={onClose} />}
    </ResponsiveDialog>
  );
}

function SettleForm({ balance, onSettle, onClose }) {
  const { raw } = useLabour();
  const [date, setDate] = useState(localToday());
  const [payDue, setPayDue] = useState(balance > 0);
  const [mode, setMode] = useState(DEFAULT_LABOUR_PAYMENT_MODE);
  const [submitted, setSubmitted] = useState(false);
  const error = !date ? t('Choose the date.') : date > localToday() ? t('The last day cannot be in the future.') : (payDue && balance > 0 && isDateClosed(raw, date)) ? t('This month is closed. Unlock it first.') : '';

  function submit(event) {
    event.preventDefault();
    setSubmitted(true);
    if (error) return;
    onSettle({ date, payDue: payDue && balance > 0, amount: balance, mode });
  }

  return (
    <Grid container spacing={2} component="form" onSubmit={submit} noValidate sx={{ pt: 1 }}>
      <Grid size={12}>
        <Typography variant="body2">
          {balance > 0
            ? t('Wages due to the worker: {amount}', { amount: formatCurrency(balance) })
            : balance < 0 ? t('The worker has taken {amount} in advance.', { amount: formatCurrency(-balance) }) : t('Nothing is due to the worker.')}
        </Typography>
      </Grid>
      <Grid size={12}>
        <TextField label={t('Last working day')} type="date" required value={date} max={localToday()} error={submitted ? error : ''} onChange={setDate} />
      </Grid>
      {balance > 0 && (
        <>
          <Grid size={12}>
            <SwitchField label={t('Pay the {amount} due now', { amount: formatCurrency(balance) })} checked={payDue} onChange={setPayDue} />
          </Grid>
          {payDue && (
            <Grid size={12}>
              <SelectField label={t('Paid by')} value={mode} options={PAYMENT_MODES} onChange={setMode} />
            </Grid>
          )}
        </>
      )}
      {balance < 0 && <Grid size={12}><Notice tone="info">{t('The advance stays on the worker’s record. You can still see it in reports.')}</Notice></Grid>}
      <Grid size={12}>
        <Typography variant="caption" color="text.secondary">{t('Attendance and payments stay in all reports. You can bring the worker back with Rejoin.')}</Typography>
      </Grid>
      <Grid size={12} sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
        <Button onClick={onClose}>{t('Cancel')}</Button>
        <Button type="submit" variant="contained">{t('Settle and leave')}</Button>
      </Grid>
    </Grid>
  );
}

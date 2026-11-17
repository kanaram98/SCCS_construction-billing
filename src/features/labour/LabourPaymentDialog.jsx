import { useState } from 'react';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import { ResponsiveDialog, SelectField, TextField } from '../../components/ui';
import { PAYMENT_MODES, getPaymentErrors } from '../../domain/payments.js';
import { formatCurrency } from '../../domain/formatters.js';
import { DEFAULT_LABOUR_PAYMENT_MODE, localToday } from '../../domain/labour.js';
import { tr as t } from '../../i18n/translate.js';

/**
 * Record money given to a worker (an advance or a wage payment) with its date,
 * how it was paid and a description. Pass `payment` to edit an existing one.
 */
export default function LabourPaymentDialog({ open, worker, payment, balance = 0, onSave, onClose }) {
  return (
    <ResponsiveDialog
      open={open}
      title={worker ? (payment ? t('Edit payment') : t('Pay {name}', { name: worker.name })) : ''}
      onClose={onClose}
      maxWidth="xs"
    >
      {open && worker && (
        <PaymentForm
          key={payment?.id || worker.id}
          initial={payment
            ? { date: payment.date, amount: String(payment.amount), mode: payment.mode || DEFAULT_LABOUR_PAYMENT_MODE, note: payment.note || '' }
            : { date: localToday(), amount: balance > 0 ? String(balance) : '', mode: DEFAULT_LABOUR_PAYMENT_MODE, note: '' }}
          balance={payment ? null : balance}
          onSave={onSave}
          onClose={onClose}
        />
      )}
    </ResponsiveDialog>
  );
}

function PaymentForm({ initial, balance, onSave, onClose }) {
  const [values, setValues] = useState(initial);
  const [submitted, setSubmitted] = useState(false);
  const errors = getPaymentErrors(values);
  const update = (field) => (value) => setValues((current) => ({ ...current, [field]: value }));

  function save(event) {
    event.preventDefault();
    setSubmitted(true);
    if (errors.amount || errors.date) return;
    onSave({ date: values.date, amount: Number(values.amount), mode: values.mode, note: values.note.trim() });
  }

  return (
    <Grid container spacing={2} component="form" onSubmit={save} noValidate sx={{ pt: 1 }}>
      {balance !== null && (
        <Grid size={12} sx={{ typography: 'body2', color: 'text.secondary' }}>
          {balance > 0 ? t('Wages due: {amount}', { amount: formatCurrency(balance) }) : t('Nothing due. This will be an advance.')}
        </Grid>
      )}
      <Grid size={6}>
        <TextField label={t('Amount (₹)')} required type="number" min="0" step="any" value={values.amount} error={submitted ? errors.amount : ''} onChange={update('amount')} autoFocus />
      </Grid>
      <Grid size={6}>
        <TextField label={t('Date')} required type="date" value={values.date} error={submitted ? errors.date : ''} onChange={update('date')} />
      </Grid>
      <Grid size={12}>
        <SelectField
          label={t('Paid by')}
          value={values.mode}
          options={PAYMENT_MODES}
          onChange={update('mode')}
        />
      </Grid>
      <Grid size={12}>
        <TextField label={t('Description (optional)')} placeholder={t('e.g. Advance, weekly payment')} value={values.note} onChange={update('note')} />
      </Grid>
      <Grid size={12} sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
        <Button onClick={onClose}>{t('Cancel')}</Button>
        <Button type="submit" variant="contained">{t('Save')}</Button>
      </Grid>
    </Grid>
  );
}

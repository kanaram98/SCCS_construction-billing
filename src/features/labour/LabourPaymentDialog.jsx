import { useState } from 'react';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import { ResponsiveDialog, TextField } from '../../components/ui';
import { getPaymentErrors } from '../../domain/payments.js';
import { formatCurrency } from '../../domain/formatters.js';
import { localToday } from '../../domain/labour.js';
import { tr as t } from '../../i18n/translate.js';

/** Record money given to a worker: an advance or a wage payment. */
export default function LabourPaymentDialog({ open, worker, balance = 0, onSave, onClose }) {
  return (
    <ResponsiveDialog open={open} title={worker ? t('Pay {name}', { name: worker.name }) : ''} onClose={onClose} maxWidth="xs">
      {open && worker && (
        <PaymentForm
          key={worker.id}
          initial={{ date: localToday(), amount: balance > 0 ? String(balance) : '', note: '' }}
          balance={balance}
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
    onSave({ date: values.date, amount: Number(values.amount), note: values.note.trim() });
  }

  return (
    <Grid container spacing={2} component="form" onSubmit={save} noValidate sx={{ pt: 1 }}>
      <Grid size={12} sx={{ typography: 'body2', color: 'text.secondary' }}>
        {balance > 0 ? t('Wages due: {amount}', { amount: formatCurrency(balance) }) : t('Nothing due. This will be an advance.')}
      </Grid>
      <Grid size={6}>
        <TextField label={t('Amount (₹)')} required type="number" min="0" step="any" value={values.amount} error={submitted ? errors.amount : ''} onChange={update('amount')} autoFocus />
      </Grid>
      <Grid size={6}>
        <TextField label={t('Date')} required type="date" value={values.date} error={submitted ? errors.date : ''} onChange={update('date')} />
      </Grid>
      <Grid size={12}>
        <TextField label={t('Note (optional)')} placeholder={t('e.g. Advance, weekly payment')} value={values.note} onChange={update('note')} />
      </Grid>
      <Grid size={12} sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
        <Button onClick={onClose}>{t('Cancel')}</Button>
        <Button type="submit" variant="contained">{t('Save')}</Button>
      </Grid>
    </Grid>
  );
}

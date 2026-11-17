import { useState } from 'react';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import { ResponsiveDialog, SelectField, TextField } from '../../components/ui';
import { PAYMENT_MODES, getPaymentErrors } from '../../domain/payments.js';
import { todayIso } from '../../domain/formatters.js';

/** Record or edit a payment. New payments default to today and the balance due. */
export default function PaymentDialog({ open, payment, suggestedAmount, onSave, onClose }) {
  return (
    <ResponsiveDialog open={open} title={payment ? 'Edit payment' : 'Record payment'} onClose={onClose} maxWidth="xs">
      {open && (
        <PaymentForm
          key={payment?.id || 'new'}
          initial={payment || { date: todayIso(), amount: suggestedAmount > 0 ? String(suggestedAmount) : '', mode: 'upi', note: '' }}
          isEdit={Boolean(payment)}
          onSave={onSave}
          onClose={onClose}
        />
      )}
    </ResponsiveDialog>
  );
}

function PaymentForm({ initial, isEdit, onSave, onClose }) {
  const [values, setValues] = useState(() => ({ ...initial, amount: String(initial.amount ?? '') }));
  const [submitted, setSubmitted] = useState(false);
  const errors = getPaymentErrors(values);
  const update = (field) => (value) => setValues((current) => ({ ...current, [field]: value }));

  function save(event) {
    event.preventDefault();
    setSubmitted(true);
    if (Object.values(errors).some(Boolean)) return;
    onSave(values);
  }

  return (
    <Grid container spacing={2} component="form" onSubmit={save} noValidate sx={{ pt: 1 }}>
      <Grid size={6}>
        <TextField label="Amount (₹)" required type="number" min="0" step="any" value={values.amount} error={submitted ? errors.amount : ''} onChange={update('amount')} autoFocus />
      </Grid>
      <Grid size={6}>
        <TextField label="Date" required type="date" value={values.date} error={submitted ? errors.date : ''} onChange={update('date')} />
      </Grid>
      <Grid size={12}>
        <SelectField label="Paid by" value={values.mode} options={PAYMENT_MODES} onChange={update('mode')} />
      </Grid>
      <Grid size={12}>
        <TextField label="Note (optional)" value={values.note} placeholder="e.g. UTR / cheque number" onChange={update('note')} />
      </Grid>
      <Grid size={12} sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button type="submit" variant="contained">{isEdit ? 'Save' : 'Record payment'}</Button>
      </Grid>
    </Grid>
  );
}

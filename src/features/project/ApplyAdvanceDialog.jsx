import { useState } from 'react';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import { ResponsiveDialog, SelectField, TextField } from '../../components/ui';
import { formatCurrency, todayIso } from '../../domain/formatters.js';
import { tr as t } from '../../i18n/translate.js';

/** Apply part of a client advance (recorded in Projects) to this bill. `choices`: [{ advance, remaining }]. */
export default function ApplyAdvanceDialog({ open, choices, balance, onApply, onClose }) {
  return (
    <ResponsiveDialog open={open} title={t('Apply advance to this bill')} onClose={onClose} maxWidth="xs">
      {open && <ApplyForm key="apply" choices={choices} balance={balance} onApply={onApply} onClose={onClose} />}
    </ResponsiveDialog>
  );
}

function ApplyForm({ choices, balance, onApply, onClose }) {
  const first = choices[0];
  const suggest = (choice) => String(Math.max(0, Math.min(choice.remaining, balance)));
  const [advanceId, setAdvanceId] = useState(first.advance.id);
  const [amount, setAmount] = useState(suggest(first));
  const [submitted, setSubmitted] = useState(false);
  const choice = choices.find((entry) => entry.advance.id === advanceId) || first;
  const value = Number(amount);
  const error = !(value > 0) ? t('Enter an amount greater than zero.')
    : value > choice.remaining ? t('Only {amount} of this advance is left.', { amount: formatCurrency(choice.remaining) })
    : value > balance ? t('This is more than the balance due on the bill.') : '';

  function submit(event) {
    event.preventDefault();
    setSubmitted(true);
    if (!error) onApply({ advanceId, amount: value, date: todayIso() });
  }

  return (
    <Grid container spacing={2} component="form" onSubmit={submit} noValidate sx={{ pt: 1 }}>
      <Grid size={12}>
        <SelectField
          label={t('Advance')}
          value={advanceId}
          options={choices.map(({ advance, remaining }) => ({ value: advance.id, label: `${advance.date} · ${formatCurrency(remaining)} ${t('left of')} ${formatCurrency(advance.amount)}` }))}
          onChange={(next) => { setAdvanceId(next); setAmount(suggest(choices.find((entry) => entry.advance.id === next))); }}
        />
      </Grid>
      <Grid size={12}>
        <TextField label={t('Amount to apply (₹)')} type="number" min="0" step="any" inputMode="decimal" value={amount} error={submitted ? error : ''} onChange={setAmount} autoFocus />
      </Grid>
      <Grid size={12} sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
        <Button onClick={onClose}>{t('Cancel')}</Button>
        <Button type="submit" variant="contained">{t('Apply')}</Button>
      </Grid>
    </Grid>
  );
}

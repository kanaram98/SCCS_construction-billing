import { useState } from 'react';
import Button from '@mui/material/Button';
import FormControl from '@mui/material/FormControl';
import FormControlLabel from '@mui/material/FormControlLabel';
import Radio from '@mui/material/Radio';
import RadioGroup from '@mui/material/RadioGroup';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { ResponsiveDialog, TextAreaField, TextField } from '../../components/ui';
import { formatCurrency } from '../../domain/formatters.js';
import { localToday } from '../../domain/labour.js';
import { tr as t } from '../../i18n/translate.js';

/**
 * Closing a bill. Always asks the date the bill was settled. When money is still owed it also asks what
 * happens to the rest: carry it into the next running bill, settle it with a discount (the client pays
 * less), or leave it as due.
 */
export default function SubmitBillDialog({ open, balance = 0, canCarry = false, onSubmit, onClose }) {
  return (
    <ResponsiveDialog open={open} title={t('Submit this bill?')} onClose={onClose} maxWidth="xs">
      {open && <Form balance={balance} canCarry={canCarry} onSubmit={onSubmit} onClose={onClose} />}
    </ResponsiveDialog>
  );
}

function Form({ balance, canCarry, onSubmit, onClose }) {
  const owed = balance > 0.5;
  const [settledOn, setSettledOn] = useState(localToday());
  const [kind, setKind] = useState(canCarry ? 'carry' : 'due');
  const [amount, setAmount] = useState(String(Math.round(balance)));
  const [reason, setReason] = useState('');
  const discount = Number(amount);
  const discountBad = kind === 'discount' && (!(discount > 0) || discount > balance + 0.5);
  const needsReason = owed && kind !== 'carry';
  const ready = Boolean(settledOn) && settledOn <= localToday() && !discountBad && (!needsReason || reason.trim().length > 0);

  function submit(event) {
    event.preventDefault();
    if (!ready) return;
    onSubmit({
      settledOn,
      reason: reason.trim(),
      settlement: owed ? { kind, amount: kind === 'discount' ? discount : Math.round(balance * 100) / 100, reason: reason.trim() } : undefined
    });
    onClose();
  }

  return (
    <form onSubmit={submit} style={{ paddingTop: 8 }}>
      <Typography variant="body2" sx={{ mb: 1.5 }}>{t('The bill is closed and moves to the Submitted tab. Only the admin can reopen it.')}</Typography>
      <TextField label={t('Settled on')} type="date" value={settledOn} onChange={setSettledOn} helperText={t('The day the client paid. It can be earlier than today.')} slotProps={{ htmlInput: { max: localToday() } }} />
      {owed && (
        <FormControl sx={{ mt: 2, width: '100%' }}>
          <Typography variant="subtitle2" sx={{ mb: 0.5 }}>{t('{amount} is still unpaid. What happens to it?', { amount: formatCurrency(balance) })}</Typography>
          <RadioGroup value={kind} onChange={(event) => setKind(event.target.value)}>
            {canCarry && <FormControlLabel value="carry" control={<Radio />} label={t('Carry it into the next running bill (added to its balance)')} />}
            <FormControlLabel value="discount" control={<Radio />} label={t('Settled with a discount (client pays less)')} />
            <FormControlLabel value="due" control={<Radio />} label={t('Leave it as due on this bill (not added to the next bill)')} />
          </RadioGroup>
          {kind === 'discount' && (
            <TextField label={t('Discount amount (₹)')} type="number" min="0" step="any" value={amount} error={discountBad ? t('Enter an amount up to the balance.') : ''} onChange={setAmount} />
          )}
          <TextAreaField label={needsReason ? t('Reason') : t('Note (optional)')} rows={2} value={reason} onChange={setReason} sx={{ mt: 1.5 }} />
        </FormControl>
      )}
      <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end', mt: 2 }}>
        <Button onClick={onClose}>{t('Cancel')}</Button>
        <Button type="submit" variant="contained" disabled={!ready}>{t('Submit')}</Button>
      </Stack>
    </form>
  );
}

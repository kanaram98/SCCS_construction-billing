import { useState } from 'react';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import ResponsiveDialog from './ResponsiveDialog.jsx';
import { TextAreaField } from './FormFields.jsx';
import { tr as t } from '../../i18n/translate.js';

/**
 * Asks for a reason before a serious action (cancel a bill, reopen a settled bill).
 * `required`: the button stays disabled until something is typed.
 */
export default function ReasonDialog({ open, title, message, confirmLabel, required = true, danger = false, onConfirm, onClose }) {
  return (
    <ResponsiveDialog open={open} title={title} onClose={onClose} maxWidth="xs">
      {open && <ReasonForm message={message} confirmLabel={confirmLabel} required={required} danger={danger} onConfirm={onConfirm} onClose={onClose} />}
    </ResponsiveDialog>
  );
}

function ReasonForm({ message, confirmLabel, required, danger, onConfirm, onClose }) {
  const [reason, setReason] = useState('');
  const ready = !required || reason.trim().length > 0;
  function submit(event) {
    event.preventDefault();
    if (!ready) return;
    onConfirm(reason.trim());
    onClose();
  }
  return (
    <form onSubmit={submit} style={{ paddingTop: 8 }}>
      {message && <Typography variant="body2" sx={{ mb: 2, whiteSpace: 'pre-line' }}>{message}</Typography>}
      <TextAreaField label={t('Reason')} rows={2} value={reason} onChange={setReason} autoFocus />
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
        <Button onClick={onClose}>{t('Cancel')}</Button>
        <Button type="submit" variant="contained" color={danger ? 'error' : 'primary'} disabled={!ready}>{confirmLabel || t('Confirm')}</Button>
      </div>
    </form>
  );
}

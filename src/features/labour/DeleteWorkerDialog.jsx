import { useState } from 'react';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import { Notice, ResponsiveDialog, TextField } from '../../components/ui';
import { tr as t } from '../../i18n/translate.js';

/**
 * Deleting a worker who has attendance or payments loses that history, so the
 * admin must type the name to confirm. Marking the worker as left keeps everything.
 */
export default function DeleteWorkerDialog({ open, worker, onSettle, onDelete, onClose }) {
  return (
    <ResponsiveDialog open={open} title={worker ? t('Delete {name} and all records?', { name: worker.name }) : ''} onClose={onClose} maxWidth="xs">
      {open && worker && <DeleteForm key={worker.id} worker={worker} onSettle={onSettle} onDelete={onDelete} onClose={onClose} />}
    </ResponsiveDialog>
  );
}

function DeleteForm({ worker, onSettle, onDelete, onClose }) {
  const [typed, setTyped] = useState('');
  const matches = typed.trim().toLowerCase() === worker.name.trim().toLowerCase();
  return (
    <Grid container spacing={2} sx={{ pt: 1 }}>
      <Grid size={12}>
        <Notice tone="warning">{t('{name} has attendance and payments. Deleting removes them from every report. If the worker only stopped working, use Settle and leave instead: all records are kept.', { name: worker.name })}</Notice>
      </Grid>
      <Grid size={12}>
        <Button fullWidth variant="contained" onClick={onSettle}>{t('Settle and leave instead')}</Button>
      </Grid>
      <Grid size={12}>
        <Typography variant="caption" color="text.secondary">{t('To delete anyway, type the worker’s name. It moves to Recently deleted for 30 days, then is gone for good. Share their sheet first if you need a copy.')}</Typography>
        <TextField label={t('Type {name} to confirm', { name: worker.name })} value={typed} onChange={setTyped} />
      </Grid>
      <Grid size={12} sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
        <Button onClick={onClose}>{t('Cancel')}</Button>
        <Button color="error" variant="outlined" disabled={!matches} onClick={onDelete}>{t('Delete with all records')}</Button>
      </Grid>
    </Grid>
  );
}

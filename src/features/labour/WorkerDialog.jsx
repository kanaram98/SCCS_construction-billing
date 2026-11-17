import { useState } from 'react';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import { ResponsiveDialog, TextField } from '../../components/ui';
import { getWorkerErrors } from '../../domain/labour.js';
import { tr as t } from '../../i18n/translate.js';

/** Add or edit a worker. */
export default function WorkerDialog({ open, worker, onSave, onClose }) {
  return (
    <ResponsiveDialog open={open} title={worker ? t('Edit worker') : t('Add worker')} onClose={onClose} maxWidth="xs">
      {open && <WorkerForm key={worker?.id || 'new'} initial={worker} onSave={onSave} onClose={onClose} />}
    </ResponsiveDialog>
  );
}

function WorkerForm({ initial, onSave, onClose }) {
  const [values, setValues] = useState(() => ({ name: '', role: '', phone: '', ...initial, dailyWage: String(initial?.dailyWage ?? '') }));
  const [submitted, setSubmitted] = useState(false);
  const errors = getWorkerErrors(values);
  const update = (field) => (value) => setValues((current) => ({ ...current, [field]: value }));

  function save(event) {
    event.preventDefault();
    setSubmitted(true);
    if (Object.values(errors).some(Boolean)) return;
    onSave({ name: values.name.trim(), role: values.role.trim(), phone: values.phone.trim(), dailyWage: Number(values.dailyWage) });
  }

  return (
    <Grid container spacing={2} component="form" onSubmit={save} noValidate sx={{ pt: 1 }}>
      <Grid size={12}>
        <TextField label={t('Name')} required value={values.name} error={submitted ? errors.name : ''} onChange={update('name')} autoFocus />
      </Grid>
      <Grid size={6}>
        <TextField label={t('Daily wage (₹)')} required type="number" min="0" step="any" value={values.dailyWage} error={submitted ? errors.dailyWage : ''} onChange={update('dailyWage')} />
      </Grid>
      <Grid size={6}>
        <TextField label={t('Work (optional)')} placeholder={t('e.g. Mason, Helper')} value={values.role} onChange={update('role')} />
      </Grid>
      <Grid size={12}>
        <TextField label={t('Mobile (optional)')} type="tel" value={values.phone} onChange={update('phone')} />
      </Grid>
      {initial && (
        <Grid size={12} sx={{ color: 'text.secondary', typography: 'caption' }}>
          {t('A new wage applies to attendance marked from now on. Past days keep the wage they were marked with.')}
        </Grid>
      )}
      <Grid size={12} sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
        <Button onClick={onClose}>{t('Cancel')}</Button>
        <Button type="submit" variant="contained">{t('Save')}</Button>
      </Grid>
    </Grid>
  );
}

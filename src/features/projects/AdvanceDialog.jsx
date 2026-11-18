import { useState } from 'react';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import { ResponsiveDialog, SelectField, TextField } from '../../components/ui';
import { getAdvanceErrors, hasErrors } from '../../domain/projects.js';
import { PAYMENT_MODES } from '../../domain/payments.js';
import { todayIso } from '../../domain/formatters.js';
import { localToday } from '../../domain/labour.js';
import { tr as t } from '../../i18n/translate.js';

/** Record (or, for the admin, edit) an advance received from the client under a project. */
export default function AdvanceDialog({ open, advance, projects, projectId = '', onSave, onDelete, onClose }) {
  return (
    <ResponsiveDialog open={open} title={advance ? t('Edit advance') : t('Advance from client')} onClose={onClose} maxWidth="xs">
      {open && <AdvanceForm key={advance?.id || 'new'} initial={advance} projects={projects} projectId={projectId} onSave={onSave} onDelete={onDelete} onClose={onClose} />}
    </ResponsiveDialog>
  );
}

function AdvanceForm({ initial, projects, projectId, onSave, onDelete, onClose }) {
  const [values, setValues] = useState(() => ({
    projectId: projectId || (projects.length === 1 ? projects[0].id : ''),
    date: localToday() || todayIso(),
    amount: '',
    mode: 'cash',
    note: '',
    ...initial,
    amount: String(initial?.amount ?? '')
  }));
  const [submitted, setSubmitted] = useState(false);
  const errors = getAdvanceErrors(values);
  const update = (field) => (value) => setValues((current) => ({ ...current, [field]: value }));

  function save(event) {
    event.preventDefault();
    setSubmitted(true);
    if (hasErrors(errors)) return;
    onSave({ projectId: values.projectId, date: values.date, amount: Number(values.amount), mode: values.mode, note: values.note.trim() });
  }

  return (
    <Grid container spacing={2} component="form" onSubmit={save} noValidate sx={{ pt: 1 }}>
      <Grid size={12}>
        <SelectField label={t('Project')} required value={values.projectId} placeholder={t('Choose project')} options={projects.map((project) => ({ value: project.id, label: project.name }))} error={submitted ? errors.projectId : ''} onChange={update('projectId')} />
      </Grid>
      <Grid size={6}>
        <TextField label={t('Amount (₹)')} required type="number" min="0" step="any" value={values.amount} error={submitted ? errors.amount : ''} onChange={update('amount')} autoFocus />
      </Grid>
      <Grid size={6}>
        <TextField label={t('Date')} required type="date" value={values.date} error={submitted ? errors.date : ''} onChange={update('date')} />
      </Grid>
      <Grid size={12}>
        <SelectField label={t('Paid by')} value={values.mode} options={PAYMENT_MODES} onChange={update('mode')} />
      </Grid>
      <Grid size={12}>
        <TextField label={t('Note (optional)')} placeholder={t('e.g. UTR / cheque number, what it is for')} value={values.note} onChange={update('note')} />
      </Grid>
      <Grid size={12} sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
        {onDelete ? <Button color="error" onClick={onDelete}>{t('Delete')}</Button> : <span />}
        <span>
          <Button onClick={onClose}>{t('Cancel')}</Button>
          <Button type="submit" variant="contained" sx={{ ml: 1 }}>{t('Save')}</Button>
        </span>
      </Grid>
    </Grid>
  );
}

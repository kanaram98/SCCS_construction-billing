import { useState } from 'react';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import { ResponsiveDialog, SelectField, TextAreaField, TextField } from '../../components/ui';
import { gstinWarning, phoneWarning } from '../../domain/warnings.js';
import { PROJECT_STATUSES, getProjectErrors, hasErrors } from '../../domain/projects.js';
import { tr as t } from '../../i18n/translate.js';

/** Add or edit a project (site). */
export default function ProjectDialog({ open, project, onSave, onClose }) {
  return (
    <ResponsiveDialog open={open} title={project ? t('Edit project') : t('Add project')} onClose={onClose} maxWidth="xs">
      {open && <ProjectForm key={project?.id || 'new'} initial={project} onSave={onSave} onClose={onClose} />}
    </ResponsiveDialog>
  );
}

function ProjectForm({ initial, onSave, onClose }) {
  const [values, setValues] = useState(() => ({ name: '', clientId: '', client: '', clientPhone: '', clientAddress: '', clientGstin: '', address: '', status: 'running', agreedAmount: '', notes: '', ...initial }));
  const [submitted, setSubmitted] = useState(false);
  const errors = getProjectErrors(values);
  const update = (field) => (value) => setValues((current) => ({ ...current, [field]: value }));

  function save(event) {
    event.preventDefault();
    setSubmitted(true);
    if (hasErrors(errors)) return;
    onSave({ ...values, name: values.name.trim(), client: values.client.trim(), clientPhone: values.clientPhone.trim(), clientAddress: values.clientAddress.trim(), clientGstin: values.clientGstin.trim().toUpperCase(), agreedAmount: String(values.agreedAmount ?? '').trim() });
  }

  return (
    <Grid container spacing={2} component="form" onSubmit={save} noValidate sx={{ pt: 1 }}>
      <Grid size={12}>
        <TextField label={t('Project / site name')} required value={values.name} error={submitted ? errors.name : ''} onChange={update('name')} autoFocus />
      </Grid>
      <Grid size={12}>
        <TextField label={t('Client name')} required value={values.client} error={submitted ? errors.client : ''} onChange={update('client')} />
      </Grid>
      <Grid size={6}>
        <TextField label={t('Client phone')} type="tel" value={values.clientPhone} warning={phoneWarning(values.clientPhone)} onChange={update('clientPhone')} />
      </Grid>
      <Grid size={6}>
        <TextField label={t('Client GSTIN')} value={values.clientGstin} warning={gstinWarning(values.clientGstin)} onChange={(value) => update('clientGstin')(value.toUpperCase())} />
      </Grid>
      <Grid size={12}>
        <TextField label={t('Client address')} value={values.clientAddress} onChange={update('clientAddress')} />
      </Grid>
      <Grid size={12}>
        <TextField label={t('Site address (optional)')} value={values.address} onChange={update('address')} />
      </Grid>
      <Grid size={6}>
        <TextField label={t('Agreed amount (₹, optional)')} type="number" min="0" step="any" value={values.agreedAmount} error={submitted ? errors.agreedAmount : ''} onChange={update('agreedAmount')} />
      </Grid>
      <Grid size={6}>
        <SelectField label={t('Status')} value={values.status} options={PROJECT_STATUSES} onChange={update('status')} />
      </Grid>
      <Grid size={12}>
        <TextAreaField label={t('Notes (optional)')} rows={2} value={values.notes} onChange={update('notes')} />
      </Grid>
      <Grid size={12} sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
        <Button onClick={onClose}>{t('Cancel')}</Button>
        <Button type="submit" variant="contained">{t('Save')}</Button>
      </Grid>
    </Grid>
  );
}

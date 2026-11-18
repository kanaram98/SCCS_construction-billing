import { useState } from 'react';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import { ResponsiveDialog, SelectField, TextAreaField, TextField } from '../../components/ui';
import { PROJECT_STATUSES, getProjectErrors, hasErrors } from '../../domain/projects.js';
import { useBilling } from '../../state/BillingContext.jsx';
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
  const { data } = useBilling();
  const [values, setValues] = useState(() => ({ name: '', clientId: '', client: '', address: '', status: 'running', agreedAmount: '', notes: '', ...initial }));
  const [submitted, setSubmitted] = useState(false);
  const errors = getProjectErrors(values);
  const update = (field) => (value) => setValues((current) => ({ ...current, [field]: value }));

  function chooseClient(clientId) {
    const saved = data.clients.find((client) => client.id === clientId);
    setValues((current) => ({ ...current, clientId, client: saved ? saved.name : current.client, address: current.address || saved?.address || '' }));
  }

  function save(event) {
    event.preventDefault();
    setSubmitted(true);
    if (hasErrors(errors)) return;
    onSave({ ...values, name: values.name.trim(), client: values.client.trim(), agreedAmount: String(values.agreedAmount ?? '').trim() });
  }

  return (
    <Grid container spacing={2} component="form" onSubmit={save} noValidate sx={{ pt: 1 }}>
      <Grid size={12}>
        <TextField label={t('Project / site name')} required value={values.name} error={submitted ? errors.name : ''} onChange={update('name')} autoFocus />
      </Grid>
      {data.clients.length > 0 && (
        <Grid size={12}>
          <SelectField label={t('Saved client')} value={values.clientId} placeholder={t('Not a saved client')} options={data.clients.map((client) => ({ value: client.id, label: client.name }))} onChange={chooseClient} />
        </Grid>
      )}
      <Grid size={12}>
        <TextField label={t('Client name')} value={values.client} onChange={update('client')} />
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

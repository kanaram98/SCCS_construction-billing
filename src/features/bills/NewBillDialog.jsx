import { useState } from 'react';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import { ResponsiveDialog, SelectField, TextField } from '../../components/ui';
import { tr as t } from '../../i18n/translate.js';

const NEW = '__new__';
const same = (a, b) => String(a || '').trim().toLowerCase() === String(b || '').trim().toLowerCase();

/**
 * Pick the project a bill belongs to, or add a new project right here.
 * Used for "New bill / estimate" and for "Link to a project" on an existing bill
 * (`linking`: a project is required, and the bill's own project and client names are suggested).
 */
export default function NewBillDialog({ open, kind, projects, defaultProjectId = '', linking = null, onCreate, onClose }) {
  const title = linking ? t('Link to a project') : kind === 'estimate' ? t('New estimate') : t('New bill');
  return (
    <ResponsiveDialog open={open} title={title} onClose={onClose} maxWidth="xs">
      {open && <NewBillForm key={linking?.id || 'new'} projects={projects} defaultProjectId={defaultProjectId} linking={linking} onCreate={onCreate} onClose={onClose} />}
    </ResponsiveDialog>
  );
}

function NewBillForm({ projects, defaultProjectId, linking, onCreate, onClose }) {
  const sameName = linking ? projects.find((project) => same(project.name, linking.projectName) && (!linking.client || same(project.client, linking.client))) : null;
  const known = projects.some((project) => project.id === defaultProjectId);
  const start = linking
    ? (sameName ? sameName.id : NEW)
    : known ? defaultProjectId : (projects.length ? '' : NEW);
  const [choice, setChoice] = useState(start);
  const [name, setName] = useState(linking?.projectName || '');
  const [client, setClient] = useState(linking?.client || '');
  const [submitted, setSubmitted] = useState(false);
  const isNew = choice === NEW;

  function submit(event) {
    event.preventDefault();
    if (isNew) {
      setSubmitted(true);
      if (!name.trim() || !client.trim()) return;
      onCreate({ newProject: { name: name.trim(), client: client.trim() } });
    } else {
      onCreate({ project: projects.find((project) => project.id === choice) });
    }
  }

  return (
    <Grid container spacing={2} component="form" onSubmit={submit} noValidate sx={{ pt: 1 }}>
      <Grid size={12}>
        <SelectField
          label={t('Project')}
          value={choice}
          placeholder={linking ? undefined : t('No project (link it later)')}
          options={[...projects.map((project) => ({ value: project.id, label: project.name })), { value: NEW, label: t('Add a new project…') }]}
          helperText={t('Bills under a project appear in its report.')}
          onChange={setChoice}
        />
      </Grid>
      {isNew && (
        <>
          <Grid size={12}>
            <TextField label={t('Project / site name')} required value={name} error={submitted && !name.trim() ? t('Enter the project or site name.') : ''} onChange={setName} autoFocus />
          </Grid>
          <Grid size={12}>
            <TextField label={t('Client name')} required value={client} error={submitted && !client.trim() ? t('Enter the client name.') : ''} onChange={setClient} />
          </Grid>
        </>
      )}
      <Grid size={12} sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
        <Button onClick={onClose}>{t('Cancel')}</Button>
        <Button type="submit" variant="contained" disabled={Boolean(linking) && !choice}>{linking ? t('Link') : t('Create')}</Button>
      </Grid>
    </Grid>
  );
}

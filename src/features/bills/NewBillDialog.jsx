import { useState } from 'react';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import { ResponsiveDialog, SelectField, TextField } from '../../components/ui';
import { tr as t } from '../../i18n/translate.js';

const NEW = '__new__';

/** "New bill / estimate": pick the project it belongs to, or add a new project right here. */
export default function NewBillDialog({ open, kind, projects, defaultProjectId = '', onCreate, onClose }) {
  const title = kind === 'estimate' ? t('New estimate') : t('New bill');
  return (
    <ResponsiveDialog open={open} title={title} onClose={onClose} maxWidth="xs">
      {open && <NewBillForm projects={projects} defaultProjectId={defaultProjectId} onCreate={onCreate} onClose={onClose} />}
    </ResponsiveDialog>
  );
}

function NewBillForm({ projects, defaultProjectId, onCreate, onClose }) {
  const known = projects.some((project) => project.id === defaultProjectId);
  const [choice, setChoice] = useState(known ? defaultProjectId : (projects.length ? '' : NEW));
  const [name, setName] = useState('');
  const [client, setClient] = useState('');
  const [submitted, setSubmitted] = useState(false);
  const isNew = choice === NEW;

  function submit(event) {
    event.preventDefault();
    if (isNew) {
      setSubmitted(true);
      if (!name.trim()) return;
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
          placeholder={t('No project (link it later)')}
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
            <TextField label={t('Client name')} value={client} onChange={setClient} />
          </Grid>
        </>
      )}
      <Grid size={12} sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
        <Button onClick={onClose}>{t('Cancel')}</Button>
        <Button type="submit" variant="contained">{t('Create')}</Button>
      </Grid>
    </Grid>
  );
}

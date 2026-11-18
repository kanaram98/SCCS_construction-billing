import { useState } from 'react';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { ResponsiveDialog, SelectField, TextField } from '../../components/ui';
import { EXPENSE_CATEGORIES, getExpenseErrors, hasErrors } from '../../domain/projects.js';
import { localToday } from '../../domain/labour.js';
import { tr as t } from '../../i18n/translate.js';

/**
 * Add or edit a site expense. `dateError(date)` returns a message when this
 * person may not use that date (the contractor: today and the 2 days before).
 * `onDelete` shows a Delete button (editing only).
 */
export default function ExpenseDialog({ open, expense, projects, projectId = '', dateError = () => '', onSave, onDelete, onClose }) {
  return (
    <ResponsiveDialog open={open} title={expense ? t('Edit expense') : t('Add expense')} onClose={onClose} maxWidth="xs">
      {open && <ExpenseForm key={expense?.id || 'new'} initial={expense} projects={projects} projectId={projectId} dateError={dateError} onSave={onSave} onDelete={onDelete} onClose={onClose} />}
    </ResponsiveDialog>
  );
}

function ExpenseForm({ initial, projects, projectId, dateError, onSave, onDelete, onClose }) {
  const [values, setValues] = useState(() => ({
    projectId: projectId || (projects.length === 1 ? projects[0].id : ''),
    date: localToday(),
    amount: '',
    category: 'food',
    note: '',
    ...initial,
    amount: String(initial?.amount ?? '')
  }));
  const [submitted, setSubmitted] = useState(false);
  const errors = getExpenseErrors(values);
  if (!errors.date) errors.date = dateError(values.date);
  const update = (field) => (value) => setValues((current) => ({ ...current, [field]: value }));

  function save(event) {
    event.preventDefault();
    setSubmitted(true);
    if (hasErrors(errors)) return;
    onSave({ projectId: values.projectId, date: values.date, amount: Number(values.amount), category: values.category, note: values.note.trim() });
  }

  return (
    <Grid container spacing={2} component="form" onSubmit={save} noValidate sx={{ pt: 1 }}>
      <Grid size={12}>
        <SelectField label={t('Project')} required value={values.projectId} placeholder={t('Choose project')} options={projects.map((project) => ({ value: project.id, label: project.name }))} error={submitted ? errors.projectId : ''} onChange={update('projectId')} />
      </Grid>
      <Grid size={6}>
        <TextField label={t('Amount (₹)')} required type="number" min="0" step="any" inputMode="decimal" value={values.amount} error={submitted ? errors.amount : ''} onChange={update('amount')} autoFocus />
      </Grid>
      <Grid size={6}>
        <TextField label={t('Date')} required type="date" value={values.date} error={submitted ? errors.date : ''} onChange={update('date')} />
      </Grid>
      <Grid size={12}>
        <Typography variant="caption" color="text.secondary">{t('Category')}</Typography>
        <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.75, mt: 0.5 }}>
          {Object.entries(EXPENSE_CATEGORIES).map(([key, label]) => (
            <Chip key={key} label={t(label)} color={values.category === key ? 'primary' : 'default'} variant={values.category === key ? 'filled' : 'outlined'} onClick={() => update('category')(key)} />
          ))}
        </Stack>
      </Grid>
      <Grid size={12}>
        <TextField label={t('Note (optional)')} placeholder={t('e.g. lunch for 6 workers')} value={values.note} onChange={update('note')} />
      </Grid>
      <Grid size={12} sx={{ display: 'flex', justifyContent: 'space-between', gap: 1 }}>
        {onDelete ? <Button color="error" onClick={onDelete}>{t('Delete')}</Button> : <span />}
        <Stack direction="row" spacing={1}>
          <Button onClick={onClose}>{t('Cancel')}</Button>
          <Button type="submit" variant="contained">{t('Save')}</Button>
        </Stack>
      </Grid>
    </Grid>
  );
}

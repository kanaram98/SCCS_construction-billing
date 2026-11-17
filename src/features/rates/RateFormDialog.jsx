import { useState } from 'react';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import { ResponsiveDialog, SelectField, TextField } from '../../components/ui';
import { MEASUREMENT_TYPES, getRateErrors, isRateValid } from '../../domain/rates.js';
import { tr as t } from '../../i18n/translate.js';

const TYPE_OPTIONS = MEASUREMENT_TYPES.map(({ id, label }) => ({ value: id, label }));
const EMPTY_RATE = { name: '', unit: '', type: 'area', rate: '' };

/**
 * Single form for adding a work item or editing an existing one.
 * Errors show for a field once it has been edited, and for all fields after a save attempt.
 */
export default function RateFormDialog({ open, rate, onSave, onClose }) {
  return (
    <ResponsiveDialog open={open} title={rate ? t('Edit work item') : t('Add work item')} onClose={onClose} maxWidth="xs">
      {/* Remount per opening so the form starts from the chosen rate. */}
      {open && <RateForm key={rate?.id || 'new'} rate={rate} onSave={onSave} onClose={onClose} />}
    </ResponsiveDialog>
  );
}

function RateForm({ rate, onSave, onClose }) {
  const [values, setValues] = useState(() => (rate ? { ...rate } : { ...EMPTY_RATE }));
  const [touched, setTouched] = useState({});
  const [submitted, setSubmitted] = useState(false);
  const errors = getRateErrors(values);
  const errorFor = (field) => (submitted || touched[field] ? errors[field] : '');

  const update = (field) => (value) => {
    setValues((current) => ({ ...current, [field]: value }));
    setTouched((current) => ({ ...current, [field]: true }));
  };

  function save(event) {
    event.preventDefault();
    setSubmitted(true);
    if (!isRateValid(values)) return;
    onSave({ ...values, name: values.name.trim(), unit: values.unit.trim(), rate: Number(values.rate) });
  }

  return (
    <Grid container spacing={2} component="form" onSubmit={save} noValidate sx={{ pt: 1 }}>
      <Grid size={12}>
        <TextField label={t('Item name')} required autoFocus value={values.name} error={errorFor('name')} placeholder={t('e.g. Wall putty')} onChange={update('name')} />
      </Grid>
      <Grid size={12}>
        <SelectField label={t('Measured as')} value={values.type} options={TYPE_OPTIONS} error={errorFor('type')} onChange={update('type')} />
      </Grid>
      <Grid size={6}>
        <TextField label={t('Unit')} required value={values.unit} error={errorFor('unit')} placeholder={t('sqft')} onChange={update('unit')} />
      </Grid>
      <Grid size={6}>
        <TextField label={t('Rate (₹)')} required type="number" min="0" step="any" value={values.rate} error={errorFor('rate')} onChange={update('rate')} />
      </Grid>
      <Grid size={12} sx={{ display: 'flex', justifyContent: 'flex-end', gap: 1 }}>
        <Button onClick={onClose}>{t('Cancel')}</Button>
        <Button type="submit" variant="contained">{rate ? t('Save') : t('Add item')}</Button>
      </Grid>
    </Grid>
  );
}

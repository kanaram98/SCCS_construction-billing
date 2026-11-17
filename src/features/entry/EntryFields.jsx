import Grid from '@mui/material/Grid';
import { TextField } from '../../components/ui';
import { getDimensionFields, usesCount } from '../../domain/rates.js';
import DimensionInput from './DimensionInput.jsx';
import { tr as t } from '../../i18n/translate.js';

/** Measurement inputs for the selected work item's measurement type. */
export default function EntryFields({ rate, entry, showErrors = true, onChange }) {
  return (
    <>
      <Grid size={{ xs: 6, sm: 4 }}>
        {usesCount(rate.type) ? (
          <TextField label={t('Number of items')} type="number" min="0" step="any" value={entry.count} onChange={(count) => onChange({ count })} />
        ) : (
          <TextField label={t('Quantity ({unit})', { unit: rate.unit })} type="number" min="0" step="any" value={entry.quantity} onChange={(quantity) => onChange({ quantity })} />
        )}
      </Grid>
      {getDimensionFields(rate.type).map((field) => (
        <Grid size={{ xs: 6, sm: 4 }} key={field.key}>
          <DimensionInput
            label={field.label}
            required={field.required}
            showErrors={showErrors}
            value={entry[field.key]}
            onChange={(value) => onChange({ [field.key]: value })}
          />
        </Grid>
      ))}
      <Grid size={12}>
        <TextField label={t('Note (optional)')} value={entry.note} onChange={(note) => onChange({ note })} />
      </Grid>
    </>
  );
}

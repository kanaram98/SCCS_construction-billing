import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import DeleteIcon from '@mui/icons-material/DeleteOutlined';
import { SelectField, TextField } from '../../components/ui';
import { MEASUREMENT_TYPES } from '../../domain/rates.js';
import { text } from '../../domain/formatters.js';

const TYPE_OPTIONS = MEASUREMENT_TYPES.map(({ id, label }) => ({ value: id, label }));

export default function RateRow({ rate, canRemove, onChange, onRemove }) {
  const rateValue = Number(rate.rate);
  return (
    <Card sx={{ p: 1.5, mb: 1.25 }}>
      <Stack direction="row" spacing={0.5} sx={{ alignItems: 'flex-start' }}>
        <Grid container spacing={1.5} sx={{ flex: 1 }}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <TextField label="Item name" required invalid={!text(rate.name)} value={rate.name} onChange={(name) => onChange({ name })} />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <SelectField label="Measured as" value={rate.type} options={TYPE_OPTIONS} onChange={(type) => onChange({ type })} />
          </Grid>
          <Grid size={6}>
            <TextField label="Unit" required invalid={!text(rate.unit)} value={rate.unit} onChange={(unit) => onChange({ unit })} />
          </Grid>
          <Grid size={6}>
            <TextField
              label="Rate (₹)"
              type="number"
              min="0"
              step="any"
              invalid={!Number.isFinite(rateValue) || rateValue < 0}
              value={rate.rate}
              onChange={(value) => onChange({ rate: value })}
            />
          </Grid>
        </Grid>
        <IconButton aria-label={`Remove ${rate.name || 'work item'}`} color="error" disabled={!canRemove} onClick={onRemove}>
          <DeleteIcon />
        </IconButton>
      </Stack>
    </Card>
  );
}

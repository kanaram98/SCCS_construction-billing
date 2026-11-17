import { Button, SelectField, TextField } from '../../components/ui';
import { MEASUREMENT_TYPES } from '../../domain/rates.js';
import { text } from '../../domain/formatters.js';

const TYPE_OPTIONS = MEASUREMENT_TYPES.map(({ id, label }) => ({ value: id, label }));

export default function RateRow({ rate, canRemove, onChange, onRemove }) {
  const rateValue = Number(rate.rate);
  return (
    <div className="rate-row">
      <TextField label="Item name" required invalid={!text(rate.name)} value={rate.name} onChange={(name) => onChange({ name })} />
      <TextField label="Unit" required invalid={!text(rate.unit)} value={rate.unit} onChange={(unit) => onChange({ unit })} />
      <SelectField label="Measured as" value={rate.type} options={TYPE_OPTIONS} onChange={(type) => onChange({ type })} />
      <TextField
        label="Rate (₹)"
        type="number"
        min="0"
        step="any"
        invalid={!Number.isFinite(rateValue) || rateValue < 0}
        value={rate.rate}
        onChange={(value) => onChange({ rate: value })}
      />
      <Button variant="danger" disabled={!canRemove} onClick={onRemove}>Remove</Button>
    </div>
  );
}

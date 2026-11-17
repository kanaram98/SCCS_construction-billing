import { TextField } from '../../components/ui';
import { getDimensionFields, usesCount } from '../../domain/rates.js';
import DimensionInput from './DimensionInput.jsx';

/** Measurement inputs for the selected work item's measurement type. */
export default function EntryFields({ rate, entry, onChange }) {
  return (
    <>
      {usesCount(rate.type) ? (
        <TextField
          label="Number of items"
          type="number"
          min="0"
          step="any"
          value={entry.count}
          onChange={(count) => onChange({ count })}
        />
      ) : (
        <TextField
          label={`Quantity (${rate.unit})`}
          type="number"
          min="0"
          step="any"
          value={entry.quantity}
          onChange={(quantity) => onChange({ quantity })}
        />
      )}
      {getDimensionFields(rate.type).map((field) => (
        <DimensionInput
          key={field.key}
          label={field.label}
          required={field.required}
          value={entry[field.key]}
          onChange={(value) => onChange({ [field.key]: value })}
        />
      ))}
      <TextField
        className="entry-note-field"
        label="Note (optional)"
        value={entry.note}
        onChange={(note) => onChange({ note })}
      />
    </>
  );
}

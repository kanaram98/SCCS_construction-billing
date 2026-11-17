import { describeDimensionIssue, getDimensionIssue } from '../../domain/validation.js';
import { formatDimension } from '../../domain/measurements.js';

/** Feet.inches input with live validation and a formatted preview (e.g. 15'4"). */
export default function DimensionInput({ label, value, onChange, required = true }) {
  const error = describeDimensionIssue(getDimensionIssue(value, required));
  return (
    <label>{label} <span className="unit-hint">(ft.in)</span>
      <input
        aria-invalid={Boolean(error)}
        inputMode="decimal"
        placeholder="15.4"
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value)}
      />
      {error
        ? <small className="invalid">{error}</small>
        : <small className="dimension-preview">{formatDimension(value) || '0′0″'}</small>}
    </label>
  );
}

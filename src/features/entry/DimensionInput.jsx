import { TextField } from '../../components/ui';
import { describeDimensionIssue, getDimensionIssue } from '../../domain/validation.js';
import { formatDimension } from '../../domain/measurements.js';
import { dimensionWarning } from '../../domain/warnings.js';

/**
 * Feet.inches input with validation and a formatted preview (e.g. 15'4").
 * Format errors always show; "Required" waits until `showErrors` so a fresh form isn't all red.
 */
export default function DimensionInput({ label, value, onChange, required = true, showErrors = true }) {
  const issue = getDimensionIssue(value, required);
  const error = issue && (showErrors || issue.kind === 'format') ? describeDimensionIssue(issue) : '';
  return (
    <TextField
      label={`${label} (ft.in)`}
      value={value}
      placeholder="15.4"
      inputMode="decimal"
      required={required}
      error={error}
      warning={dimensionWarning(value)}
      helperText={formatDimension(value) || 'e.g. 15.4 = 15′4″'}
      onChange={onChange}
    />
  );
}

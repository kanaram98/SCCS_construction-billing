import MuiTextField from '@mui/material/TextField';
import MenuItem from '@mui/material/MenuItem';
import FormControlLabel from '@mui/material/FormControlLabel';
import Switch from '@mui/material/Switch';

/**
 * Text input bound to a string value. `onChange` receives the new value.
 * `error` (string) marks the field invalid and is shown as helper text.
 * `warning` (string) is shown in amber without marking the field invalid.
 * Number inputs open the decimal keypad on phones.
 */
export function TextField({
  value,
  onChange,
  error = '',
  warning = '',
  invalid = Boolean(error),
  helperText,
  type = 'text',
  min,
  max,
  step,
  inputMode,
  slotProps,
  ...props
}) {
  return (
    <MuiTextField
      {...props}
      type={type}
      value={value ?? ''}
      error={invalid}
      helperText={error || warning || helperText}
      onChange={(event) => onChange(event.target.value)}
      slotProps={{
        ...slotProps,
        formHelperText: !error && warning ? { sx: { color: 'warning.dark' }, ...slotProps?.formHelperText } : slotProps?.formHelperText,
        inputLabel: { shrink: type === 'date' ? true : undefined, ...slotProps?.inputLabel },
        htmlInput: {
          min,
          max,
          step,
          inputMode: inputMode || (type === 'number' ? 'decimal' : undefined),
          ...slotProps?.htmlInput
        }
      }}
    />
  );
}

/**
 * Select input.
 * @param {{ options: Array<{ value: string|number, label: string }> | Record<string, string>, placeholder?: string }} props
 *   `options` may be an array or a `{ value: label }` map; `placeholder` adds an empty first option.
 */
export function SelectField({ value, onChange, options, placeholder, error = '', helperText, slotProps, ...props }) {
  const entries = Array.isArray(options)
    ? options
    : Object.entries(options).map(([optionValue, label]) => ({ value: optionValue, label }));
  return (
    <MuiTextField
      {...props}
      select
      value={value ?? ''}
      error={Boolean(error)}
      helperText={error || helperText}
      onChange={(event) => onChange(event.target.value)}
      slotProps={{
        ...slotProps,
        select: { displayEmpty: placeholder !== undefined, ...slotProps?.select },
        inputLabel: { shrink: placeholder !== undefined ? true : undefined, ...slotProps?.inputLabel }
      }}
    >
      {placeholder !== undefined && <MenuItem value=""><em>{placeholder}</em></MenuItem>}
      {entries.map((option) => <MenuItem key={option.value} value={option.value}>{option.label}</MenuItem>)}
    </MuiTextField>
  );
}

export function TextAreaField({ value, onChange, rows = 3, ...props }) {
  return (
    <MuiTextField {...props} multiline minRows={rows} value={value ?? ''} onChange={(event) => onChange(event.target.value)} />
  );
}

/** Labelled on/off switch. */
export function SwitchField({ label, checked, onChange }) {
  return (
    <FormControlLabel
      label={label}
      control={<Switch checked={Boolean(checked)} onChange={(event) => onChange(event.target.checked)} />}
    />
  );
}

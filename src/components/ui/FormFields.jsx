/**
 * Labelled form controls. Each wraps its control in a `<label>` and shows an
 * optional inline error, marking the control `aria-invalid` when present.
 */

function FieldError({ error }) {
  return error ? <small className="invalid">{error}</small> : null;
}

export function TextField({
  label,
  value,
  onChange,
  error = '',
  invalid = Boolean(error),
  className,
  children,
  ...inputProps
}) {
  return (
    <label className={className}>{label}
      <input
        type="text"
        {...inputProps}
        aria-invalid={invalid || undefined}
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value)}
      />
      <FieldError error={error} />
      {children}
    </label>
  );
}

/**
 * @param {{ options: Array<{ value: string|number, label: string }> | Record<string, string>, placeholder?: string }} props
 *   `options` may be an array or a `{ value: label }` map; `placeholder` adds an empty first option.
 */
export function SelectField({ label, value, onChange, options, placeholder, error = '', className, ...selectProps }) {
  const entries = Array.isArray(options)
    ? options
    : Object.entries(options).map(([optionValue, optionLabel]) => ({ value: optionValue, label: optionLabel }));
  return (
    <label className={className}>{label}
      <select
        {...selectProps}
        aria-invalid={Boolean(error) || undefined}
        value={value ?? ''}
        onChange={(event) => onChange(event.target.value)}
      >
        {placeholder !== undefined && <option value="">{placeholder}</option>}
        {entries.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
      </select>
      <FieldError error={error} />
    </label>
  );
}

/** On/off setting rendered as a two-option select. */
export function ToggleSelectField({ label, value, onChange, onLabel, offLabel, offFirst = false }) {
  const options = [{ value: 'on', label: onLabel }, { value: 'off', label: offLabel }];
  return (
    <SelectField
      label={label}
      value={value ? 'on' : 'off'}
      options={offFirst ? options.reverse() : options}
      onChange={(next) => onChange(next === 'on')}
    />
  );
}

export function TextAreaField({ label, value, onChange, className, ...props }) {
  return (
    <label className={className}>{label}
      <textarea {...props} value={value ?? ''} onChange={(event) => onChange(event.target.value)} />
    </label>
  );
}

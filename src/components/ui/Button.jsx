const VARIANT_CLASSES = {
  default: '',
  primary: 'primary',
  danger: 'danger',
  subtle: 'subtle-button'
};

const SIZE_CLASSES = { default: '', compact: 'compact-button' };

/**
 * Standard app button. Defaults to `type="button"` so it never submits a form by accident.
 * @param {{ variant?: 'default'|'primary'|'danger'|'subtle', size?: 'default'|'compact' }} props
 */
export default function Button({ variant = 'default', size = 'default', type = 'button', className = '', ...props }) {
  const classes = ['button', VARIANT_CLASSES[variant], SIZE_CLASSES[size], className].filter(Boolean).join(' ');
  return <button type={type} className={classes} {...props} />;
}

/** Borderless inline action used inside tables. */
export function TextButton({ danger = false, type = 'button', className = '', ...props }) {
  const classes = ['text-action', danger && 'danger-text', className].filter(Boolean).join(' ');
  return <button type={type} className={classes} {...props} />;
}

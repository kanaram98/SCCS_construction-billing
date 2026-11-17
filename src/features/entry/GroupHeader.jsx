import { DisclosureButton } from '../../components/ui';
import { formatCurrency } from '../../domain/formatters.js';

/** Shared header row for a collapsible section or area: toggle, editable name, total and actions. */
export default function GroupHeader({ className, open, name, nameLabel, meta, total, onToggle, onRename, children }) {
  return (
    <div className={`entry-group-header ${className}`}>
      <DisclosureButton open={open} label={name} onToggle={onToggle} />
      <div className="entry-name-block">
        <input aria-label={nameLabel} value={name} onChange={(event) => onRename(event.target.value)} />
        <small>{meta}</small>
      </div>
      <strong className="entry-group-total">{formatCurrency(total)}</strong>
      <div className="entry-group-actions">{children}</div>
    </div>
  );
}

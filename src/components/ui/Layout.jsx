/** Page title with optional description and a primary action on the right. */
export function PageHeading({ title, description, action }) {
  return (
    <div className="page-heading">
      <div>
        <h1>{title}</h1>
        {description && <p>{description}</p>}
      </div>
      {action}
    </div>
  );
}

export function Card({ title, description, className = '', children }) {
  return (
    <div className={['card', className].filter(Boolean).join(' ')}>
      {title && <h2>{title}</h2>}
      {description && <p>{description}</p>}
      {children}
    </div>
  );
}

/** Collapsible card built on `<details>`, with an optional summary note on the right. */
export function CollapsibleCard({ title, meta, defaultOpen = false, className = '', children }) {
  return (
    <details className={['card', 'collapsible-card', className].filter(Boolean).join(' ')} open={defaultOpen}>
      <summary><strong>{title}</strong>{meta && <span>{meta}</span>}</summary>
      {children}
    </details>
  );
}

export function StatCard({ label, value }) {
  return (
    <article className="stat-card">
      <span>{label}</span>
      <strong>{value}</strong>
    </article>
  );
}

/** Chevron toggle used by collapsible sections and areas. */
export function DisclosureButton({ open, label, onToggle }) {
  return (
    <button
      type="button"
      className="disclosure-button"
      aria-label={`${open ? 'Collapse' : 'Expand'} ${label}`}
      aria-expanded={open}
      onClick={onToggle}
    >
      <span className="chevron" />
    </button>
  );
}

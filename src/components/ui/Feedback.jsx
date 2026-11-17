/** Inline status banner. `tone="error"` is announced as an alert. */
export function Notice({ tone = 'info', className = '', children, as: Tag = 'div' }) {
  if (!children) return null;
  return (
    <Tag className={['notice', tone === 'error' && 'error', className].filter(Boolean).join(' ')} role={tone === 'error' ? 'alert' : 'status'}>
      {children}
    </Tag>
  );
}

/** Placeholder for empty lists, with an optional call-to-action. */
export function EmptyState({ title, description, action, compact = false, className = '' }) {
  return (
    <div className={['empty-state', compact && 'compact', className].filter(Boolean).join(' ')}>
      {title && <strong>{title}</strong>}
      {description && <span>{description}</span>}
      {action}
    </div>
  );
}

/** Bulleted list of messages; renders nothing when empty. */
export function MessageList({ messages, className, role }) {
  if (!messages.length) return null;
  return (
    <ul className={className} role={role}>
      {messages.map((message, index) => <li key={`${message}-${index}`}>{message}</li>)}
    </ul>
  );
}

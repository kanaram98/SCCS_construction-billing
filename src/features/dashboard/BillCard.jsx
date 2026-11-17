import { Button } from '../../components/ui';
import { formatCurrency } from '../../domain/formatters.js';
import { paymentStatusLabel } from '../../domain/calculations.js';

export default function BillCard({ bill, summary, selected, onOpen, onDuplicate, onDelete }) {
  return (
    <article className={`card bill-card ${selected ? 'selected' : ''}`}>
      <div>
        <strong>Bill {bill.number} · {bill.projectName || 'Untitled project'}</strong>
        <p>{bill.client || 'No client'} · {bill.date}</p>
        <span className={`payment-status status-${summary.status}`}>{paymentStatusLabel(summary.status)}</span>
      </div>
      <strong>{formatCurrency(summary.totals.total)}</strong>
      <div className="button-row">
        <Button variant="primary" onClick={onOpen}>Open</Button>
        <Button onClick={onDuplicate}>Duplicate</Button>
        <Button variant="danger" onClick={onDelete}>Delete</Button>
      </div>
    </article>
  );
}

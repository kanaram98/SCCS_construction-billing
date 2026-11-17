import { useBilling } from '../../state/BillingContext.jsx';
import { Card, TextField } from '../../components/ui';
import { getRequiredDetailErrors, isBillNumberTaken } from '../../domain/validation.js';
import { text } from '../../domain/formatters.js';
import ClientProfileFields from './ClientProfileFields.jsx';

export default function BillDetailsCard() {
  const { data, bill, actions } = useBilling();
  const updateBill = actions.bills.update;
  const required = getRequiredDetailErrors(bill, data.firm);
  const numberError = !text(bill.number)
    ? 'Bill number is required.'
    : isBillNumberTaken(data.bills, bill) ? 'This bill number is already in use.' : '';

  return (
    <Card title="Bill details">
      <div className="form-grid">
        <TextField
          label="Project / site"
          required
          value={bill.projectName}
          error={required.projectName}
          onChange={(projectName) => updateBill({ projectName })}
        />
        <ClientProfileFields />
        <TextField label="Bill number" required value={bill.number} error={numberError} onChange={(number) => updateBill({ number })} />
        <TextField label="Date" type="date" value={bill.date} onChange={(date) => updateBill({ date })} />
        <TextField label="First level name" value={bill.firstLevelName} onChange={(firstLevelName) => updateBill({ firstLevelName })} />
        <TextField label="Second level name" value={bill.secondLevelName} onChange={(secondLevelName) => updateBill({ secondLevelName })} />
      </div>
    </Card>
  );
}

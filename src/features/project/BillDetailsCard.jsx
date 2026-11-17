import Grid from '@mui/material/Grid';
import { useBilling } from '../../state/BillingContext.jsx';
import { Card, TextField } from '../../components/ui';
import { getRequiredDetailErrors, isBillNumberTaken } from '../../domain/validation.js';
import { text } from '../../domain/formatters.js';
import ClientProfileFields from './ClientProfileFields.jsx';
import { futureDateWarning } from '../../domain/warnings.js';

export default function BillDetailsCard() {
  const { data, bill, actions } = useBilling();
  const update = actions.bills.update;
  const required = getRequiredDetailErrors(bill, data.firm);
  const numberError = !text(bill.number)
    ? 'Bill number is required.'
    : isBillNumberTaken(data.bills, bill) ? 'This bill number is already in use.' : '';

  return (
    <Card title="Bill details">
      <Grid container spacing={2}>
        <Grid size={12}>
          <TextField label="Project / site" required value={bill.projectName} error={required.projectName} onChange={(projectName) => update({ projectName })} />
        </Grid>
        <Grid size={6}>
          <TextField label="Bill number" required value={bill.number} error={numberError} onChange={(number) => update({ number })} />
        </Grid>
        <Grid size={6}>
          <TextField label="Date" type="date" value={bill.date} warning={futureDateWarning(bill.date)} onChange={(date) => update({ date })} />
        </Grid>
        <ClientProfileFields />
        <Grid size={6}>
          <TextField label="First level name" helperText="e.g. Floor" value={bill.firstLevelName} onChange={(firstLevelName) => update({ firstLevelName })} />
        </Grid>
        <Grid size={6}>
          <TextField label="Second level name" helperText="e.g. Room" value={bill.secondLevelName} onChange={(secondLevelName) => update({ secondLevelName })} />
        </Grid>
      </Grid>
    </Card>
  );
}

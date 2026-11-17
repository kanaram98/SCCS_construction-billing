import Grid from '@mui/material/Grid';
import { useBilling } from '../../state/BillingContext.jsx';
import { Card, TextField } from '../../components/ui';
import { getAmountErrors } from '../../domain/validation.js';

export default function AmountsCard() {
  const { data, bill, actions } = useBilling();
  const errors = getAmountErrors(bill, data.rates);
  const update = actions.bills.update;

  return (
    <Card title="Amounts">
      <Grid container spacing={2}>
        <Grid size={{ xs: 6, sm: 4 }}>
          <TextField label="Discount (₹)" type="number" min="0" step="1" value={bill.discount} error={errors.discount} onChange={(discount) => update({ discount })} />
        </Grid>
        <Grid size={{ xs: 6, sm: 4 }}>
          <TextField label="GST %" type="number" min="0" max="100" step="0.01" value={bill.taxRate} error={errors.taxRate} onChange={(taxRate) => update({ taxRate })} />
        </Grid>
        <Grid size={{ xs: 12, sm: 4 }}>
          <TextField label="Advance received (₹)" type="number" min="0" step="1" value={bill.advance} error={errors.advance} onChange={(advance) => update({ advance })} />
        </Grid>
      </Grid>
    </Card>
  );
}

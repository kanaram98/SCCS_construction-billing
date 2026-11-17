import { useBilling } from '../../state/BillingContext.jsx';
import { Card, TextField } from '../../components/ui';
import { getAmountErrors } from '../../domain/validation.js';

export default function AmountsCard() {
  const { data, bill, actions } = useBilling();
  const errors = getAmountErrors(bill, data.rates);
  const update = actions.bills.update;

  return (
    <Card title="Amounts">
      <div className="form-grid">
        <TextField label="Discount (₹)" type="number" min="0" step="1" value={bill.discount} error={errors.discount} onChange={(discount) => update({ discount })} />
        <TextField label="GST %" type="number" min="0" max="100" step="0.01" value={bill.taxRate} error={errors.taxRate} onChange={(taxRate) => update({ taxRate })} />
        <TextField label="Advance received (₹)" type="number" min="0" step="1" value={bill.advance} error={errors.advance} onChange={(advance) => update({ advance })} />
      </div>
    </Card>
  );
}

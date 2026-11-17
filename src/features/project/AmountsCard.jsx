import Grid from '@mui/material/Grid';
import { useBilling } from '../../state/BillingContext.jsx';
import { Card, SelectField, TextField } from '../../components/ui';
import { getAmountErrors } from '../../domain/validation.js';
import { GST_TYPES, getBillTotals, getTaxLines } from '../../domain/calculations.js';
import { formatCurrency } from '../../domain/formatters.js';
import { tr as t } from '../../i18n/translate.js';

export default function AmountsCard() {
  const { data, bill, actions } = useBilling();
  const errors = getAmountErrors(bill, data.rates);
  const update = actions.bills.update;
  const taxLines = getTaxLines(bill, getBillTotals(bill, data.rates));

  return (
    <Card title={t('Amounts')}>
      <Grid container spacing={2}>
        <Grid size={{ xs: 6, sm: 6 }}>
          <TextField label={t('Discount (₹)')} type="number" min="0" step="1" value={bill.discount} error={errors.discount} onChange={(discount) => update({ discount })} />
        </Grid>
        <Grid size={{ xs: 6, sm: 6 }}>
          <TextField label={t('GST %')} type="number" min="0" max="100" step="0.01" value={bill.taxRate} error={errors.taxRate} onChange={(taxRate) => update({ taxRate })} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <SelectField
            label={t('GST type')}
            value={bill.gstType || 'intra'}
            options={GST_TYPES}
            onChange={(gstType) => update({ gstType })}
            helperText={taxLines.map((line) => `${line.label}: ${formatCurrency(line.amount)}`).join(' · ') || t('Enter a GST % to add tax.')}
          />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField label={t('Advance received (₹)')} type="number" min="0" step="1" value={bill.advance} error={errors.advance} onChange={(advance) => update({ advance })} />
        </Grid>
      </Grid>
    </Card>
  );
}

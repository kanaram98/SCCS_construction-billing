import Box from '@mui/material/Box';
import Grid from '@mui/material/Grid';
import { useBilling } from '../../state/BillingContext.jsx';
import { Card, SelectField, SwitchField, TextField } from '../../components/ui';
import { getAmountErrors } from '../../domain/validation.js';
import { GST_TYPES, getBillTotals, getTaxLines, hasGst } from '../../domain/calculations.js';
import { isEstimate } from '../../domain/bill-kinds.js';
import { canTakePayment, isEntryLocked } from '../../domain/bill-guard.js';
import { formatCurrency } from '../../domain/formatters.js';
import { tr as t } from '../../i18n/translate.js';

export default function AmountsCard() {
  const { data, bill, actions } = useBilling();
  const errors = getAmountErrors(bill, data.rates);
  const update = actions.bills.update;
  const taxLines = getTaxLines(bill, getBillTotals(bill, data.rates));
  const locked = isEntryLocked(bill); // ready, submitted or cancelled: prices, discount and GST are frozen

  return (
    <Card title={t('Amounts')}>
      <Grid container spacing={2}>
        <Grid size={{ xs: 6, sm: 6 }}>
          <TextField label={t('Discount (₹)')} type="number" min="0" step="1" value={bill.discount} disabled={locked} error={errors.discount} onChange={(discount) => update({ discount })} />
        </Grid>
        {!isEstimate(bill) && <Grid size={{ xs: 6, sm: 6 }}>
          <TextField label={t('Advance received (₹)')} type="number" min="0" step="1" value={bill.advance} disabled={!canTakePayment(bill)} helperText={bill.status === 'draft' || !bill.status ? t('Mark the bill ready to record an advance.') : undefined} error={errors.advance} onChange={(advance) => update({ advance })} />
        </Grid>}
        <Grid size={12}>
          <Box component="fieldset" disabled={locked} sx={{ border: 0, p: 0, m: 0, minWidth: 0 }}>
          <Grid container spacing={2}>
        <Grid size={12}>
          <SwitchField label={t('Add GST to this bill')} checked={hasGst(bill)} onChange={(gstEnabled) => update({ gstEnabled })} />
        </Grid>
        {hasGst(bill) && (<>
        <Grid size={{ xs: 12, sm: 6 }}>
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
        </>)}
          </Grid>
          </Box>
        </Grid>
      </Grid>
    </Card>
  );
}

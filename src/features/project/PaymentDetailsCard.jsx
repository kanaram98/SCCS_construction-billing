import Grid from '@mui/material/Grid';
import { useBilling } from '../../state/BillingContext.jsx';
import { Card, TextField } from '../../components/ui';
import { getPaymentFieldErrors } from '../../domain/payment-details.js';
import { tr as t } from '../../i18n/translate.js';

/** Bank and UPI details printed on bills (with a UPI QR code when a UPI ID is set). */
export default function PaymentDetailsCard() {
  const { data, actions } = useBilling();
  const { firm } = data;
  const update = actions.firm.update;
  const errors = getPaymentFieldErrors(firm);

  return (
    <Card
      title={t('Payment details')}
      description={t('Printed on the bill and summary. Add a UPI ID to print a QR code clients can scan to pay the balance.')}
    >
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField label={t('UPI ID')} value={firm.upiId} placeholder={t('name@okbank')} error={errors.upiId} inputMode="email" onChange={(upiId) => update({ upiId: upiId.trim() })} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField label={t('Account holder')} value={firm.accountName} onChange={(accountName) => update({ accountName })} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField label={t('Bank name')} value={firm.bankName} onChange={(bankName) => update({ bankName })} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField label={t('Account number')} value={firm.accountNumber} inputMode="numeric" error={errors.accountNumber} onChange={(accountNumber) => update({ accountNumber })} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <TextField label={t('IFSC')} value={firm.ifsc} placeholder={t('SBIN0001234')} error={errors.ifsc} onChange={(ifsc) => update({ ifsc: ifsc.toUpperCase() })} />
        </Grid>
      </Grid>
    </Card>
  );
}

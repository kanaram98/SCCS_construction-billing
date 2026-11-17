import Grid from '@mui/material/Grid';
import { useBilling } from '../../state/BillingContext.jsx';
import { Card, ImageUploadField, TextField, useNotify } from '../../components/ui';
import { getRequiredDetailErrors } from '../../domain/validation.js';
import { optimizeImage } from '../../services/image.js';
import { gstinWarning, phoneWarning } from '../../domain/warnings.js';
import { tr as t } from '../../i18n/translate.js';

const IMAGE_LABELS = { logo: 'Firm logo', signature: 'Signature' };

export default function FirmCard() {
  const { data, bill, actions } = useBilling();
  const notify = useNotify();
  const { firm } = data;
  const update = actions.firm.update;
  const nameError = getRequiredDetailErrors(bill, firm).firmName;

  async function uploadImage(field, file) {
    try {
      update({ [field]: await optimizeImage(file) });
      notify(t('{item} saved on this device.', { item: t(IMAGE_LABELS[field]) }));
    } catch (error) {
      console.error(`Could not save firm ${field}.`, error);
      notify(error.message || `Could not save firm ${field}.`, 'error');
    }
  }

  return (
    <Card title={t('Your firm')} description={t('Saved on this device and reused on every bill and PDF.')}>
      <Grid container spacing={2}>
        <Grid size={12}>
          <TextField label={t('Firm name')} required value={firm.name} error={nameError} onChange={(name) => update({ name })} />
        </Grid>
        <Grid size={12}>
          <TextField label={t('Address')} value={firm.address} onChange={(address) => update({ address })} />
        </Grid>
        <Grid size={6}>
          <TextField label={t('Phone')} type="tel" value={firm.phone} warning={phoneWarning(firm.phone)} onChange={(phone) => update({ phone })} />
        </Grid>
        <Grid size={6}>
          <TextField label={t('GSTIN')} value={firm.gstin} warning={gstinWarning(firm.gstin)} onChange={(gstin) => update({ gstin: gstin.toUpperCase() })} />
        </Grid>
        {Object.entries(IMAGE_LABELS).map(([field, label]) => (
          <Grid size={{ xs: 12, sm: 6 }} key={field}>
            <ImageUploadField
              label={t(label)}
              variant={field === 'signature' ? 'signature' : 'default'}
              value={firm[field]}
              onSelect={(file) => uploadImage(field, file)}
              onRemove={() => update({ [field]: '' })}
            />
          </Grid>
        ))}
      </Grid>
    </Card>
  );
}

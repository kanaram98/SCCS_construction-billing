import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import PersonAddIcon from '@mui/icons-material/PersonAddAlt1Outlined';
import SaveIcon from '@mui/icons-material/SaveOutlined';
import PersonRemoveIcon from '@mui/icons-material/PersonRemoveOutlined';
import { useBilling } from '../../state/BillingContext.jsx';
import { SelectField, TextField, useNotify } from '../../components/ui';
import { useUndoable } from '../../hooks/useUndoable.js';
import { getClientProfileState } from '../../domain/clients.js';
import { getRequiredDetailErrors } from '../../domain/validation.js';
import { gstinWarning, phoneWarning } from '../../domain/warnings.js';
import { tr as t } from '../../i18n/translate.js';

/** Client fields for the bill plus saved-profile management. Renders grid items. */
export default function ClientProfileFields() {
  const { data, bill, actions } = useBilling();
  const notify = useNotify();
  const undoable = useUndoable();
  const profile = getClientProfileState(bill, data.clients);
  const nameError = getRequiredDetailErrors(bill, data.firm).client ||
    (profile.duplicateClient ? 'This name is already saved. Select the existing profile or use another name.' : '');
  const update = actions.bills.update;

  function saveProfile(updateExisting) {
    const result = actions.clients.saveProfile(updateExisting);
    notify(result.message, result.ok ? 'success' : 'error');
  }

  /** Bills keep their copied client details when the profile is removed. */
  function removeProfile() {
    const { selectedClient } = profile;
    if (!selectedClient) return;
    undoable(t('Saved client “{name}” removed.', { name: selectedClient.name }), () => actions.clients.removeProfile(selectedClient.id));
  }

  return (
    <>
      <Grid size={12}>
        <SelectField
          label={t('Client profile')}
          value={bill.clientId || ''}
          placeholder={t('Custom / unsaved client')}
          options={data.clients.map((client) => ({ value: client.id, label: client.name }))}
          onChange={actions.clients.select}
          helperText={t('Saved profiles fill in the client details below.')}
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6 }}>
        <TextField label={t('Client name')} required value={bill.client} error={nameError} onChange={(client) => update({ client })} />
      </Grid>
      <Grid size={{ xs: 12, sm: 6 }}>
        <TextField label={t('Client phone')} type="tel" value={bill.clientPhone} warning={phoneWarning(bill.clientPhone)} onChange={(clientPhone) => update({ clientPhone })} />
      </Grid>
      <Grid size={{ xs: 12, sm: 6 }}>
        <TextField label={t('Client address')} value={bill.clientAddress} onChange={(clientAddress) => update({ clientAddress })} />
      </Grid>
      <Grid size={{ xs: 12, sm: 6 }}>
        <TextField label={t('Client GSTIN')} value={bill.clientGstin} warning={gstinWarning(bill.clientGstin)} onChange={(clientGstin) => update({ clientGstin: clientGstin.toUpperCase() })} />
      </Grid>
      <Grid size={12}>
        <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1 }}>
          <Button size="small" variant="outlined" startIcon={<PersonAddIcon />} disabled={!profile.canSaveNew} onClick={() => saveProfile(false)}>{t('Save as new')}</Button>
          <Button size="small" variant="outlined" startIcon={<SaveIcon />} disabled={!profile.canUpdate} onClick={() => saveProfile(true)}>{t('Update saved')}</Button>
          <Button size="small" color="error" startIcon={<PersonRemoveIcon />} disabled={!profile.selectedClient} onClick={removeProfile}>{t('Remove saved')}</Button>
        </Stack>
        {profile.duplicateClient && (
          <Typography variant="caption" color="text.secondary">{t('This client name already exists in saved profiles.')}</Typography>
        )}
      </Grid>
    </>
  );
}

import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import PersonAddIcon from '@mui/icons-material/PersonAddAlt1Outlined';
import SaveIcon from '@mui/icons-material/SaveOutlined';
import PersonRemoveIcon from '@mui/icons-material/PersonRemoveOutlined';
import { useBilling } from '../../state/BillingContext.jsx';
import { SelectField, TextField, useConfirm, useNotify } from '../../components/ui';
import { getClientProfileState } from '../../domain/clients.js';
import { getRequiredDetailErrors } from '../../domain/validation.js';

/** Client fields for the bill plus saved-profile management. Renders grid items. */
export default function ClientProfileFields() {
  const { data, bill, actions } = useBilling();
  const notify = useNotify();
  const confirm = useConfirm();
  const profile = getClientProfileState(bill, data.clients);
  const nameError = getRequiredDetailErrors(bill, data.firm).client ||
    (profile.duplicateClient ? 'This name is already saved. Select the existing profile or use another name.' : '');
  const update = actions.bills.update;

  function saveProfile(updateExisting) {
    const result = actions.clients.saveProfile(updateExisting);
    notify(result.message, result.ok ? 'success' : 'error');
  }

  async function removeProfile() {
    const { selectedClient } = profile;
    if (!selectedClient) return;
    const confirmed = await confirm({
      title: `Remove saved client “${selectedClient.name}”?`,
      message: 'Existing bills will keep their client details.',
      confirmLabel: 'Remove',
      danger: true
    });
    if (!confirmed) return;
    actions.clients.removeProfile(selectedClient.id);
    notify('Saved client removed. Existing bill details were kept.', 'info');
  }

  return (
    <>
      <Grid size={12}>
        <SelectField
          label="Client profile"
          value={bill.clientId || ''}
          placeholder="Custom / unsaved client"
          options={data.clients.map((client) => ({ value: client.id, label: client.name }))}
          onChange={actions.clients.select}
          helperText="Saved profiles fill in the client details below."
        />
      </Grid>
      <Grid size={{ xs: 12, sm: 6 }}>
        <TextField label="Client name" required value={bill.client} error={nameError} onChange={(client) => update({ client })} />
      </Grid>
      <Grid size={{ xs: 12, sm: 6 }}>
        <TextField label="Client phone" type="tel" value={bill.clientPhone} onChange={(clientPhone) => update({ clientPhone })} />
      </Grid>
      <Grid size={{ xs: 12, sm: 6 }}>
        <TextField label="Client address" value={bill.clientAddress} onChange={(clientAddress) => update({ clientAddress })} />
      </Grid>
      <Grid size={{ xs: 12, sm: 6 }}>
        <TextField label="Client GSTIN" value={bill.clientGstin} onChange={(clientGstin) => update({ clientGstin })} />
      </Grid>
      <Grid size={12}>
        <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1 }}>
          <Button size="small" variant="outlined" startIcon={<PersonAddIcon />} disabled={!profile.canSaveNew} onClick={() => saveProfile(false)}>Save as new</Button>
          <Button size="small" variant="outlined" startIcon={<SaveIcon />} disabled={!profile.canUpdate} onClick={() => saveProfile(true)}>Update saved</Button>
          <Button size="small" color="error" startIcon={<PersonRemoveIcon />} disabled={!profile.selectedClient} onClick={removeProfile}>Remove saved</Button>
        </Stack>
        {profile.duplicateClient && (
          <Typography variant="caption" color="text.secondary">This client name already exists in saved profiles.</Typography>
        )}
      </Grid>
    </>
  );
}

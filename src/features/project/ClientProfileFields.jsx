import { useState } from 'react';
import { useBilling } from '../../state/BillingContext.jsx';
import { Button, SelectField, TextField } from '../../components/ui';
import { getClientProfileState } from '../../domain/clients.js';
import { getRequiredDetailErrors } from '../../domain/validation.js';

/**
 * Client fields for the bill plus saved-profile management.
 * Renders as fragments inside the parent form grid.
 */
export default function ClientProfileFields() {
  const { data, bill, actions } = useBilling();
  const [message, setMessage] = useState('');
  const profile = getClientProfileState(bill, data.clients);
  const nameError = getRequiredDetailErrors(bill, data.firm).client ||
    (profile.duplicateClient ? 'This name is already saved. Select the existing profile or use another name.' : '');

  /** Editing any client field clears the last profile message. */
  const updateClient = (patch) => {
    setMessage('');
    actions.bills.update(patch);
  };

  function selectClient(clientId) {
    setMessage('');
    actions.clients.select(clientId);
  }

  function saveProfile(updateExisting) {
    setMessage(actions.clients.saveProfile(updateExisting).message);
  }

  function removeProfile() {
    const { selectedClient } = profile;
    if (!selectedClient) return;
    if (!window.confirm(`Remove saved client "${selectedClient.name}"? Existing bills will keep their saved details.`)) return;
    actions.clients.removeProfile(selectedClient.id);
    setMessage('Saved client removed. Existing bill details were kept.');
  }

  return (
    <>
      <SelectField
        className="client-profile-select"
        label="Client profile"
        value={bill.clientId || ''}
        placeholder="Custom / unsaved client"
        options={data.clients.map((client) => ({ value: client.id, label: client.name }))}
        onChange={selectClient}
      />
      <TextField label="Client name" required value={bill.client} error={nameError} onChange={(client) => updateClient({ client })} />
      <TextField label="Client phone" value={bill.clientPhone} onChange={(clientPhone) => updateClient({ clientPhone })} />
      <TextField label="Client address" value={bill.clientAddress} onChange={(clientAddress) => updateClient({ clientAddress })} />
      <TextField label="Client GSTIN" value={bill.clientGstin} onChange={(clientGstin) => updateClient({ clientGstin })} />
      <div className="client-profile-actions">
        <Button disabled={!profile.canSaveNew} onClick={() => saveProfile(false)}>Save as new client</Button>
        <Button disabled={!profile.canUpdate} onClick={() => saveProfile(true)}>Update saved client</Button>
        <Button variant="danger" disabled={!profile.selectedClient} onClick={removeProfile}>Remove saved client</Button>
      </div>
      <p className="client-profile-status" role="status">
        {message || (profile.duplicateClient
          ? 'This client name already exists in saved profiles.'
          : 'Saved profiles are available when creating future bills.')}
      </p>
    </>
  );
}

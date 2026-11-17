import { sameText, text } from './formatters.js';

/** Bill fields that are copied from / saved to a client profile. */
export function clientDetailsPatch(client) {
  return {
    clientId: client.id,
    client: client.name,
    clientPhone: client.phone || '',
    clientAddress: client.address || '',
    clientGstin: client.gstin || ''
  };
}

export function clientFromBill(bill, id) {
  return {
    id,
    name: text(bill.client),
    phone: text(bill.clientPhone),
    address: text(bill.clientAddress),
    gstin: text(bill.clientGstin)
  };
}

/**
 * Describes how the bill's client details relate to saved profiles:
 * which profile is linked, and whether the typed name clashes with another one.
 */
export function getClientProfileState(bill, clients) {
  const name = text(bill.client);
  const selectedClient = clients.find((client) => client.id === bill.clientId) || null;
  const sameNameClient = name ? clients.find((client) => sameText(client.name, name)) : undefined;
  const duplicateClient = Boolean(sameNameClient && sameNameClient.id !== bill.clientId);
  return {
    selectedClient,
    sameNameClient,
    duplicateClient,
    canSaveNew: Boolean(name) && !sameNameClient,
    canUpdate: Boolean(selectedClient && name && !duplicateClient)
  };
}

/**
 * Checks whether the bill's client can be saved as a new profile or used to
 * update the linked one. Returns an error message, or '' when allowed.
 */
export function getClientSaveError(bill, clients, updateExisting) {
  const state = getClientProfileState(bill, clients);
  if (!text(bill.client)) return 'Enter a client name before saving the profile.';
  if (updateExisting && !state.selectedClient) return 'Select a saved client before updating it.';
  if (updateExisting ? state.duplicateClient : state.sameNameClient) {
    return 'A client with this name is already saved. Select that profile or change the name.';
  }
  return '';
}

import { useEffect, useState } from 'react';
import { loadState, saveState } from '../services/storage.js';
import { selectActiveBill } from '../domain/app-state.js';
import { createActions } from './actions.js';

export const SAVE_STATUS = Object.freeze({
  saving: 'Saving…',
  saved: 'Saved on this device',
  failed: 'Save failed'
});

/**
 * Owns the persisted application state, saves it on every change and exposes
 * the actions that modify it.
 */
export function useBillingStore() {
  const [initial] = useState(loadState);
  const [data, setData] = useState(initial.state);
  const [storageError, setStorageError] = useState(initial.warning);
  const [saveStatus, setSaveStatus] = useState(SAVE_STATUS.saving);

  useEffect(() => {
    try {
      saveState(data);
      setStorageError('');
      setSaveStatus(SAVE_STATUS.saved);
    } catch (error) {
      console.error('Could not save billing data.', error);
      setStorageError('Could not save changes on this device. Check available browser storage.');
      setSaveStatus(SAVE_STATUS.failed);
    }
  }, [data]);

  const bill = selectActiveBill(data);
  const actions = createActions({ data, bill, setData });

  return { data, bill, actions, saveStatus, storageError };
}

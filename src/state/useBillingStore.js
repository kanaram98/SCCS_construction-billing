import { useCallback, useEffect, useMemo, useState } from 'react';
import { repository } from '../services/repository.js';
import { selectActiveBill } from '../domain/app-state.js';
import { liveState, recordChanges } from '../domain/history.js';
import { createActions } from './actions.js';

export const SAVE_STATUS = Object.freeze({
  saving: 'Saving…',
  saved: 'Saved on this device',
  failed: 'Save failed'
});

/**
 * Owns the application state, saves it on every change and exposes the
 * actions that modify it.
 *
 * `raw` is what gets saved: it still holds deleted records and the history
 * log. Screens and actions get `data`, the live view without deleted
 * records. Every change made through `setData` is recorded by
 * `recordChanges` (versions, soft deletes, history).
 */
export function useBillingStore() {
  const [initial] = useState(() => repository.load());
  const [raw, setRaw] = useState(initial.state);
  const [storageError, setStorageError] = useState(initial.warning);
  const [saveStatus, setSaveStatus] = useState(SAVE_STATUS.saving);
  const data = useMemo(() => liveState(raw), [raw]);

  useEffect(() => {
    try {
      repository.save(raw);
      setStorageError('');
      setSaveStatus(SAVE_STATUS.saved);
    } catch (error) {
      console.error('Could not save billing data.', error);
      setStorageError('Could not save changes on this device. Check available browser storage.');
      setSaveStatus(SAVE_STATUS.failed);
    }
  }, [raw]);

  /** Changes the live data with `(live) => nextLive`; the change is recorded. */
  const setData = useCallback((change) => setRaw((current) => {
    const live = liveState(current);
    const next = change(live);
    return next === live ? current : recordChanges(current, next, new Date());
  }), []);

  const bill = selectActiveBill(data);
  const actions = createActions({ data, bill, setData, setRaw });

  return { data, raw, bill, actions, saveStatus, storageError };
}

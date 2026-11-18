import { STORAGE_KEYS } from '../config/app.js';
import { createInitialState, hydrateState } from '../domain/app-state.js';

function readJson(key) {
  const saved = window.localStorage.getItem(key);
  return saved ? JSON.parse(saved) : null;
}

/** The copy of data that could not be read is kept under another name, so the next save cannot overwrite it. */
export const UNREADABLE_KEY = `${STORAGE_KEYS.state}_unreadable`;
function keepUnreadable() {
  try {
    const saved = window.localStorage.getItem(STORAGE_KEYS.state);
    if (saved && !window.localStorage.getItem(UNREADABLE_KEY)) window.localStorage.setItem(UNREADABLE_KEY, saved);
  } catch { /* nothing more can be done */ }
}

/**
 * Loads saved state from this device.
 * @returns {{ state: import('../domain/app-state.js').AppState, warning: string }}
 */
export function loadState() {
  try {
    return { state: hydrateState(readJson(STORAGE_KEYS.state)) || createInitialState(), warning: '' };
  } catch (error) {
    console.error('Could not load saved billing data.', error);
    keepUnreadable();
    return {
      state: createInitialState(),
      warning: 'Saved data could not be loaded. The app opened a new bill instead. The old data was kept aside, not erased.'
    };
  }
}

/** @throws when browser storage is full or unavailable */
export function saveState(state) {
  window.localStorage.setItem(STORAGE_KEYS.state, JSON.stringify(state));
}

/** Asks the browser not to clear this app's data when the phone is short of space (it can refuse; that is fine). */
export function requestPersistentStorage() {
  try { navigator.storage?.persist?.(); } catch { /* optional */ }
}

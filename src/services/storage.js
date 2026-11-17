import { STORAGE_KEYS } from '../config/app.js';
import { createInitialState, hydrateState } from '../domain/app-state.js';

function readJson(key) {
  const saved = window.localStorage.getItem(key);
  return saved ? JSON.parse(saved) : null;
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
    return {
      state: createInitialState(),
      warning: 'Saved data could not be loaded. The app opened a new bill instead.'
    };
  }
}

/** @throws when browser storage is full or unavailable */
export function saveState(state) {
  window.localStorage.setItem(STORAGE_KEYS.state, JSON.stringify(state));
}

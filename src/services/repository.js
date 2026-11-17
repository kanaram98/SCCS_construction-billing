/**
 * Where the app's data is kept. Every load and save goes through here.
 *
 * Today the only store is this device (localStorage). Phase B1 adds a cloud
 * repository (Firebase) behind the same interface, so screens and actions
 * don't change:
 *
 *   repository.load()       → { state, warning }   state is the raw state (with deleted records and history)
 *   repository.save(state)  → throws when the device storage is full or unavailable
 */
import { loadState, saveState } from './storage.js';

export function createLocalRepository() {
  return {
    kind: 'local',
    load: loadState,
    save: saveState
  };
}

export const repository = createLocalRepository();

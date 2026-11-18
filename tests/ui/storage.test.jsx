import { beforeEach, describe, expect, it } from 'vitest';
import { STORAGE_KEYS } from '../../src/config/app.js';
import { UNREADABLE_KEY, loadState, saveState } from '../../src/services/storage.js';

describe('unreadable saved data', () => {
  beforeEach(() => window.localStorage.clear());

  it('is kept aside so the next save cannot overwrite it', () => {
    window.localStorage.setItem(STORAGE_KEYS.state, '{"broken json');
    const loaded = loadState();
    expect(loaded.warning).toMatch(/could not be loaded/);
    expect(window.localStorage.getItem(UNREADABLE_KEY)).toBe('{"broken json');
    saveState(loaded.state);
    expect(window.localStorage.getItem(UNREADABLE_KEY)).toBe('{"broken json');
    expect(window.localStorage.getItem(STORAGE_KEYS.state)).not.toBe('{"broken json');
  });
});

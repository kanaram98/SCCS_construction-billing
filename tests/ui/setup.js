/**
 * jsdom polyfills for the UI tests. The viewport is phone-sized (390px) so the
 * mobile layout (bottom navigation, full-screen dialogs) is what gets tested.
 */
import { afterEach, beforeEach } from 'vitest';
import { cleanup } from '@testing-library/react';

const VIEWPORT_WIDTH = 390;

function evaluateMediaQuery(query) {
  const text = query.replace(/^@media\s*/, '');
  if (text.includes('prefers-color-scheme: dark')) return false;
  const max = text.match(/max-width:\s*([\d.]+)px/);
  const min = text.match(/min-width:\s*([\d.]+)px/);
  return (!max || VIEWPORT_WIDTH <= Number(max[1])) && (!min || VIEWPORT_WIDTH >= Number(min[1]));
}

Object.defineProperty(window, 'innerWidth', { configurable: true, value: VIEWPORT_WIDTH });
window.matchMedia = (query) => ({
  matches: evaluateMediaQuery(query),
  media: query,
  onchange: null,
  addListener() {},
  removeListener() {},
  addEventListener() {},
  removeEventListener() {},
  dispatchEvent: () => false
});
window.ResizeObserver = class {
  observe() {}
  unobserve() {}
  disconnect() {}
};
window.scrollTo = () => {};
Element.prototype.scrollIntoView = () => {};

beforeEach(() => window.localStorage.clear());
afterEach(() => cleanup());

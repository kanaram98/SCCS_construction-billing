/**
 * Default firm branding, bundled with the app (works offline).
 * Applied once to a firm whose logo, signature or name is empty.
 */
import logo from '../assets/brand/logo.png?inline';
import mark from '../assets/brand/mark.png?inline';
import signature from '../assets/brand/signature.png?inline';

/** The firm's S mark: the application logo (top bar, menu, app icon). */
export const APP_MARK = mark;

export const DEFAULT_BRANDING = Object.freeze({
  name: 'SCCS Civil & Construction',
  logo,
  signature,
  /** Brand colours from the logo, used for the bill letterhead stripe. */
  colors: { orange: '#ec6b35', amber: '#f7a547', green: '#5a8f3c' }
});

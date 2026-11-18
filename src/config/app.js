/** Application-wide configuration constants. */

export const APP_NAME = 'Construction Billing';

export const STORAGE_KEYS = Object.freeze({
  state: 'construction_billing_react_v1'
});

export const IMAGE_UPLOAD = Object.freeze({
  acceptedTypes: ['image/png', 'image/jpeg'],
  maxFileBytes: 5 * 1024 * 1024,
  maxDataUrlLength: 512 * 1024,
  maxWidth: 1200,
  maxHeight: 900,
  jpegQuality: 0.84
});

export const VIEWS = Object.freeze({
  home: 'home',
  projects: 'projects',
  expenses: 'expenses',
  firm: 'firm',
  bills: 'bills',
  entry: 'entry',
  rates: 'rates',
  project: 'project',
  print: 'print',
  labour: 'labour',
  settings: 'settings'
});

/** Main tabs (bottom bar on phones). Settings opens from the header ⚙ and the desktop sidebar. */
export const NAVIGATION = Object.freeze([
  { id: VIEWS.home, label: 'Home' },
  { id: VIEWS.projects, label: 'Projects' },
  { id: VIEWS.bills, label: 'Bills' },
  { id: VIEWS.entry, label: 'Entry' },
  { id: VIEWS.labour, label: 'Labour' },
  { id: VIEWS.expenses, label: 'Expenses' },
  { id: VIEWS.rates, label: 'Rates' },
  { id: VIEWS.firm, label: 'Firm' },
  { id: VIEWS.project, label: 'Bill details' },
  { id: VIEWS.print, label: 'PDF / Print', shortLabel: 'PDF' }
]);

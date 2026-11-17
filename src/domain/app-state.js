import { DEFAULT_RATES } from './rates.js';
import { createBill } from './factories.js';
import { DEFAULT_SIGNATURE_LAYOUT, normalizeSignatureLayout } from './signature-layout.js';
import { createDefaultPrintSettings, normalizePrintSettings } from './print-settings.js';
import { createDefaultQuotation, normalizeQuotation } from './quotation.js';
import { createLabourState, normalizeLabour } from './labour.js';

/**
 * Shape of the persisted application state.
 * @typedef {{
 *   bills: object[], activeBillId: string, rates: object[], clients: object[],
 *   firm: object, templates: object[], printSettings: object
 * }} AppState
 */

let defaultBranding = { name: '', logo: '', signature: '' };

/** Sets the logo/signature/name that new or empty firms start with (called at app start-up). */
export function setDefaultBranding(branding) {
  defaultBranding = { ...defaultBranding, ...branding };
}

/** Fills empty firm fields with the default branding, once (so removing them later sticks). */
function applyDefaultBranding(firm) {
  if (firm.brandingApplied) return firm;
  return {
    ...firm,
    name: firm.name || defaultBranding.name || '',
    logo: firm.logo || defaultBranding.logo || '',
    signature: firm.signature || defaultBranding.signature || '',
    brandingApplied: Boolean(defaultBranding.logo || defaultBranding.signature || defaultBranding.name)
  };
}

export function createDefaultFirm() {
  return {
    name: '',
    address: '',
    phone: '',
    gstin: '',
    /** Registered firms get GST on new bills and show their GSTIN. */
    gstRegistered: false,
    bankName: '',
    accountName: '',
    accountNumber: '',
    ifsc: '',
    upiId: '',
    logo: '',
    signature: '',
    signatureLayout: { ...DEFAULT_SIGNATURE_LAYOUT }
  };
}

/** @returns {AppState} */
export function createInitialState() {
  const bill = createBill();
  return {
    bills: [bill],
    activeBillId: bill.id,
    rates: DEFAULT_RATES.map((rate) => ({ ...rate })),
    clients: [],
    firm: applyDefaultBranding(createDefaultFirm()),
    templates: [],
    printSettings: createDefaultPrintSettings(),
    meta: { lastBackupAt: '', onboarded: false },
    preferences: { language: 'en', textSize: 'normal' },
    quotation: createDefaultQuotation(),
    labour: createLabourState()
  };
}

const arrayOr = (value, fallback = []) => Array.isArray(value) ? value : fallback;

/**
 * Normalises previously saved state, filling in fields added in later versions.
 * Returns `null` when the data has no bills to restore.
 * @returns {AppState | null}
 */
export function hydrateState(saved) {
  if (!saved || !Array.isArray(saved.bills) || !saved.bills.length) return null;
  const defaults = createInitialState();
  const firm = applyDefaultBranding({ ...createDefaultFirm(), ...saved.firm });
  firm.signatureLayout = normalizeSignatureLayout(firm.signatureLayout);
  // Data from before the GST switch: treat the firm as registered if it already used GST.
  if (typeof saved.firm?.gstRegistered !== 'boolean') {
    firm.gstRegistered = Boolean(String(firm.gstin || '').trim()) ||
      saved.bills.some((bill) => Number(bill.taxRate) > 0);
  }

  // People who already have bills have seen the app: skip the welcome screen.
  const savedMeta = saved.meta && typeof saved.meta === 'object' ? saved.meta : {};
  const onboarded = typeof savedMeta.onboarded === 'boolean'
    ? savedMeta.onboarded
    : saved.bills.length > 1 || saved.bills.some((bill) => (bill.sections || []).length > 0 || String(bill.projectName || '').trim());

  const activeExists = saved.bills.some((bill) => bill.id === saved.activeBillId);
  return {
    ...defaults,
    ...saved,
    rates: arrayOr(saved.rates, defaults.rates),
    clients: arrayOr(saved.clients),
    firm,
    templates: arrayOr(saved.templates),
    printSettings: normalizePrintSettings(saved.printSettings),
    meta: { ...defaults.meta, ...savedMeta, onboarded },
    quotation: normalizeQuotation(saved.quotation),
    labour: normalizeLabour(saved.labour),
    preferences: { ...defaults.preferences, ...(saved.preferences && typeof saved.preferences === 'object' ? saved.preferences : {}) },
    activeBillId: activeExists ? saved.activeBillId : saved.bills[0].id
  };
}

export function selectActiveBill(state) {
  return state.bills.find((bill) => bill.id === state.activeBillId) || state.bills[0];
}

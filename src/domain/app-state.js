import { DEFAULT_RATES } from './rates.js';
import { createBill } from './factories.js';
import { DEFAULT_SIGNATURE_LAYOUT, normalizeSignatureLayout } from './signature-layout.js';
import { createDefaultPrintSettings, normalizePrintSettings } from './print-settings.js';

/**
 * Shape of the persisted application state.
 * @typedef {{
 *   bills: object[], activeBillId: string, rates: object[], clients: object[],
 *   firm: object, templates: object[], printSettings: object
 * }} AppState
 */

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
    firm: createDefaultFirm(),
    templates: [],
    printSettings: createDefaultPrintSettings(),
    meta: { lastBackupAt: '', onboarded: false },
    preferences: { language: 'en', textSize: 'normal' }
  };
}

const arrayOr = (value, fallback = []) => Array.isArray(value) ? value : fallback;

/**
 * Normalises previously saved state, filling in fields added in later versions.
 * Returns `null` when the data has no bills to restore.
 * @returns {AppState | null}
 */
export function hydrateState(saved, { isLegacy = false } = {}) {
  if (!saved || !Array.isArray(saved.bills) || !saved.bills.length) return null;
  const defaults = createInitialState();
  const firm = { ...defaults.firm, ...saved.firm };

  // Before print settings existed, the signature x offset was measured from a narrower footer box.
  if (!isLegacy && !saved.printSettings && saved.firm?.signatureLayout) {
    firm.signatureLayout = {
      ...saved.firm.signatureLayout,
      x: Number(saved.firm.signatureLayout.x || 0) + 28
    };
  }
  firm.signatureLayout = normalizeSignatureLayout(firm.signatureLayout);
  // Data from before the GST switch: treat the firm as registered if it already used GST.
  if (typeof saved.firm?.gstRegistered !== 'boolean') {
    firm.gstRegistered = Boolean(String(firm.gstin || '').trim()) ||
      saved.bills.some((bill) => Number(bill.taxRate) > 0);
  }
  // The original app stored bank details as one free-text `bank` field.
  if (!firm.bankName && typeof firm.bank === 'string' && firm.bank.trim()) firm.bankName = firm.bank.trim();

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
    templates: isLegacy ? [] : arrayOr(saved.templates),
    printSettings: normalizePrintSettings(saved.printSettings, saved.pdfDocuments, firm.signatureLayout),
    meta: { ...defaults.meta, ...savedMeta, onboarded },
    preferences: { ...defaults.preferences, ...(saved.preferences && typeof saved.preferences === 'object' ? saved.preferences : {}) },
    activeBillId: activeExists ? saved.activeBillId : saved.bills[0].id
  };
}

export function selectActiveBill(state) {
  return state.bills.find((bill) => bill.id === state.activeBillId) || state.bills[0];
}

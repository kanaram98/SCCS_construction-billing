/**
 * State actions, grouped by feature.
 *
 * Every write goes through a functional `setData` update so it applies to the
 * latest state. Reads that need to return something to the caller (a created
 * section, a copy result) use the current render's `data` / `bill` snapshot.
 */
import * as tree from '../domain/bill-tree.js';
import {
  createArea,
  createBill,
  createItem,
  createSection,
  duplicateBill,
  nextLevelName
} from '../domain/factories.js';
import { createRate } from '../domain/rates.js';
import { newId } from '../domain/ids.js';
import { clientDetailsPatch, clientFromBill, getClientSaveError, getClientProfileState } from '../domain/clients.js';
import { createTemplate } from '../domain/templates.js';
import { createPayment } from '../domain/payments.js';
import { createSampleBill } from '../domain/sample-bill.js';
import { convertEstimateToBill, createNextRunningBill, nextNumberFor } from '../domain/bill-kinds.js';
import { DEFAULT_SIGNATURE_LAYOUT, normalizeSignatureLayout } from '../domain/signature-layout.js';
import { moveDocument, normalizePrintSettings, toggleDocument } from '../domain/print-settings.js';
import { tr } from '../i18n/translate.js';

/** Applies `updater` to the active bill within the full state. */
function updateActiveBill(state, updater) {
  return {
    ...state,
    bills: state.bills.map((bill) => bill.id === state.activeBillId ? tree.applyPatch(bill, updater) : bill)
  };
}

function createBillActions({ data, setData }) {
  const insertAndOpen = (bill) =>
    setData((current) => ({ ...current, bills: [bill, ...current.bills], activeBillId: bill.id }));

  return {
    open(billId) {
      setData((current) => ({ ...current, activeBillId: billId }));
    },
    /** @param {'bill'|'estimate'} kind */
    create(kind = 'bill') {
      const bill = createBill(nextNumberFor(data.bills, kind), { gstEnabled: Boolean(data.firm.gstRegistered) });
      insertAndOpen(kind === 'estimate' ? { ...bill, kind } : bill);
    },
    /** Creates a bill from an estimate and marks the estimate as converted. Returns the new bill. */
    convertEstimate(estimateId) {
      const estimate = data.bills.find((entry) => entry.id === estimateId);
      if (!estimate) return null;
      const bill = convertEstimateToBill(estimate, data.bills);
      setData((current) => ({
        ...current,
        bills: [bill, ...current.bills.map((entry) => entry.id === estimateId ? { ...entry, convertedBillId: bill.id } : entry)],
        activeBillId: bill.id
      }));
      return bill;
    },
    /** Starts the next running (RA) bill after `sourceId`. Returns the new bill. */
    nextRunningBill(sourceId) {
      const source = data.bills.find((entry) => entry.id === sourceId);
      if (!source) return null;
      const { bill, sourcePatch } = createNextRunningBill(data.bills, source);
      setData((current) => ({
        ...current,
        bills: [bill, ...current.bills.map((entry) => entry.id === sourceId ? { ...entry, ...sourcePatch } : entry)],
        activeBillId: bill.id
      }));
      return bill;
    },
    /** Adds an example bill and opens it. */
    addSample() {
      insertAndOpen(createSampleBill(nextNumberFor(data.bills, 'bill'), data.rates, { gstEnabled: Boolean(data.firm.gstRegistered) }));
    },
    duplicate(source) {
      // A duplicate starts a fresh bill: not part of the source's running-bill series.
      insertAndOpen({ ...duplicateBill(source, nextNumberFor(data.bills, source.kind === 'estimate' ? 'estimate' : 'bill')), raSeriesId: undefined, raNumber: undefined, convertedBillId: undefined, sourceEstimateId: undefined });
    },
    remove(billId) {
      setData((current) => {
        const remaining = current.bills.filter((entry) => entry.id !== billId);
        if (!remaining.length) {
          const fresh = createBill('1');
          return { ...current, bills: [fresh], activeBillId: fresh.id };
        }
        return {
          ...current,
          bills: remaining,
          activeBillId: current.activeBillId === billId ? remaining[0].id : current.activeBillId
        };
      });
    },
    /** Patches the active bill with an object or `(bill) => bill` updater. */
    update(updater) {
      setData((current) => updateActiveBill(current, updater));
    }
  };
}

function createEntryActions({ data, bill, setData }) {
  const updateBill = (updater) => setData((current) => updateActiveBill(current, updater));

  /** Runs a `{ apply, result }` operation from bill-tree and returns its result. */
  const run = (operation) => {
    if (!operation) return null;
    updateBill(operation.apply);
    return operation.result;
  };

  return {
    addSection() {
      const section = createSection(nextLevelName(bill.firstLevelName, 'Section', bill.sections.length));
      updateBill((current) => tree.appendSection(current, section));
      return section;
    },
    addArea(sectionId) {
      const section = bill.sections.find((entry) => entry.id === sectionId);
      if (!section) return null;
      const area = createArea(nextLevelName(bill.secondLevelName, 'Area', section.areas.length));
      updateBill((current) => tree.appendArea(current, sectionId, area));
      return area;
    },
    addItem(sectionId, areaId, rateId, values) {
      const rate = data.rates.find((entry) => entry.id === rateId);
      if (!rate) return null;
      const item = createItem(rate, values);
      updateBill((current) => tree.appendItems(current, sectionId, areaId, [item]));
      return item;
    },
    updateSection(sectionId, patch) {
      updateBill((current) => tree.updateSection(current, sectionId, patch));
    },
    updateArea(sectionId, areaId, patch) {
      updateBill((current) => tree.updateArea(current, sectionId, areaId, patch));
    },
    updateItem(sectionId, areaId, itemId, patch) {
      updateBill((current) => tree.updateItem(current, sectionId, areaId, itemId, patch));
    },
    /** `direction`: -1 moves up, +1 moves down. */
    moveSection(sectionId, direction) {
      updateBill((current) => tree.moveSection(current, sectionId, direction));
    },
    moveArea(sectionId, areaId, direction) {
      updateBill((current) => tree.moveArea(current, sectionId, areaId, direction));
    },
    moveItem(sectionId, areaId, itemId, direction) {
      updateBill((current) => tree.moveItem(current, sectionId, areaId, itemId, direction));
    },
    removeSection(sectionId) {
      updateBill((current) => tree.removeSection(current, sectionId));
    },
    removeArea(sectionId, areaId) {
      updateBill((current) => tree.removeArea(current, sectionId, areaId));
    },
    removeItem(sectionId, areaId, itemId) {
      updateBill((current) => tree.removeItem(current, sectionId, areaId, itemId));
    },
    copyArea(sectionId, areaId, targetSectionId) {
      return run(tree.copyAreaToSection(bill, sectionId, areaId, targetSectionId));
    },
    copyItem(sectionId, areaId, itemId, targetSectionId) {
      return run(tree.copyItemToSection(bill, sectionId, areaId, itemId, targetSectionId));
    }
  };
}

function createTemplateActions({ data, bill, setData }) {
  return {
    /** @returns {boolean} whether the template was saved (names must be unique) */
    save(template) {
      const record = createTemplate(data.templates, template);
      if (!record) return false;
      setData((current) => ({ ...current, templates: [...current.templates, record] }));
      return true;
    },
    remove(templateId) {
      setData((current) => ({
        ...current,
        templates: current.templates.filter((template) => template.id !== templateId)
      }));
    },
    apply(templateId, targetSectionId) {
      const template = data.templates.find((entry) => entry.id === templateId);
      const operation = tree.applyTemplate(bill, template, targetSectionId);
      if (!operation) return null;
      setData((current) => updateActiveBill(current, operation.apply));
      return operation.result;
    }
  };
}

function createClientActions({ data, bill, setData }) {
  return {
    /** Links a saved profile to the bill, or unlinks it when `clientId` is empty. */
    select(clientId) {
      const client = data.clients.find((entry) => entry.id === clientId);
      setData((current) => updateActiveBill(current, client ? clientDetailsPatch(client) : { clientId: '' }));
    },
    /** @returns {{ ok: boolean, message: string }} */
    saveProfile(updateExisting) {
      const error = getClientSaveError(bill, data.clients, updateExisting);
      if (error) return { ok: false, message: error };

      const { selectedClient } = getClientProfileState(bill, data.clients);
      const client = clientFromBill(bill, updateExisting ? selectedClient.id : newId());
      setData((current) => updateActiveBill({
        ...current,
        clients: updateExisting
          ? current.clients.map((entry) => entry.id === client.id ? client : entry)
          : [...current.clients, client]
      }, clientDetailsPatch(client)));
      return {
        ok: true,
        message: updateExisting ? tr('Saved client profile updated.') : tr('Client profile saved for future bills.')
      };
    },
    /** Deletes a saved profile; bills keep their copied client details. */
    removeProfile(clientId) {
      setData((current) => ({
        ...current,
        clients: current.clients.filter((entry) => entry.id !== clientId),
        bills: current.bills.map((entry) => entry.clientId === clientId ? { ...entry, clientId: '' } : entry)
      }));
    }
  };
}

function createRateActions({ setData }) {
  return {
    /** Adds a work item; `values` override the defaults. Returns the new rate. */
    add(values = {}) {
      const rate = { id: newId(), ...createRate(), ...values };
      setData((current) => ({ ...current, rates: [...current.rates, rate] }));
      return rate;
    },
    update(rateId, patch) {
      setData((current) => ({
        ...current,
        rates: current.rates.map((rate) => rate.id === rateId ? { ...rate, ...patch } : rate)
      }));
    },
    remove(rateId) {
      setData((current) => ({ ...current, rates: current.rates.filter((rate) => rate.id !== rateId) }));
    }
  };
}

function createFirmActions({ setData }) {
  return {
    update(patch) {
      setData((current) => ({ ...current, firm: { ...current.firm, ...patch } }));
    }
  };
}

function createPrintActions({ setData }) {
  const setSettings = (updater) => setData((current) => ({
    ...current,
    printSettings: updater(current.printSettings)
  }));

  return {
    update(patch) {
      setSettings((settings) => normalizePrintSettings({ ...settings, ...patch }));
    },
    toggleDocument(documentId) {
      setSettings((settings) => toggleDocument(settings, documentId));
    },
    moveDocument(documentId, direction) {
      setSettings((settings) => moveDocument(settings, documentId, direction));
    },
    /** Signature width lives in print settings and the firm's layout; keep them in sync. */
    setSignatureWidth(value) {
      setData((current) => {
        const printSettings = normalizePrintSettings({ ...current.printSettings, signatureWidth: value });
        const signatureLayout = normalizeSignatureLayout({
          ...current.firm.signatureLayout,
          width: printSettings.signatureWidth
        });
        return { ...current, printSettings, firm: { ...current.firm, signatureLayout } };
      });
    },
    setSignatureLayout(signatureLayout) {
      setData((current) => ({
        ...current,
        firm: { ...current.firm, signatureLayout },
        printSettings: normalizePrintSettings({ ...current.printSettings, signatureWidth: signatureLayout.width })
      }));
    },
    resetSignatureLayout() {
      setData((current) => ({
        ...current,
        firm: {
          ...current.firm,
          signatureLayout: normalizeSignatureLayout({
            ...DEFAULT_SIGNATURE_LAYOUT,
            width: current.printSettings.signatureWidth
          })
        }
      }));
    }
  };
}

/** Payments recorded against the active bill. */
function createPaymentActions({ setData }) {
  const updatePayments = (updater) => setData((current) => updateActiveBill(current, (bill) => ({
    ...bill,
    payments: updater(Array.isArray(bill.payments) ? bill.payments : [])
  })));
  return {
    add(values) {
      const payment = createPayment(values);
      updatePayments((payments) => [...payments, payment]);
      return payment;
    },
    update(paymentId, values) {
      updatePayments((payments) => payments.map((payment) =>
        payment.id === paymentId ? { ...createPayment(values), id: paymentId } : payment));
    },
    remove(paymentId) {
      updatePayments((payments) => payments.filter((payment) => payment.id !== paymentId));
    }
  };
}

function createPreferenceActions({ setData }) {
  const setPreference = (patch) => setData((current) => ({ ...current, preferences: { ...current.preferences, ...patch } }));
  return {
    setLanguage: (language) => setPreference({ language }),
    /** 'normal' or 'large' */
    setTextSize: (textSize) => setPreference({ textSize })
  };
}

function createQuotationActions({ setData }) {
  return {
    update(patch) {
      setData((current) => ({ ...current, quotation: { ...current.quotation, ...patch } }));
    }
  };
}

function createDataActions({ setData }) {
  return {
    /** Replaces everything with restored backup data. */
    restore(state) {
      setData(state);
    },
    /** Puts back a previously captured state, e.g. to undo a delete. */
    restoreSnapshot(snapshot) {
      setData(snapshot);
    },
    /** Marks the welcome screen as seen (or not, to show it again). */
    setOnboarded(onboarded = true) {
      setData((current) => ({ ...current, meta: { ...current.meta, onboarded } }));
    },
    markBackedUp(date = new Date()) {
      setData((current) => ({ ...current, meta: { ...current.meta, lastBackupAt: date.toISOString() } }));
    }
  };
}

export function createActions(context) {
  return {
    data: createDataActions(context),
    quotation: createQuotationActions(context),
    preferences: createPreferenceActions(context),
    payments: createPaymentActions(context),
    bills: createBillActions(context),
    entry: createEntryActions(context),
    templates: createTemplateActions(context),
    clients: createClientActions(context),
    rates: createRateActions(context),
    firm: createFirmActions(context),
    print: createPrintActions(context)
  };
}

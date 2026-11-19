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
import { billFieldsFromProject, createAdvance, createExpense, createProject, projectsFromBills } from '../domain/projects.js';
import { newId } from '../domain/ids.js';
import { createTemplate } from '../domain/templates.js';
import { createPayment } from '../domain/payments.js';
import { createSampleBill } from '../domain/sample-bill.js';
import { relabelGeneratedNames } from '../domain/relabel.js';
import { createWorker } from '../domain/labour.js';
import * as labourOps from '../domain/labour-ops.js';
import * as history from '../domain/history.js';
import { backToDraft, markReady } from '../domain/bill-final.js';
import { isSubmitted, attachToSeries, canTakePayment, cancelBill, deleteBlocker, isDraft, isEntryLocked, isFrozen, isReady, lockedFields, reopenSubmitted, restoreCancelled, submitBill } from '../domain/bill-guard.js';
import { addLine, createQuotation, finalizeQuotation, isQuotationFinal, itemIds, newQuotationVersion, quotationLabel, quotedRates, removeLine, repriceBill, repriceDrafts, setLinePrice } from '../domain/quotations.js';
import { convertEstimateToBill, createNextRunningBill, nextNumberFor, nextRunningBlocker } from '../domain/bill-kinds.js';
import { DEFAULT_SIGNATURE_LAYOUT, normalizeSignatureLayout } from '../domain/signature-layout.js';
import { moveDocument, normalizePrintSettings, toggleDocument } from '../domain/print-settings.js';
import { tr } from '../i18n/translate.js';

/** Applies `updater` to the active bill within the full state. */
/**
 * Some fields never change after the fact: the date, the project and client once linked, and
 * (see bill-guard) prices, client, GST and the bill number once the bill is final, paid or locked.
 */
function lockBillIdentity(updater, bill) {
  if (typeof updater !== 'object' || updater === null) return updater;
  const locked = lockedFields(bill);
  return Object.fromEntries(Object.entries(updater).filter(([key]) => !locked.includes(key)));
}

/** The untouched bill a new install starts with: nothing in it, no project, not a sample. */
function isBlankStarter(bill) {
  return !bill.projectId && !bill.projectName && !bill.client && !bill.isSample && !(bill.sections || []).length && !(bill.payments || []).length && !bill.kind;
}

/** Applies `updater` to the bill with this id. */
function updateBillById(state, billId, updater) {
  return { ...state, bills: state.bills.map((bill) => (bill.id === billId ? tree.applyPatch(bill, updater) : bill)) };
}

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
    /**
     * @param {'bill'|'estimate'} kind
     * @param {{ project?: object }} options the project the bill belongs to (its name and client are copied in)
     */
    create(kind = 'bill', { project } = {}) {
      // The empty bill every new install starts with is replaced, not kept beside the first real bill.
      const starter = kind === 'bill' && data.bills.length === 1 && isBlankStarter(data.bills[0]);
      const others = starter ? [] : data.bills;
      const bill = { ...createBill(nextNumberFor(others, kind), { gstEnabled: Boolean(data.firm.gstRegistered) }), ...billFieldsFromProject(project) };
      const created = kind === 'estimate' ? { ...bill, kind } : bill;
      if (starter) setData((current) => ({ ...current, bills: [created], activeBillId: created.id }));
      else insertAndOpen(created);
    },
    /** Gives any bill a name of its own (empty removes it). */
    rename(billId, name) {
      const clean = String(name || '').trim();
      // A running bill's name is the name of its whole series ("First floor"), so every open bill of it follows.
      setData((current) => {
        const target = current.bills.find((entry) => entry.id === billId);
        const together = (entry) => entry.id === billId || (target?.raSeriesId && entry.raSeriesId === target.raSeriesId && !entry.cancelled && !isSubmitted(entry));
        return { ...current, bills: current.bills.map((entry) => (together(entry) ? { ...entry, name: clean || undefined } : entry)) };
      });
    },
    /** Links any bill to a project (copies the project's name and client into it). */
    linkProject(billId, project) {
      const fields = billFieldsFromProject(project);
      setData((current) => ({ ...current, bills: current.bills.map((entry) => (entry.id === billId ? { ...entry, ...fields } : entry)) }));
    },
    /** Creates a bill from an estimate and marks the estimate as converted. Returns the new bill. */
    convertEstimate(estimateId) {
      const estimate = data.bills.find((entry) => entry.id === estimateId);
      if (!estimate || !isReady(estimate)) return null; // only a final estimate becomes a bill
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
      if (!source || nextRunningBlocker(data.bills, source)) return null;
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
      const copy = { ...duplicateBill(source, nextNumberFor(data.bills, source.kind === 'estimate' ? 'estimate' : 'bill')), raSeriesId: undefined, raNumber: undefined, convertedBillId: undefined, sourceEstimateId: undefined };
      // A copy is a new draft: it is priced from the project's current quotation.
      insertAndOpen(repriceBill(copy, quotedRates(data.rates, data.quotations.find((entry) => entry.id === copy.quotationId))));
    },
    /** Deletes (to the recycle bin) a bill nothing depends on. Bills with money, a final/locked state or a running series must be cancelled instead. */
    remove(billId) {
      const target = data.bills.find((entry) => entry.id === billId);
      if (!target || deleteBlocker(target, data.bills)) return false;
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
      return true;
    },
    /** Draft → ready: prices, measurements, client and firm details are frozen; the bill can take payments. */
    markReady(billId) {
      setData((current) => updateBillById(current, billId, (bill) => markReady(bill, current.rates, new Date(), current.firm)));
    },
    /** Ready → draft so it can be edited again (the contractor only before any money is on it; the admin always, with a reason). */
    backToDraft(billId, { reason = '', admin = false } = {}) {
      setData((current) => updateBillById(current, billId, (bill) => backToDraft(bill, current.rates, { reason, admin })));
    },
    /** Ready → submitted: the payment is in, the bill is closed and moves to the Submitted tab. `reason` explains any balance left unpaid. */
    submit(billId, reason = '') {
      setData((current) => updateBillById(current, billId, (bill) => submitBill(bill, { reason })));
    },
    /** The admin reopens the active submitted bill (back to ready), with a reason. */
    reopenSubmitted(billId, reason) {
      setData((current) => updateBillById(current, billId, (bill) => reopenSubmitted(bill, reason)));
    },
    /** Attaches a quotation to a draft bill (or none = standard rates); `reprice` re-prices its entries to it. */
    attachQuotation(billId, quotationId, { reprice = false } = {}) {
      setData((current) => updateBillById(current, billId, (bill) => {
        if (!isDraft(bill)) return bill;
        const quotation = current.quotations.find((entry) => entry.id === quotationId) || null;
        const next = { ...bill, quotationId: quotation?.id, quotationLabel: quotation ? quotationLabel(quotation) : undefined };
        return reprice ? repriceBill(next, quotedRates(current.rates, quotation)) : next;
      }));
    },
    /** Voids a bill that cannot be deleted; it stays on record and is left out of totals. */
    cancel(billId, reason) {
      setData((current) => ({ ...current, bills: current.bills.map((entry) => (entry.id === billId ? cancelBill(entry, reason) : entry)) }));
    },
    restoreCancelled(billId, reason) {
      setData((current) => ({ ...current, bills: current.bills.map((entry) => (entry.id === billId ? restoreCancelled(entry, reason) : entry)) }));
    },
    /** Makes a bill the next running bill after `sourceId` (same project only). Returns whether it was done. */
    makeRunningBillOf(billId, sourceId) {
      const target = data.bills.find((entry) => entry.id === billId);
      const source = data.bills.find((entry) => entry.id === sourceId);
      const result = target && source ? attachToSeries(data.bills, target, source) : null;
      if (!result) return false;
      setData((current) => ({
        ...current,
        bills: current.bills.map((entry) => {
          if (entry.id === billId) return result.bill;
          if (entry.id === sourceId && result.sourcePatch) return { ...entry, ...result.sourcePatch };
          return entry;
        })
      }));
      return true;
    },
    /** Patches the active bill with an object or `(bill) => bill` updater. */
    update(updater) {
      setData((current) => updateActiveBill(current, lockBillIdentity(updater, current.bills.find((entry) => entry.id === current.activeBillId))));
    }
  };
}

function createEntryActions({ data, bill, setData }) {
  // A final, settled or cancelled bill's measurements are locked.
  const updateBill = (updater) => setData((current) => {
    if (isEntryLocked(current.bills.find((entry) => entry.id === current.activeBillId))) {
      if (typeof window !== 'undefined') window.dispatchEvent(new CustomEvent('bill-locked'));
      return current;
    }
    return updateActiveBill(current, updater);
  });

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
    /** `name`: a ready-made room name ("Hall"); a repeat becomes "Hall 2". */
    addArea(sectionId, name = '') {
      const section = bill.sections.find((entry) => entry.id === sectionId);
      if (!section) return null;
      const same = name ? section.areas.filter((entry) => entry.name === name || entry.name.startsWith(`${name} `)).length : 0;
      const area = createArea(name ? (same ? `${name} ${same + 1}` : name) : nextLevelName(bill.secondLevelName, 'Area', section.areas.length));
      updateBill((current) => tree.appendArea(current, sectionId, area));
      return area;
    },
    addItem(sectionId, areaId, rateId, values) {
      // Priced from the project's active quotation when it has one.
      const rate = quotedRates(data.rates, data.quotations.find((entry) => entry.id === bill.quotationId)).find((entry) => entry.id === rateId);
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
    /** A copy of the room right after it in the same floor. */
    duplicateArea(sectionId, areaId) {
      return run(tree.duplicateArea(bill, sectionId, areaId));
    },
    /** A copy of the whole floor (rooms and entries) right after it. */
    duplicateSection(sectionId) {
      return run(tree.duplicateSection(bill, sectionId));
    },
    /** Several rooms of one floor into several other floors at once. */
    copyAreas(sectionId, areaIds, targetSectionIds) {
      return run(tree.copyAreasToSections(bill, sectionId, areaIds, targetSectionIds));
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
      // Entries from a template take today's prices (the project's quotation when it has one).
      const prices = quotedRates(data.rates, data.quotations.find((entry) => entry.id === bill.quotationId));
      const before = itemIds(bill);
      setData((current) => updateActiveBill(current, (active) => repriceBill(tree.applyPatch(active, operation.apply), prices, before)));
      return operation.result;
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
    /**
     * Changes a work item. A new price applies to entries made from now on; entries already
     * on bills keep their price unless `updateDrafts` is set, which also re-prices the entries
     * in draft bills (projects whose quotation sets its own price are left alone).
     */
    update(rateId, patch, { updateDrafts = false } = {}) {
      setData((current) => {
        const rates = current.rates.map((rate) => rate.id === rateId ? { ...rate, ...patch } : rate);
        if (!updateDrafts || patch.rate === undefined) return { ...current, rates };
        const bills = repriceDrafts(current.bills, rateId, (bill) => {
          const quotation = current.quotations.find((entry) => entry.id === bill.quotationId);
          return quotation?.lines.some((entry) => entry.rateId === rateId) ? null : patch.rate; // a quotation's own price stays
        });
        return { ...current, rates, bills };
      });
    },
    /** Hides a work item from new entries; bills that used it are unchanged. */
    archive(rateId) {
      setData((current) => ({ ...current, rates: current.rates.map((rate) => rate.id === rateId ? { ...rate, archived: true } : rate) }));
    },
    unarchive(rateId) {
      setData((current) => ({ ...current, rates: current.rates.map((rate) => { if (rate.id !== rateId) return rate; const { archived: _archived, ...rest } = rate; return rest; }) }));
    },
    /** Deletes a work item no bill uses; one that is in use is archived instead. */
    remove(rateId) {
      setData((current) => {
        const used = current.bills.some((bill) => (bill.sections || []).some((section) => (section.areas || []).some((area) => (area.items || []).some((item) => item.rateId === rateId || item.sourceRateId === rateId))));
        if (used) return { ...current, rates: current.rates.map((rate) => rate.id === rateId ? { ...rate, archived: true } : rate) };
        return { ...current, rates: current.rates.filter((rate) => rate.id !== rateId) };
      });
    }
  };
}

/** add / update / remove for a list of versioned records (projects, advances, expenses). */
function createListActions({ setData }, key, create) {
  return {
    /** Adds a record; `values` override the defaults. Returns it. */
    add(values = {}) {
      const record = create(values);
      setData((current) => ({ ...current, [key]: [...current[key], record] }));
      return record;
    },
    update(id, patch) {
      setData((current) => ({ ...current, [key]: current[key].map((item) => (item.id === id ? { ...item, ...patch } : item)) }));
    },
    /** Moves to the recycle bin (restorable from History). */
    remove(id) {
      setData((current) => ({ ...current, [key]: current[key].filter((item) => item.id !== id) }));
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
  // A payment is recorded while the bill is ready (the client is paying it). Existing ones can be corrected until it is submitted.
  const updatePayments = (updater, { adding = false } = {}) => setData((current) => updateActiveBill(current, (bill) => (
    (adding ? !canTakePayment(bill) : isFrozen(bill)) ? bill : {
      ...bill,
      payments: updater(Array.isArray(bill.payments) ? bill.payments : [])
    }
  )));
  return {
    add(values) {
      const payment = createPayment(values);
      updatePayments((payments) => [...payments, payment], { adding: true });
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
    /** Switches language and converts untouched generated names (e.g. "Floor 3") to it. */
    setLanguage: (language) => setData((current) => ({
      ...current,
      bills: relabelGeneratedNames(current.bills, current.preferences?.language || 'en', language),
      preferences: { ...current.preferences, language }
    })),
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

/**
 * Labour: workers, daily attendance, advances and wage payments.
 * Every change goes through labour-ops (activity log, closed-month checks,
 * soft delete); nothing here edits labour data directly.
 */
function createLabourActions({ setData }) {
  const apply = (operation, ...args) => setData((current) => ({ ...current, labour: operation(current.labour, ...args, new Date()) }));
  return {
    /** Adds a worker. Returns the new worker. */
    addWorker(values) {
      const worker = createWorker(values);
      apply(labourOps.addWorker, worker);
      return worker;
    },
    updateWorker: (workerId, patch) => apply(labourOps.updateWorker, workerId, patch),
    /** Moves a worker to the recycle bin (restorable for 30 days). */
    deleteWorker: (workerId) => apply(labourOps.deleteWorker, workerId),
    restoreWorker: (workerId) => apply(labourOps.restoreWorker, workerId),
    purgeWorker: (workerId) => apply(labourOps.purgeDeletedWorker, workerId),
    /** Sets a worker's attendance for a day in P units; `null` clears it. */
    mark: (date, worker, units, projectId = '') => { apply(labourOps.markAttendance, date, [{ worker, units, projectId }]); apply(labourOps.assignToSite, [worker.id], projectId); },
    /** Marks every listed worker for a day (one log entry). */
    markAll: (date, workers, units, projectId = '') => { apply(labourOps.markAttendance, date, workers.map((worker) => ({ worker, units, projectId }))); apply(labourOps.assignToSite, workers.map((worker) => worker.id), projectId); },
    addPayment: (values) => apply(labourOps.addPayment, values),
    updatePayment: (paymentId, values) => apply(labourOps.updatePayment, paymentId, values),
    /** Moves a payment to the recycle bin. */
    deletePayment: (paymentId) => apply(labourOps.deletePayment, paymentId),
    restorePayment: (paymentId) => apply(labourOps.restorePayment, paymentId),
    purgePayment: (paymentId) => apply(labourOps.purgeDeletedPayment, paymentId),
    closeMonth: (month) => apply(labourOps.closeMonth, month),
    unlockMonth: (month) => apply(labourOps.unlockMonth, month),
    /** Undoes one activity-log entry. */
    revert: (entryId) => apply(labourOps.revertEntry, entryId)
  };
}

function createDataActions({ setData, setRaw }) {
  return {
    /** Replaces everything (raw state) with restored backup data. */
    restore(state) {
      setRaw(state);
    },
    /** Puts back a previously captured raw state, e.g. for a quick Undo. */
    restoreSnapshot(snapshot) {
      setRaw(snapshot);
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

/** History and recycle bin for bills, rates, clients, templates, firm and quotation. */
function createHistoryActions({ setRaw }) {
  const apply = (operation, ...args) => setRaw((raw) => operation(raw, ...args, new Date()));
  return {
    undo: (entryId) => apply(history.undoEntry, entryId),
    restore: (entity, id) => apply(history.restoreRecord, entity, id),
    purge: (entity, id) => apply(history.purgeRecord, entity, id),
    /** Admin: one step of "Delete everything" (see WIPE_STEPS). The app always keeps one blank bill to work in. */
    deleteStep: (stepId) => setRaw((raw) => {
      const now = new Date();
      let next = stepId === 'workers'
        ? { ...raw, labour: (raw.labour?.workers || []).filter((worker) => !worker.deletedAt).reduce((current, worker) => labourOps.deleteWorker(current, worker.id, now), raw.labour) }
        : history.deleteStep(raw, stepId, now);
      if (!next.bills.some((bill) => !bill.deletedAt)) {
        const fresh = history.stampNew(createBill('1'), now);
        next = { ...next, bills: [...next.bills, fresh], activeBillId: fresh.id };
      }
      return next;
    }),
    /** Admin: permanently removes everything in the recycle bin. */
    emptyRecycleBin: () => setRaw((raw) => {
      const now = new Date();
      const cleared = history.emptyRecycleBin(raw);
      let labour = cleared.labour;
      for (const worker of (labour?.workers || []).filter((entry) => entry.deletedAt)) labour = labourOps.purgeDeletedWorker(labour, worker.id, now);
      for (const payment of (labour?.payments || []).filter((entry) => entry.deletedAt)) labour = labourOps.purgeDeletedPayment(labour, payment.id, now);
      return { ...cleared, labour };
    })
  };
}

/** Quotations (see domain/quotations.js). Only drafts change; a final quotation is replaced by a new version. */
function createQuotationRecordActions({ data, setData }) {
  const patchDraft = (id, change) => setData((current) => ({
    ...current,
    quotations: current.quotations.map((quotation) => (quotation.id === id && !isQuotationFinal(quotation) ? change(quotation) : quotation))
  }));
  return {
    /** A new draft quotation for a project, copied from today's standard rates. Returns it. */
    add(projectId, name) {
      const quotation = createQuotation({ projectId, name, rates: data.rates, quotations: data.quotations });
      setData((current) => ({ ...current, quotations: [quotation, ...current.quotations] }));
      return quotation;
    },
    rename: (id, name) => patchDraft(id, (quotation) => ({ ...quotation, name: String(name || '').trim() || quotation.name })),
    setPrice: (id, rateId, price) => patchDraft(id, (quotation) => setLinePrice(quotation, rateId, price)),
    removeLine: (id, rateId) => patchDraft(id, (quotation) => removeLine(quotation, rateId)),
    /** Adds a work item (by id, or a just-made rate object) to a draft quotation. */
    addLine: (id, rateOrId) => patchDraft(id, (quotation) => { const rate = typeof rateOrId === 'object' ? rateOrId : data.rates.find((entry) => entry.id === rateOrId); return rate ? addLine(quotation, rate) : quotation; }),
    /** Adds a brand-new work item that lives only in this draft quotation (it is not added to the standard rates). */
    addNewLine: (id, values) => patchDraft(id, (quotation) => addLine(quotation, { id: newId(), ...createRate(), ...values })),
    /** Freezes the quotation: its prices are saved for good. */
    finalize(id) {
      setData((current) => ({ ...current, quotations: current.quotations.map((quotation) => (quotation.id === id ? finalizeQuotation(quotation) : quotation)) }));
    },
    /** A new draft copy of a quotation (same number, next version). Returns it. */
    newVersion(id) {
      const source = data.quotations.find((entry) => entry.id === id);
      if (!source) return null;
      const copy = newQuotationVersion(data.quotations, source);
      setData((current) => ({ ...current, quotations: [copy, ...current.quotations] }));
      return copy;
    },
    /** Deletes a quotation no bill uses (to the recycle bin). */
    remove(id) {
      const used = data.bills.some((bill) => bill.quotationId === id);
      if (used) return false;
      setData((current) => ({ ...current, quotations: current.quotations.filter((quotation) => quotation.id !== id) }));
      return true;
    }
  };
}

export function createActions(context) {
  return {
    history: createHistoryActions(context),
    data: createDataActions(context),
    quotation: createQuotationActions(context),
    labour: createLabourActions(context),
    preferences: createPreferenceActions(context),
    payments: createPaymentActions(context),
    bills: createBillActions(context),
    entry: createEntryActions(context),
    templates: createTemplateActions(context),
    rates: createRateActions(context),
    projects: {
      ...createListActions(context, 'projects', createProject),
      /** Changes a project; its bills follow the new project name and client details. */
      update(id, patch) {
        context.setData((current) => {
          const projects = current.projects.map((item) => (item.id === id ? { ...item, ...patch } : item));
          const project = projects.find((item) => item.id === id);
          const fields = billFieldsFromProject(project);
          const changed = (bill) => Object.entries(fields).some(([key, value]) => (bill[key] ?? '') !== value);
          return {
            ...current,
            projects,
            bills: current.bills.map((bill) => (bill.projectId === id && changed(bill) ? { ...bill, ...fields } : bill))
          };
        });
      },
      /** Makes projects for bills that have none yet and links them. Returns how many bills were linked. */
      linkBills() {
        let linked = 0;
        context.setData((current) => {
          const { projects, links } = projectsFromBills(current.bills, current.projects);
          linked = Object.keys(links).length;
          if (!linked) return current;
          return {
            ...current,
            projects: [...current.projects, ...projects],
            bills: current.bills.map((bill) => (links[bill.id] ? { ...bill, projectId: links[bill.id] } : bill))
          };
        });
        return linked;
      }
    },
    /** Quotations: numbered price sets for a project. A draft is edited freely; a final one only gets a new version (admin). */
    quotations: createQuotationRecordActions(context),
    advances: createListActions(context, 'advances', createAdvance),
    expenses: createListActions(context, 'expenses', createExpense),
    firm: createFirmActions(context),
    print: createPrintActions(context)
  };
}

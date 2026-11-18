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
    /**
     * @param {'bill'|'estimate'} kind
     * @param {{ project?: object }} options the project the bill belongs to (its name and client are copied in)
     */
    create(kind = 'bill', { project } = {}) {
      const bill = { ...createBill(nextNumberFor(data.bills, kind), { gstEnabled: Boolean(data.firm.gstRegistered) }), ...billFieldsFromProject(project) };
      insertAndOpen(kind === 'estimate' ? { ...bill, kind } : bill);
    },
    /** Links any bill to a project (copies the project's name and client into it). */
    linkProject(billId, project) {
      const fields = billFieldsFromProject(project);
      setData((current) => ({ ...current, bills: current.bills.map((entry) => (entry.id === billId ? { ...entry, ...fields } : entry)) }));
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
    mark: (date, worker, units) => apply(labourOps.markAttendance, date, [{ worker, units }]),
    /** Marks every listed worker for a day (one log entry). */
    markAll: (date, workers, units) => apply(labourOps.markAttendance, date, workers.map((worker) => ({ worker, units }))),
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
    purge: (entity, id) => apply(history.purgeRecord, entity, id)
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
    advances: createListActions(context, 'advances', createAdvance),
    expenses: createListActions(context, 'expenses', createExpense),
    firm: createFirmActions(context),
    print: createPrintActions(context)
  };
}

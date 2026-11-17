import { feetInchesError, parseFeetInches } from './measurements.js';
import { getDimensionFields, resolveRate } from './rates.js';
import { getBillTotals, hasGst } from './calculations.js';
import { text } from './formatters.js';
import { tr } from '../i18n/translate.js';

/**
 * Checks one dimension value.
 * @returns {{ kind: 'format', detail: string } | { kind: 'required' } | { kind: 'positive' } | null}
 */
export function getDimensionIssue(value, required) {
  const formatError = feetInchesError(value);
  if (formatError) return { kind: 'format', detail: formatError };
  if (required && !text(value)) return { kind: 'required' };
  if (required && parseFeetInches(value) <= 0) return { kind: 'positive' };
  return null;
}

/** Short message shown beside a single dimension input. */
export function describeDimensionIssue(issue) {
  if (!issue) return null;
  if (issue.kind === 'format') return issue.detail;
  return issue.kind === 'required' ? tr('Required') : tr('Must be greater than zero');
}

/**
 * Structured problems with an item's rate and measurements. Shared by the
 * entry form and whole-bill validation, which word the messages differently.
 */
export function getItemIssues(values, rate) {
  const issues = [];
  if (!text(rate.name || values.name)) issues.push({ code: 'name' });
  if (!text(rate.unit || values.unit)) issues.push({ code: 'unit' });
  const rateValue = Number(rate.rate);
  if (!Number.isFinite(rateValue) || rateValue < 0) issues.push({ code: 'rate' });

  const quantity = Number(rate.type === 'direct' ? values.quantity : values.count);
  if (!Number.isFinite(quantity) || quantity <= 0) issues.push({ code: 'quantity' });

  getDimensionFields(rate.type).forEach((field) => {
    const issue = getDimensionIssue(values[field.key], field.required);
    if (issue) issues.push({ code: 'dimension', label: field.label, ...issue });
  });
  return issues;
}

const ENTRY_MESSAGES = {
  name: () => tr('Enter a work item name.'),
  unit: () => tr('Enter a unit.'),
  rate: () => tr('Rate must be zero or greater.'),
  quantity: () => tr('Quantity must be greater than zero.'),
  dimension: (issue) => {
    const label = tr(issue.label);
    return {
      format: `${label}: ${issue.detail}`,
      required: tr('{label} is required.', { label }),
      positive: tr('{label} must be greater than zero.', { label })
    }[issue.kind];
  }
};

/** Validates the add/edit entry form. */
export function validateEntry(entry, rate) {
  if (!rate) return [tr('Choose a work item.')];
  return getItemIssues(entry, rate).map((issue) => ENTRY_MESSAGES[issue.code](issue));
}

function describeBillItemIssue(issue, name) {
  if (issue.code === 'name') return tr('Work item: enter an item name.');
  if (issue.code === 'unit') return tr('{name}: enter a unit.', { name });
  if (issue.code === 'rate') return tr('{name}: rate must be zero or greater.', { name });
  if (issue.code === 'quantity') return tr('{name}: quantity must be greater than zero.', { name });
  const label = tr(issue.label).toLowerCase();
  return {
    format: `${name}: ${label} — ${issue.detail}`,
    required: tr('{name}: enter {label}.', { name, label }),
    positive: tr('{name}: {label} must be greater than zero.', { name, label })
  }[issue.kind];
}

/** Field-level errors for the bill's discount, GST and advance amounts. */
export function getAmountErrors(bill, rates, totals = getBillTotals(bill, rates)) {
  const errors = { discount: '', taxRate: '', advance: '', payments: '' };
  const discount = Number(bill.discount);
  const taxRate = Number(bill.taxRate);
  const advance = Number(bill.advance);

  if (text(bill.discount) && (!Number.isFinite(discount) || discount < 0)) {
    errors.discount = tr('Discount must be zero or greater.');
  } else if (discount > totals.subtotal) {
    errors.discount = tr('Discount cannot exceed the subtotal.');
  }
  if (hasGst(bill) && text(bill.taxRate) && (!Number.isFinite(taxRate) || taxRate < 0 || taxRate > 100)) {
    errors.taxRate = tr('GST must be between 0 and 100%.');
  }
  if (text(bill.advance) && (!Number.isFinite(advance) || advance < 0)) {
    errors.advance = tr('Advance must be zero or greater.');
  } else if (advance > totals.total) {
    errors.advance = tr('Advance cannot exceed the bill total.');
  } else if (totals.paid > totals.total) {
    errors.payments = tr('Payments received exceed the bill total.');
  }
  return errors;
}

/** All calculation problems in a bill: entries, then amounts. */
export function getBillValidation(bill, rates) {
  const errors = [];
  let itemCount = 0;
  (bill.sections || []).forEach((section) => (section.areas || []).forEach((area) =>
    (area.items || []).forEach((item) => {
      itemCount += 1;
      const rate = resolveRate(item, rates);
      const name = text(rate.name || item.name) || tr('Work item');
      getItemIssues(item, rate).forEach((issue) => errors.push(describeBillItemIssue(issue, name)));
    })));

  if (itemCount === 0) errors.push(tr('Add at least one work item before exporting a bill.'));
  const amountErrors = getAmountErrors(bill, rates);
  return [...errors, ...Object.values(amountErrors).filter(Boolean)];
}

/** Bills and estimates are numbered separately, so only the same kind can clash. */
export function isBillNumberTaken(bills, bill) {
  const kind = (entry) => (entry.kind === 'estimate' ? 'estimate' : 'bill');
  return bills.some((entry) => entry.id !== bill.id && kind(entry) === kind(bill) && text(entry.number) === text(bill.number));
}

/** Required project details for export, keyed by field. */
export function getRequiredDetailErrors(bill, firm) {
  return {
    projectName: text(bill.projectName) ? '' : tr('Project or site name is required for PDF export.'),
    client: text(bill.client) ? '' : tr('Client name is required for PDF export.'),
    firmName: text(firm?.name) ? '' : tr('Firm name is required for PDF export.')
  };
}

/** Everything that blocks printing or exporting the active bill. */
export function getExportErrors({ bill, bills, rates, firm, billErrors = getBillValidation(bill, rates) }) {
  const required = getRequiredDetailErrors(bill, firm);
  return [
    ...billErrors,
    ...(!text(bill.number) ? [tr('Enter a bill number in Project details.')] : []),
    ...(isBillNumberTaken(bills, bill) ? [tr('Bill number is already used by another bill.')] : []),
    ...(required.projectName ? [tr('Enter a project or site name in Project details.')] : []),
    ...(required.client ? [tr('Enter a client name in Project details.')] : []),
    ...(required.firmName ? [tr('Enter your firm name in Project details.')] : [])
  ];
}

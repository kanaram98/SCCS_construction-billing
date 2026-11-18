/**
 * Projects (sites), client advances and site expenses.
 *
 * A project is one piece of work for a client. Bills, advances, expenses and
 * (later) timesheets point at it, so a report can total money in and out per
 * project and per client.
 *
 *   project:  { id, name, clientId, client, address, status, agreedAmount, notes }
 *   advance:  { id, projectId, date, amount, mode, note }      money received from the client
 *   expense:  { id, projectId, date, amount, category, note }  money spent on site (food, travel…)
 *
 * All three are normal versioned records (see history.js): add, edit, soft
 * delete, undo, sync. Amounts are numbers; dates are YYYY-MM-DD.
 */
import { newId } from './ids.js';
import { roundTo2, text, todayIso } from './formatters.js';
import { PAYMENT_MODES } from './payments.js';
import { tr } from '../i18n/translate.js';

export const PROJECT_STATUSES = Object.freeze({ running: 'Running', completed: 'Completed' });

export const EXPENSE_CATEGORIES = Object.freeze({
  food: 'Food & tea',
  travel: 'Travel',
  fuel: 'Fuel',
  tools: 'Tools & repairs',
  stay: 'Stay',
  other: 'Other'
});

export const DEFAULT_EXPENSE_CATEGORY = 'food';

export function createProject(values = {}) {
  return { id: newId(), name: '', clientId: '', client: '', address: '', status: 'running', agreedAmount: '', notes: '', ...values };
}

export function createAdvance(values = {}) {
  return { id: newId(), projectId: '', date: todayIso(), amount: 0, mode: 'cash', note: '', ...values, amount: Number(values.amount) || 0 };
}

export function createExpense(values = {}) {
  return { id: newId(), projectId: '', date: todayIso(), amount: 0, category: DEFAULT_EXPENSE_CATEGORY, note: '', ...values, amount: Number(values.amount) || 0 };
}

const positive = (value) => Number.isFinite(Number(value)) && Number(value) > 0;

export function getProjectErrors(values) {
  const agreed = text(values.agreedAmount);
  return {
    name: text(values.name) ? '' : tr('Enter the project or site name.'),
    agreedAmount: agreed && (!Number.isFinite(Number(agreed)) || Number(agreed) < 0) ? tr('Enter a valid amount.') : ''
  };
}

export function getAdvanceErrors(values) {
  return {
    projectId: text(values.projectId) ? '' : tr('Choose the project.'),
    date: text(values.date) ? '' : tr('Choose the date.'),
    amount: positive(values.amount) ? '' : tr('Enter an amount greater than zero.'),
    mode: PAYMENT_MODES[values.mode] ? '' : tr('Choose how it was paid.')
  };
}

export function getExpenseErrors(values) {
  return {
    projectId: text(values.projectId) ? '' : tr('Choose the project.'),
    date: text(values.date) ? '' : tr('Choose the date.'),
    amount: positive(values.amount) ? '' : tr('Enter an amount greater than zero.'),
    category: EXPENSE_CATEGORIES[values.category] ? '' : tr('Choose a category.')
  };
}

export const hasErrors = (errors) => Object.values(errors).some(Boolean);

const sum = (items) => roundTo2(items.reduce((total, item) => total + (Number(item.amount) || 0), 0));

export const totalAmount = sum;

/** Expenses for a project (or all) in a month ('YYYY-MM'), oldest day first, with a total per day. */
export function expensesByDay(expenses, { projectId = '', month = '' } = {}) {
  const chosen = expenses
    .filter((expense) => (!projectId || expense.projectId === projectId) && (!month || expense.date.startsWith(`${month}-`)))
    .sort((a, b) => a.date.localeCompare(b.date) || String(a.createdAt || '').localeCompare(String(b.createdAt || '')));
  const days = new Map();
  for (const expense of chosen) {
    if (!days.has(expense.date)) days.set(expense.date, []);
    days.get(expense.date).push(expense);
  }
  return [...days].map(([date, items]) => ({ date, items, total: sum(items) }));
}

/** Totals of expenses by category, largest first. */
export function expensesByCategory(expenses) {
  const totals = {};
  for (const expense of expenses) totals[expense.category] = (totals[expense.category] || 0) + (Number(expense.amount) || 0);
  return Object.entries(totals).map(([category, total]) => ({ category, total: roundTo2(total) })).sort((a, b) => b.total - a.total);
}

/** What a project / expense / advance is called in lists and History. */
export function projectName(projects, projectId) {
  return projects.find((project) => project.id === projectId)?.name || '';
}

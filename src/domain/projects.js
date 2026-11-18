/**
 * Projects (sites), client advances and site expenses.
 *
 * A project is one piece of work for a client. Bills, advances, expenses and
 * (later) timesheets point at it, so a report can total money in and out per
 * project and per client.
 *
 *   project:  { id, name, client, clientPhone, clientAddress, clientGstin, address, status, agreedAmount, notes }
 *             a project IS the client's job: it holds the client's details (clientId is only kept for old data)
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
  return { id: newId(), name: '', clientId: '', client: '', clientPhone: '', clientAddress: '', clientGstin: '', address: '', status: 'running', agreedAmount: '', notes: '', ...values };
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
    client: text(values.client) ? '' : tr('Enter the client name.'),
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

const norm = (value) => text(value).toLowerCase();

/** The fields a bill takes from the project it is linked to. */
export function billFieldsFromProject(project) {
  if (!project) return {};
  return {
    projectId: project.id,
    projectName: project.name,
    client: project.client || '',
    clientId: project.clientId || '',
    clientPhone: project.clientPhone || '',
    clientAddress: project.clientAddress || '',
    clientGstin: project.clientGstin || ''
  };
}

/**
 * Projects for bills that are not linked yet: one per distinct project name and
 * client (an existing project with the same name and client is reused).
 * Sample bills and bills without a project name are skipped.
 * @returns {{ projects: object[], links: Record<string, string> }} new projects, and billId → projectId
 */
export function projectsFromBills(bills, projects) {
  const created = [];
  const links = {};
  const find = (name, client) => [...projects, ...created].find((project) => norm(project.name) === name && norm(project.client) === client);
  for (const bill of bills) {
    if (bill.projectId || bill.isSample || !text(bill.projectName)) continue;
    const name = norm(bill.projectName);
    const client = norm(bill.client);
    let project = find(name, client);
    if (!project) {
      project = createProject({ name: text(bill.projectName), client: text(bill.client), clientId: bill.clientId || '', clientPhone: text(bill.clientPhone), clientAddress: text(bill.clientAddress), clientGstin: text(bill.clientGstin) });
      created.push(project);
    }
    links[bill.id] = project.id;
  }
  return { projects: created, links };
}

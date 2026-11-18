/**
 * One search across everything: bills, projects (and their clients), workers,
 * expenses, advances and rates. Each result says where to go:
 *   { type, id, title, subtitle, view, focus }
 */
import { billLabel } from './bill-kinds.js';
import { formatCurrency, text } from './formatters.js';
import { VIEWS } from '../config/app.js';

const norm = (value) => text(value).toLowerCase();
const matches = (query, ...parts) => parts.some((part) => norm(part).includes(query));

export const SEARCH_TYPES = ['bills', 'projects', 'workers', 'expenses', 'advances', 'rates'];

/** Results grouped by type: { bills: [...], projects: [...] }. Empty groups are left out. */
export function searchAll(data, rawQuery, { limit = 6, t = (value) => value } = {}) {
  const query = norm(rawQuery);
  if (query.length < 2) return {};
  const projectById = new Map(data.projects.map((project) => [project.id, project]));
  const projectLabel = (id) => projectById.get(id)?.name || '';
  const groups = {
    bills: data.bills
      .filter((bill) => matches(query, bill.number, bill.projectName, bill.client, bill.clientPhone, bill.date))
      .map((bill) => ({ type: 'bills', id: bill.id, title: `${billLabel(bill, t)} · ${bill.projectName || t('Untitled project')}`, subtitle: [bill.client, bill.date].filter(Boolean).join(' · '), view: VIEWS.entry, focus: { billId: bill.id } })),
    projects: data.projects
      .filter((project) => matches(query, project.name, project.client, project.clientPhone, project.address, project.notes))
      .map((project) => ({ type: 'projects', id: project.id, title: project.name, subtitle: project.client, view: VIEWS.projects, focus: { projectId: project.id } })),
    workers: (data.labour?.workers || [])
      .filter((worker) => !worker.deletedAt && matches(query, worker.name, worker.role, worker.phone))
      .map((worker) => ({ type: 'workers', id: worker.id, title: worker.name, subtitle: [worker.role, worker.active ? '' : t('Left')].filter(Boolean).join(' · '), view: VIEWS.labour, focus: { workerId: worker.id } })),
    expenses: data.expenses
      .filter((expense) => matches(query, expense.note, projectLabel(expense.projectId), expense.category, expense.date, String(expense.amount)))
      .map((expense) => ({ type: 'expenses', id: expense.id, title: `${formatCurrency(expense.amount)} · ${expense.note || t(expense.category)}`, subtitle: [expense.date, projectLabel(expense.projectId)].filter(Boolean).join(' · '), view: VIEWS.expenses, focus: { month: expense.date.slice(0, 7), projectId: expense.projectId } })),
    advances: data.advances
      .filter((advance) => matches(query, advance.note, projectLabel(advance.projectId), advance.date, String(advance.amount)))
      .map((advance) => ({ type: 'advances', id: advance.id, title: `${formatCurrency(advance.amount)} · ${t('Advance from client')}`, subtitle: [advance.date, projectLabel(advance.projectId), advance.note].filter(Boolean).join(' · '), view: VIEWS.projects, focus: { projectId: advance.projectId } })),
    rates: data.rates
      .filter((rate) => matches(query, rate.name, rate.unit))
      .map((rate) => ({ type: 'rates', id: rate.id, title: rate.name, subtitle: `${formatCurrency(rate.rate)} / ${rate.unit}`, view: VIEWS.rates, focus: {} }))
  };
  return Object.fromEntries(Object.entries(groups).filter(([, list]) => list.length).map(([type, list]) => [type, { total: list.length, items: list.slice(0, limit) }]));
}

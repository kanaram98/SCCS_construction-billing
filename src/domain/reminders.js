/**
 * Things to do today, worked out when the app opens (the app cannot send
 * notifications on its own without a paid server, so these show on Home).
 *
 *   attendance   some active workers have no attendance for today
 *   unlinked     bills that belong to no project (so reports leave them out)
 *   monthOpen    last month had labour records but is not closed yet (from the 3rd)
 */
import { isEstimate } from './bill-kinds.js';
import { shiftMonth } from './labour.js';

export function buildReminders({ bills = [], labour = { workers: [], attendance: {}, payments: [], closedMonths: {} } }, today) {
  const reminders = [];

  const active = (labour.workers || []).filter((worker) => worker.active && !worker.deletedAt);
  const marked = labour.attendance?.[today] || {};
  const missing = active.filter((worker) => !marked[worker.id]);
  if (active.length && missing.length) reminders.push({ id: 'attendance', count: missing.length, of: active.length });

  const unlinked = bills.filter((bill) => !bill.projectId && !bill.isSample && !isEstimate(bill) && !bill.deletedAt);
  if (unlinked.length) reminders.push({ id: 'unlinked', count: unlinked.length });

  const month = today.slice(0, 7);
  const last = shiftMonth(month, -1);
  const hadWork = Object.keys(labour.attendance || {}).some((date) => date.startsWith(`${last}-`))
    || (labour.payments || []).some((payment) => !payment.deletedAt && String(payment.date).startsWith(`${last}-`));
  if (Number(today.slice(8, 10)) >= 3 && hadWork && !labour.closedMonths?.[last]) reminders.push({ id: 'monthOpen', month: last });

  return reminders;
}

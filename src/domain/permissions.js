/**
 * Roles in the shared workspace and what each may do.
 *
 * admin       — everything.
 * contractor  — daily work: creates and edits bills, estimates and
 *               measurements; adds rates, workers and payments/advances;
 *               fills the timesheet for today and the 2 days before;
 *               marks a worker as left or working; closes a month.
 *               He cannot edit or delete rates, workers (name, wage) or
 *               payments, change older timesheet days, unlock a month,
 *               delete forever, change firm details or manage people.
 *
 * firestore.rules enforces the add-only parts on the server; the timesheet
 * window is enforced in the app (rules can't read dates inside a month
 * document). The app uses `can()`, `canEditAttendanceDate()`, `canUndo()` and
 * `canRestore()` to hide what a role can't do.
 */
import { localToday, shiftDate } from './labour.js';

export const ROLES = Object.freeze({ admin: 'Admin', contractor: 'Contractor' });

/** Days before today (besides today) a contractor may still change in the timesheet. */
export const CONTRACTOR_TIMESHEET_DAYS = 2;

/** Actions only an admin may take. */
export const ADMIN_ONLY = Object.freeze([
  'manageMembers',
  'deleteForever',
  'unlockMonth',
  'editFirm',
  'editRate',
  'deleteRate',
  'editWorker',
  'deleteWorker',
  'editPayment',
  'deletePayment'
]);

export function can(role, action) {
  if (role === 'admin') return true;
  if (role === 'contractor') return !ADMIN_ONLY.includes(action);
  return false;
}

/** Whether `role` may change the timesheet of `date` (YYYY-MM-DD). */
export function canEditAttendanceDate(role, date, today = localToday()) {
  if (role === 'admin') return true;
  if (role !== 'contractor') return false;
  return date <= today && date >= shiftDate(today, -CONTRACTOR_TIMESHEET_DAYS);
}

/** Only `active` (left / working) changed: the one worker edit a contractor may make. */
function onlyActiveChanged(entry) {
  const { before, after } = entry;
  if (!before || !after) return false;
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  const changed = [...keys].filter((key) => before[key] !== after[key]);
  return changed.length > 0 && changed.every((key) => key === 'active');
}

/** Whether `role` may undo a history entry (bills/clients/templates/labour log). */
export function canUndo(role, entry, today = localToday()) {
  if (role === 'admin') return true;
  if (role !== 'contractor') return false;
  switch (entry.entity) {
    case 'rates':
    case 'firm':
    case 'payment':
    case 'month':
      return false;
    case 'worker':
      return entry.action === 'update' && onlyActiveChanged(entry);
    case 'attendance':
      return canEditAttendanceDate(role, entry.date, today);
    default:
      return true; // bills, clients, templates, quotation
  }
}

/** Whether `role` may restore a deleted item of this kind from the recycle bin. */
export function canRestore(role, entity) {
  if (role === 'admin') return true;
  if (role !== 'contractor') return false;
  return !['rates', 'worker', 'payment'].includes(entity);
}

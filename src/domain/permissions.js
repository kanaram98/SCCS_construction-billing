/**
 * Roles in the shared workspace and what each may do.
 *
 * admin       — everything, including members, permanent deletes, unlocking
 *               closed months and firm/bank details.
 * contractor  — all daily work: bills, estimates, measurements, rates,
 *               quotation, attendance, advances and payments, PDFs, undo,
 *               restoring from the recycle bin, closing a month.
 *
 * The same split is enforced on the server by firestore.rules; the app uses
 * `can()` to hide what a role can't do.
 */
export const ROLES = Object.freeze({ admin: 'Admin', contractor: 'Contractor' });

/** Actions only an admin may take. */
export const ADMIN_ONLY = Object.freeze([
  'manageMembers',
  'deleteForever',
  'unlockMonth',
  'editFirm'
]);

export function can(role, action) {
  if (role === 'admin') return true;
  if (role === 'contractor') return !ADMIN_ONLY.includes(action);
  return false;
}

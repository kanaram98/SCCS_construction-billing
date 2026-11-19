import { billStatus, isCancelled } from '../../domain/bill-guard.js';
import { isEstimate } from '../../domain/bill-kinds.js';

/** The stage a bill is in, in words: Draft, Ready (Final for an estimate), Submitted or Cancelled. */
export function stageLabel(bill) {
  if (isCancelled(bill)) return 'Cancelled';
  const status = billStatus(bill);
  if (status === 'draft') return 'Draft';
  if (status === 'submitted') return 'Submitted';
  return isEstimate(bill) ? 'Final' : 'Ready';
}

/** Why a bill cannot be marked ready yet (see readyBlockers in bill-guard.js). */
export const BLOCKER_TEXT = Object.freeze({
  empty: 'Add at least one entry first.',
  'quotation-draft': 'Make quotation {quotation} final first (Quotation tab).',
  'quotation-missing': 'An estimate needs a final quotation. Attach one from its ⋮ menu.'
});

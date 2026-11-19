import { useState } from 'react';
import { ReasonDialog, ResponsiveDialog, useConfirm, useNotify } from '../../components/ui';
import RenameDialog from '../../components/ui/RenameDialog.jsx';
import { useBilling } from '../../state/BillingContext.jsx';
import { useCloud } from '../account/CloudProvider.jsx';
import { useUndoable } from '../../hooks/useUndoable.js';
import { useWhatsAppReminder } from '../../hooks/useWhatsAppReminder.js';
import { VIEWS } from '../../config/app.js';
import { billLabel, isEstimate, nextRunningBlocker } from '../../domain/bill-kinds.js';
import { canMoveToDraft, deleteBlocker, hasMoney, readyBlockers } from '../../domain/bill-guard.js';
import { getBillTotals } from '../../domain/calculations.js';
import { formatCurrency } from '../../domain/formatters.js';
import { getPayments, sumPayments } from '../../domain/payments.js';
import { tr as t } from '../../i18n/translate.js';
import AttachQuotationDialog from './AttachQuotationDialog.jsx';
import NewBillDialog from './NewBillDialog.jsx';
import RunningBillOfDialog from './RunningBillOfDialog.jsx';
import RunningTrailDialog from './RunningTrailDialog.jsx';
import BillDetailsCard from '../project/BillDetailsCard.jsx';
import { BLOCKER_TEXT } from './stageText.js';

/**
 * Everything that can be done to one bill, in one place: open it, edit its details, attach a quotation,
 * mark it ready, send it back to draft, submit it, reopen it, cancel or delete it, convert an estimate,
 * start the next running bill, print it. The Bills list and the bill search both use this, so a bill
 * is managed from the same menu wherever it is found.
 *
 * Returns `cardProps(bill)` for a BillCard and `dialogs`, which must be rendered once by the page.
 */
export function useBillOperations({ onNavigate }) {
  const { data, actions } = useBilling();
  const cloud = useCloud();
  const confirm = useConfirm();
  const notify = useNotify();
  const undoable = useUndoable();
  const reminder = useWhatsAppReminder();
  const admin = cloud.can('reopenBill');

  const [linking, setLinking] = useState(null);
  const [renaming, setRenaming] = useState(null);
  const [cancelling, setCancelling] = useState(null);
  const [moving, setMoving] = useState(null);
  const [trail, setTrail] = useState(null);
  const [attaching, setAttaching] = useState(null);
  const [detailing, setDetailing] = useState(null);
  /** A stage change that needs a typed reason: { kind: 'submit' | 'draft' | 'reopen' | 'restore', bill }. */
  const [asking, setAsking] = useState(null);

  const quotationOf = (bill) => data.quotations.find((entry) => entry.id === bill.quotationId) || null;

  function open(bill) {
    actions.bills.open(bill.id);
    onNavigate(VIEWS.entry);
  }

  function linkProject(bill, { project, newProject } = {}) {
    const target = newProject ? actions.projects.add(newProject) : project;
    if (!target) return;
    actions.bills.linkProject(bill.id, target);
    setLinking(null);
    notify(t('{bill} linked to {project}.', { bill: billLabel(bill, t), project: target.name }));
  }

  function duplicate(bill) {
    actions.bills.duplicate(bill);
    notify(t('{name} duplicated.', { name: billLabel(bill, t) }));
    onNavigate(VIEWS.entry);
  }

  async function remove(bill) {
    // A bill with payments, a stage past draft or a running series is never deleted: it is cancelled.
    if (deleteBlocker(bill, data.bills)) { setCancelling(bill); return; }
    const label = billLabel(bill, t);
    const confirmed = await confirm({
      title: t('Delete {name}?', { name: label }),
      message: t('It moves to Recently deleted and can be restored for 30 days.'),
      confirmLabel: t('Delete'),
      danger: true
    });
    if (!confirmed) return;
    undoable(t('{name} deleted.', { name: label }), () => actions.bills.remove(bill.id));
  }

  function cancelMessage(bill) {
    return [
      t('The bill stays on record, marked Cancelled, and is left out of totals and reports. It cannot be edited.'),
      getPayments(bill).length ? t('Payments of {amount} recorded on it will no longer be counted. Record them on the right bill first if they still count.', { amount: formatCurrency(sumPayments(bill)) }) : ''
    ].filter(Boolean).join('\n');
  }

  function convert(estimate) {
    const bill = actions.bills.convertEstimate(estimate.id);
    if (!bill) return;
    notify(t('{estimate} converted to {bill}.', { estimate: billLabel(estimate, t), bill: billLabel(bill, t) }));
    onNavigate(VIEWS.entry);
  }

  function nextRunning(bill) {
    const next = actions.bills.nextRunningBill(bill.id);
    if (!next) return;
    notify(t('{bill} started for {project}.', { bill: billLabel(next, t), project: next.projectName || t('Untitled project') }));
    onNavigate(VIEWS.entry);
  }

  async function markReady(bill) {
    const blockers = readyBlockers(bill, quotationOf(bill));
    if (blockers.length) {
      notify(t(BLOCKER_TEXT[blockers[0]], { quotation: bill.quotationLabel || '' }), 'warning');
      return;
    }
    const estimate = isEstimate(bill);
    const ok = await confirm({
      title: estimate ? t('Mark this estimate as final?') : t('Mark this bill as ready?'),
      message: estimate
        ? t('Prices and measurements are frozen at the quotation. You can then convert it into a bill.')
        : t('Prices, measurements, client details, GST and the bill number are frozen, and the firm details are saved as printed today. Payments can then be recorded.'),
      confirmLabel: estimate ? t('Mark as final') : t('Mark as ready')
    });
    if (!ok) return;
    actions.bills.markReady(bill.id);
    notify(estimate ? t('Estimate marked as final.') : t('Bill is ready.'), 'success');
  }

  async function backToDraft(bill) {
    if (admin && hasMoney(bill)) { setAsking({ kind: 'draft', bill }); return; }
    const ok = await confirm({
      title: t('Move back to draft?'),
      message: t('You can edit it again, for example to add a discount. It prints with a DRAFT stamp until you mark it ready.'),
      confirmLabel: t('Back to draft')
    });
    if (ok) actions.bills.backToDraft(bill.id, { admin });
  }

  async function submit(bill) {
    if (getBillTotals(bill, data.rates).balance > 0.5) { setAsking({ kind: 'submit', bill }); return; }
    const ok = await confirm({
      title: t('Submit this bill?'),
      message: t('The bill is closed and moves to the Submitted tab. Only the admin can reopen it.'),
      confirmLabel: t('Submit')
    });
    if (!ok) return;
    actions.bills.submit(bill.id);
    notify(t('Bill submitted.'), 'success');
  }

  const reasonText = (kind, bill) => {
    if (kind === 'submit') return { title: t('Submit with a balance?'), message: t('{amount} is still unpaid on this bill. Say why you are submitting it (for example: client will pay later, or a discount was agreed). The reason is kept on the bill.', { amount: formatCurrency(getBillTotals(bill, data.rates).balance) }), label: t('Submit') };
    if (kind === 'draft') return { title: t('Move back to draft?'), message: t('Payments are recorded on this bill. The reason is kept on the bill.'), label: t('Back to draft') };
    if (kind === 'reopen') return { title: t('Reopen this bill?'), message: t('It goes back to ready so payments can be changed. The reason is kept on the bill.'), label: t('Reopen') };
    return { title: t('Restore this bill?'), message: t('It counts again in totals and reports. The reason is kept on the bill.'), label: t('Restore bill') };
  };

  function answerReason(reason) {
    const { kind, bill } = asking;
    if (kind === 'submit') { actions.bills.submit(bill.id, reason); notify(t('Bill submitted.'), 'success'); }
    else if (kind === 'draft') actions.bills.backToDraft(bill.id, { admin: true, reason });
    else if (kind === 'reopen') { actions.bills.reopenSubmitted(bill.id, reason); notify(t('Bill reopened.'), 'info'); }
    else actions.bills.restoreCancelled(bill.id, reason);
  }

  const reason = asking ? reasonText(asking.kind, asking.bill) : { title: '', message: '', label: '' };

  const cardProps = (bill) => ({
    canCancel: cloud.can('cancelBill'),
    canMove: cloud.can('moveBill'),
    admin,
    canDelete: !deleteBlocker(bill, data.bills),
    canNextRunning: !nextRunningBlocker(data.bills, bill),
    canDraft: canMoveToDraft(bill, { admin }),
    onOpen: () => open(bill),
    onLinkProject: () => setLinking(bill),
    onRename: () => setRenaming(bill),
    onDetails: () => { actions.bills.open(bill.id); setDetailing(bill); }, // the details form works on the open bill
    onAttachQuotation: () => setAttaching(bill),
    onMarkReady: () => markReady(bill),
    onBackToDraft: () => backToDraft(bill),
    onSubmit: () => submit(bill),
    onReopen: () => setAsking({ kind: 'reopen', bill }),
    onRestore: () => setAsking({ kind: 'restore', bill }),
    onDuplicate: () => duplicate(bill),
    onDelete: () => remove(bill),
    onCancel: () => setCancelling(bill),
    onMove: () => setMoving(bill),
    onRemind: () => reminder.remind(bill),
    onConvert: () => convert(bill),
    onNextRunningBill: () => nextRunning(bill),
    onTrail: () => setTrail(bill),
    onPrint: () => onNavigate(VIEWS.print, { billId: bill.id })
  });

  const dialogs = (
    <>
      <ReasonDialog
        open={Boolean(cancelling)}
        danger
        title={t('Cancel {name}?', { name: cancelling ? billLabel(cancelling, t) : '' })}
        message={cancelling ? cancelMessage(cancelling) : ''}
        confirmLabel={t('Cancel bill')}
        onConfirm={(text) => { actions.bills.cancel(cancelling.id, text); notify(t('{name} cancelled.', { name: billLabel(cancelling, t) }), 'info'); }}
        onClose={() => setCancelling(null)}
      />
      <ReasonDialog
        open={Boolean(asking)}
        title={reason.title}
        message={reason.message}
        confirmLabel={reason.label}
        onConfirm={answerReason}
        onClose={() => setAsking(null)}
      />
      <RunningBillOfDialog
        open={Boolean(moving)}
        bill={moving}
        bills={data.bills.filter((entry) => entry.id !== moving?.id)}
        onConfirm={(sourceId) => { if (actions.bills.makeRunningBillOf(moving.id, sourceId)) notify(t('{name} is now a running bill.', { name: billLabel(moving, t) }), 'success'); }}
        onClose={() => setMoving(null)}
      />
      <RenameDialog open={Boolean(renaming)} allowEmpty title={t('Bill name')} label={t('Bill name')} value={renaming?.name || ''} onSave={(name) => actions.bills.rename(renaming.id, name)} onClose={() => setRenaming(null)} />
      <NewBillDialog open={Boolean(linking)} kind="bill" projects={data.projects} linking={linking} onCreate={(choice) => linkProject(linking, choice)} onClose={() => setLinking(null)} />
      <AttachQuotationDialog
        open={Boolean(attaching)}
        bill={attaching}
        quotations={data.quotations}
        onAttach={(quotationId) => { actions.bills.attachQuotation(attaching.id, quotationId, { reprice: true }); notify(quotationId ? t('Quotation attached. Entries now use its prices.') : t('Standard rates are used again.'), 'info'); }}
        onClose={() => setAttaching(null)}
      />
      <RunningTrailDialog open={Boolean(trail)} bill={trail} bills={data.bills} rates={data.rates} onOpen={(entry) => { setTrail(null); open(entry); }} onClose={() => setTrail(null)} />
      <ResponsiveDialog open={Boolean(detailing)} title={t('Bill details')} onClose={() => setDetailing(null)}>
        {detailing && <BillDetailsCard onNavigate={(view) => { setDetailing(null); onNavigate(view); }} />}
      </ResponsiveDialog>
    </>
  );

  return { cardProps, dialogs, linkProject };
}

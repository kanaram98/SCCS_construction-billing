import { useState } from 'react';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Divider from '@mui/material/Divider';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/EditOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutlined';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import { useWhatsAppReminder } from '../../hooks/useWhatsAppReminder.js';
import { useBilling } from '../../state/BillingContext.jsx';
import { useUndoable } from '../../hooks/useUndoable.js';
import { ActionMenu, Card, useNotify } from '../../components/ui';
import { getBillTotals, getPaymentStatus, paymentStatusLabel } from '../../domain/calculations.js';
import { formatCurrency } from '../../domain/formatters.js';
import { createAdjustment, advanceRemaining, getAdjustments, getPayments, paymentModeLabel, sortPayments } from '../../domain/payments.js';
import { getAmountErrors } from '../../domain/validation.js';
import PaymentDialog from './PaymentDialog.jsx';
import ApplyAdvanceDialog from './ApplyAdvanceDialog.jsx';
import ReceiptDialog from '../receipts/ReceiptDialog.jsx';
import { billPaymentReceipt } from '../../domain/receipt.js';
import ReceiptIcon from '@mui/icons-material/ReceiptOutlined';
import { canTakePayment, isFrozen } from '../../domain/bill-guard.js';
import { useCloud } from '../account/CloudProvider.jsx';
import { tr as t } from '../../i18n/translate.js';

const STATUS_COLORS = { paid: 'success', partial: 'warning', unpaid: 'default' };

function SummaryRow({ label, value, strong }) {
  return (
    <Stack direction="row" sx={{ justifyContent: 'space-between' }}>
      <Typography variant="body2" color={strong ? 'text.primary' : 'text.secondary'} sx={{ fontWeight: strong ? 700 : 400 }}>{label}</Typography>
      <Typography variant="body2" sx={{ fontWeight: strong ? 700 : 600 }}>{value}</Typography>
    </Stack>
  );
}

/** Payments received for the bill, with the running balance. */
export default function PaymentsCard() {
  const { data, bill, actions } = useBilling();
  const notify = useNotify();
  const undoable = useUndoable();
  const reminder = useWhatsAppReminder();
  const cloud = useCloud();
  // The contractor adds payments; only the admin changes or removes one. A settled or cancelled bill takes none.
  const canChange = cloud.can('editPayment');
  const frozen = isFrozen(bill);
  const takes = canTakePayment(bill); // payments and advances only while the bill is ready
  /** null = closed, 'new' = adding, otherwise the payment being edited. */
  const [editing, setEditing] = useState(null);
  const [applying, setApplying] = useState(false);
  const [receipt, setReceipt] = useState(null);
  const totals = getBillTotals(bill, data.rates);
  const status = getPaymentStatus(bill, data.rates, totals);
  const overpaid = getAmountErrors(bill, data.rates, totals).payments;
  const payments = sortPayments(getPayments(bill));
  const adjustments = getAdjustments(bill);
  const choices = data.advances
    .filter((advance) => bill.projectId && advance.projectId === bill.projectId)
    .map((advance) => ({ advance, remaining: advanceRemaining(advance, data.bills) }))
    .filter((choice) => choice.remaining > 0);

  function apply(values) {
    actions.bills.update({ advanceAdjustments: [...adjustments, createAdjustment(values)] });
    notify(t('{amount} of the advance applied.', { amount: formatCurrency(values.amount) }));
    setApplying(false);
  }

  function save(values) {
    if (editing === 'new') {
      actions.payments.add(values);
      notify(t('Payment of {amount} recorded.', { amount: formatCurrency(values.amount) }));
    } else {
      actions.payments.update(editing.id, values);
      notify(t('Payment updated.'));
    }
    setEditing(null);
  }

  return (
    <Card
      title={t('Payments')}
      action={<Chip size="small" label={t(paymentStatusLabel(status))} color={STATUS_COLORS[status]} variant={status === 'unpaid' ? 'outlined' : 'filled'} />}
    >
      <Stack spacing={0.5} sx={{ mb: 1.5 }}>
        <SummaryRow label={t('Bill total')} value={formatCurrency(totals.total)} />
        {totals.advance > 0 && <SummaryRow label={t('Advance')} value={`- ${formatCurrency(totals.advance)}`} />}
        {totals.received > 0 && <SummaryRow label={t('Payments received')} value={`- ${formatCurrency(totals.received)}`} />}
        {totals.adjusted > 0 && <SummaryRow label={t('Adjusted from advance')} value={`- ${formatCurrency(totals.adjusted)}`} />}
        <Divider />
        <SummaryRow label={t('Balance due')} value={formatCurrency(totals.balance)} strong />
        {overpaid && <Typography variant="caption" color="error">{overpaid}</Typography>}
      </Stack>

      {payments.length > 0 && (
        <List dense disablePadding sx={{ mb: 1 }}>
          {payments.map((payment) => (
            <ListItem
              key={payment.id}
              disableGutters
              secondaryAction={(
                <ActionMenu
                  size="small"
                  label={t('Actions for payment on {date}', { date: payment.date })}
                  items={[
                    { label: t('Receipt'), icon: <ReceiptIcon fontSize="small" />, onClick: () => setReceipt(billPaymentReceipt({ bill, payment, rates: data.rates })) },
                    { label: t('Edit'), icon: <EditIcon fontSize="small" />, onClick: () => setEditing(payment), hidden: !canChange || frozen },
                    {
                      label: t('Delete'),
                      icon: <DeleteIcon fontSize="small" />,
                      danger: true,
                      hidden: !canChange || frozen,
                      onClick: () => undoable(t('Payment deleted.'), () => actions.payments.remove(payment.id))
                    }
                  ]}
                />
              )}
            >
              <ListItemText
                primary={`${formatCurrency(payment.amount)} · ${t(paymentModeLabel(payment.mode))}`}
                secondary={[payment.date, payment.note].filter(Boolean).join(' · ')}
              />
            </ListItem>
          ))}
        </List>
      )}

      {adjustments.length > 0 && (
        <List dense disablePadding sx={{ mb: 1 }}>
          {adjustments.map((entry) => (
            <ListItem
              key={entry.id}
              disableGutters
              secondaryAction={(
                <ActionMenu
                  size="small"
                  label={t('Actions for advance adjustment on {date}', { date: entry.date })}
                  items={[{ label: t('Remove'), icon: <DeleteIcon fontSize="small" />, danger: true, hidden: !canChange || frozen, onClick: () => undoable(t('Adjustment removed.'), () => actions.bills.update({ advanceAdjustments: adjustments.filter((item) => item.id !== entry.id) })) }]}
                />
              )}
            >
              <ListItemText primary={`${formatCurrency(entry.amount)} · ${t('From client advance')}`} secondary={[entry.date, data.advances.find((advance) => advance.id === entry.advanceId)?.date].filter(Boolean).join(' · ')} />
            </ListItem>
          ))}
        </List>
      )}

      {!takes && <Typography variant="caption" color="text.secondary" component="p" sx={{ mb: 1 }}>{frozen ? t('This bill is submitted or cancelled, so payments cannot be changed. Only the admin can reopen it.') : t('Mark the bill ready (it goes to the client) to record payments or apply an advance.')}</Typography>}
      {takes && <Button fullWidth variant="outlined" startIcon={<AddIcon />} onClick={() => setEditing('new')}>{t('Record payment')}</Button>}
      {takes && choices.length > 0 && totals.balance > 0 && (
        <Button fullWidth variant="outlined" onClick={() => setApplying(true)} sx={{ mt: 1 }}>{t('Apply project advance')}</Button>
      )}
      <ReceiptDialog receipt={receipt} onClose={() => setReceipt(null)} />
      <ApplyAdvanceDialog open={applying} choices={choices} balance={Math.max(0, totals.balance)} onApply={apply} onClose={() => setApplying(false)} />
      {takes && totals.balance > 0 && (
        <Button fullWidth startIcon={<WhatsAppIcon />} onClick={() => reminder.remind(bill)} sx={{ mt: 1, color: '#128C7E' }}>
          {t('Remind on WhatsApp')}
        </Button>
      )}
      <PaymentDialog
        open={Boolean(editing)}
        payment={editing === 'new' ? null : editing}
        suggestedAmount={Math.max(0, totals.balance)}
        onSave={save}
        onClose={() => setEditing(null)}
      />
    </Card>
  );
}

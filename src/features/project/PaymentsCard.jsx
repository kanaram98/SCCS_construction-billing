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
import { useBilling } from '../../state/BillingContext.jsx';
import { useUndoable } from '../../hooks/useUndoable.js';
import { ActionMenu, Card, useNotify } from '../../components/ui';
import { getBillTotals, getPaymentStatus, paymentStatusLabel } from '../../domain/calculations.js';
import { formatCurrency } from '../../domain/formatters.js';
import { getPayments, paymentModeLabel, sortPayments } from '../../domain/payments.js';
import { getAmountErrors } from '../../domain/validation.js';
import PaymentDialog from './PaymentDialog.jsx';
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
  /** null = closed, 'new' = adding, otherwise the payment being edited. */
  const [editing, setEditing] = useState(null);
  const totals = getBillTotals(bill, data.rates);
  const status = getPaymentStatus(bill, data.rates, totals);
  const overpaid = getAmountErrors(bill, data.rates, totals).payments;
  const payments = sortPayments(getPayments(bill));

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
                    { label: t('Edit'), icon: <EditIcon fontSize="small" />, onClick: () => setEditing(payment) },
                    {
                      label: t('Delete'),
                      icon: <DeleteIcon fontSize="small" />,
                      danger: true,
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

      <Button fullWidth variant="outlined" startIcon={<AddIcon />} onClick={() => setEditing('new')}>{t('Record payment')}</Button>
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

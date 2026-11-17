import { useState } from 'react';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Chip from '@mui/material/Chip';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import EngineeringIcon from '@mui/icons-material/EngineeringOutlined';
import { ActionMenu, EmptyState, useConfirm, useNotify } from '../../components/ui';
import { useBilling } from '../../state/BillingContext.jsx';
import { useUndoable } from '../../hooks/useUndoable.js';
import { workerBalance } from '../../domain/labour.js';
import { formatCurrency } from '../../domain/formatters.js';
import { tr as t } from '../../i18n/translate.js';
import WorkerDialog from './WorkerDialog.jsx';
import LabourPaymentDialog from './LabourPaymentDialog.jsx';

/** "Due ₹2,400" or "Advance ₹500" for a worker's running balance. */
export function balanceText(balance) {
  if (!balance) return '';
  return balance > 0 ? t('Due {amount}', { amount: formatCurrency(balance) }) : t('Advance {amount}', { amount: formatCurrency(-balance) });
}

/** Worker list: add, edit, pay, mark as left, delete. */
export default function WorkersTab() {
  const { data, actions } = useBilling();
  const confirm = useConfirm();
  const notify = useNotify();
  const undoable = useUndoable();
  const [editing, setEditing] = useState(null); // a worker, 'new' or null
  const [paying, setPaying] = useState(null);
  const { labour } = data;
  const workers = [...labour.workers].sort((a, b) => Number(b.active) - Number(a.active) || a.name.localeCompare(b.name));

  function save(values) {
    if (editing === 'new') {
      actions.labour.addWorker(values);
      notify(t('{name} added.', { name: values.name }), 'success');
    } else {
      actions.labour.updateWorker(editing.id, values);
    }
    setEditing(null);
  }

  async function remove(worker) {
    const ok = await confirm({
      title: t('Delete {name}?', { name: worker.name }),
      message: t('Their attendance and payments will also be deleted. To keep the record, mark them as left instead.'),
      confirmLabel: t('Delete'),
      danger: true
    });
    if (ok) undoable(t('{name} deleted.', { name: worker.name }), () => actions.labour.removeWorker(worker.id));
  }

  return (
    <>
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
        <Typography variant="body2" color="text.secondary">
          {t('{count} working', { count: labour.workers.filter((worker) => worker.active).length })}
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setEditing('new')}>{t('Add worker')}</Button>
      </Stack>

      {!workers.length ? (
        <EmptyState icon={<EngineeringIcon fontSize="large" />} title={t('No workers yet')} description={t('Add your workers with their daily wage, then mark attendance every day.')} />
      ) : (
        <Card>
          <List disablePadding>
            {workers.map((worker) => (
              <ListItem
                key={worker.id}
                divider
                disablePadding
                secondaryAction={(
                  <ActionMenu
                    label={t('Actions for {name}', { name: worker.name })}
                    items={[
                      { label: t('Pay / advance'), onClick: () => setPaying(worker) },
                      { label: t('Edit'), onClick: () => setEditing(worker) },
                      { label: worker.active ? t('Mark as left') : t('Mark as working'), onClick: () => actions.labour.updateWorker(worker.id, { active: !worker.active }) },
                      { label: t('Delete'), danger: true, onClick: () => remove(worker) }
                    ]}
                  />
                )}
              >
                <ListItemButton onClick={() => setEditing(worker)} sx={{ opacity: worker.active ? 1 : 0.6 }}>
                  <ListItemText
                    primary={(
                      <Stack direction="row" spacing={1} component="span" sx={{ alignItems: 'center' }}>
                        <span>{worker.name}</span>
                        {!worker.active && <Chip size="small" label={t('Left')} component="span" />}
                      </Stack>
                    )}
                    secondary={[worker.role, t('{amount}/day', { amount: formatCurrency(worker.dailyWage) }), balanceText(workerBalance(labour, worker.id))].filter(Boolean).join(' · ')}
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </Card>
      )}

      <WorkerDialog open={Boolean(editing)} worker={editing === 'new' ? null : editing} onSave={save} onClose={() => setEditing(null)} />
      <LabourPaymentDialog
        open={Boolean(paying)}
        worker={paying}
        balance={paying ? workerBalance(labour, paying.id) : 0}
        onSave={(values) => {
          actions.labour.addPayment({ ...values, workerId: paying.id });
          notify(t('Payment saved.'), 'success');
          setPaying(null);
        }}
        onClose={() => setPaying(null)}
      />
    </>
  );
}

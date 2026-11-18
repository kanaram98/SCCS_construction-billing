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
import { useLabour } from './useLabour.js';
import { useCloud } from '../account/CloudProvider.jsx';
import { localToday, workerBalance, workerHasRecords } from '../../domain/labour.js';
import { formatCurrency } from '../../domain/formatters.js';
import { tr as t } from '../../i18n/translate.js';
import WorkerDialog from './WorkerDialog.jsx';
import LabourPaymentDialog from './LabourPaymentDialog.jsx';
import SettleDialog from './SettleDialog.jsx';
import DeleteWorkerDialog from './DeleteWorkerDialog.jsx';

/** "Due ₹2,400" or "Advance ₹500" for a worker's running balance. */
export function balanceText(balance) {
  if (!balance) return '';
  return balance > 0 ? t('Due {amount}', { amount: formatCurrency(balance) }) : t('Advance {amount}', { amount: formatCurrency(-balance) });
}

/** Worker list: add, edit, pay, mark as left, delete. */
export default function WorkersTab() {
  const { labour, actions } = useLabour();
  const confirm = useConfirm();
  const notify = useNotify();
  const canEditWorker = useCloud().can('editWorker');
  const [editing, setEditing] = useState(null); // a worker, 'new' or null
  const [paying, setPaying] = useState(null);
  const [settling, setSettling] = useState(null);
  const [deleting, setDeleting] = useState(null); // a worker with records, awaiting typed confirmation
  const byName = (a, b) => a.name.localeCompare(b.name);
  const working = labour.workers.filter((worker) => worker.active).sort(byName);
  const left = labour.workers.filter((worker) => !worker.active).sort((a, b) => String(b.leftOn || '').localeCompare(String(a.leftOn || '')) || byName(a, b));

  function save(values) {
    if (editing === 'new') {
      actions.addWorker(values);
      notify(t('{name} added.', { name: values.name }), 'success');
    } else {
      actions.updateWorker(editing.id, values);
    }
    setEditing(null);
  }

  function settle({ date, payDue, amount, mode }) {
    const worker = settling;
    if (payDue) actions.addPayment({ workerId: worker.id, date, amount, mode, note: t('Final settlement') });
    actions.updateWorker(worker.id, { active: false, leftOn: date });
    setSettling(null);
    notify(t('{name} has left. Their records are kept.', { name: worker.name }), 'success');
  }

  function rejoin(worker) {
    actions.updateWorker(worker.id, { active: true, leftOn: '', joinedOn: localToday() });
    notify(t('{name} is working again.', { name: worker.name }), 'success');
  }

  function deleteWithRecords() {
    const worker = deleting;
    setDeleting(null);
    actions.deleteWorker(worker.id);
    notify(t('{name} deleted.', { name: worker.name }), 'info', { label: t('Undo'), onClick: () => actions.restoreWorker(worker.id) });
  }

  async function remove(worker) {
    if (workerHasRecords(labour, worker.id)) {
      setDeleting(worker);
      return;
    }
    const ok = await confirm({
      title: t('Delete {name}?', { name: worker.name }),
      message: t('They move to Recently deleted with their attendance and payments, and can be restored for 30 days. If they only stopped working, mark them as left instead.'),
      confirmLabel: t('Delete'),
      danger: true
    });
    if (!ok) return;
    actions.deleteWorker(worker.id);
    notify(t('{name} deleted.', { name: worker.name }), 'info', { label: t('Undo'), onClick: () => actions.restoreWorker(worker.id) });
  }

  const renderList = (workers) => (
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
                  { label: t('Edit'), onClick: () => setEditing(worker), hidden: !canEditWorker },
                  { label: t('Settle and leave'), onClick: () => setSettling(worker), hidden: !worker.active },
                  { label: t('Rejoin'), onClick: () => rejoin(worker), hidden: worker.active },
                  { label: t('Delete'), danger: true, onClick: () => remove(worker), hidden: !canEditWorker }
                ]}
              />
            )}
          >
            <ListItemButton onClick={canEditWorker ? () => setEditing(worker) : undefined} disableRipple={!canEditWorker} sx={{ opacity: worker.active ? 1 : 0.7, cursor: canEditWorker ? 'pointer' : 'default' }}>
              <ListItemText
                primary={(
                  <Stack direction="row" spacing={1} component="span" sx={{ alignItems: 'center' }}>
                    <span>{worker.name}</span>
                    {!worker.active && <Chip size="small" label={worker.leftOn ? t('Left {date}', { date: worker.leftOn }) : t('Left')} component="span" />}
                  </Stack>
                )}
                secondary={[worker.role, t('{amount}/day', { amount: formatCurrency(worker.dailyWage) }), worker.joinedOn && t('Joined {date}', { date: worker.joinedOn }), balanceText(workerBalance(labour, worker.id))].filter(Boolean).join(' · ')}
              />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </Card>
  );

  return (
    <>
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 1.5 }}>
        <Typography variant="body2" color="text.secondary">
          {t('{count} working', { count: working.length })}
        </Typography>
        <Button variant="contained" startIcon={<AddIcon />} onClick={() => setEditing('new')}>{t('Add worker')}</Button>
      </Stack>

      {!canEditWorker && (
        <Typography variant="caption" color="text.secondary" component="p" sx={{ mb: 1 }}>
          {t('You can add workers and mark them as left. Only the admin can change wages or details, or delete a worker.')}
        </Typography>
      )}
      {!labour.workers.length ? (
        <EmptyState icon={<EngineeringIcon fontSize="large" />} title={t('No workers yet')} description={t('Add your workers with their daily wage, then mark attendance every day.')} />
      ) : (
        <>
          {renderList(working)}
          {left.length > 0 && (
            <>
              <Typography variant="subtitle2" color="text.secondary" sx={{ mt: 2, mb: 1 }}>{t('Left workers ({count})', { count: left.length })}</Typography>
              {renderList(left)}
            </>
          )}
        </>
      )}

      <SettleDialog open={Boolean(settling)} worker={settling} balance={settling ? workerBalance(labour, settling.id) : 0} onSettle={settle} onClose={() => setSettling(null)} />
      <DeleteWorkerDialog open={Boolean(deleting)} worker={deleting} onSettle={() => { const worker = deleting; setDeleting(null); setSettling(worker); }} onDelete={deleteWithRecords} onClose={() => setDeleting(null)} />
      <WorkerDialog open={Boolean(editing)} worker={editing === 'new' ? null : editing} onSave={save} onClose={() => setEditing(null)} />
      <LabourPaymentDialog
        open={Boolean(paying)}
        worker={paying}
        balance={paying ? workerBalance(labour, paying.id) : 0}
        onSave={(values) => {
          actions.addPayment({ ...values, workerId: paying.id });
          notify(t('Payment saved.'), 'success');
          setPaying(null);
        }}
        onClose={() => setPaying(null)}
      />
    </>
  );
}

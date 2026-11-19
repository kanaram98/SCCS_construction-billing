import { useEffect, useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import RestoreIcon from '@mui/icons-material/Restore';
import UndoIcon from '@mui/icons-material/Undo';
import { EmptyState, ResponsiveDialog, SelectField, useConfirm, useNotify } from '../../components/ui';
import { RECYCLE_DAYS, isDateClosed } from '../../domain/labour.js';
import { purgeBlocker, recycleBin, revertBlocker } from '../../domain/labour-ops.js';
import { describeEntry, entryInvolves, formatLogTime } from '../../domain/labour-log.js';
import { formatCurrency } from '../../domain/formatters.js';
import { PAYMENT_MODES } from '../../domain/payments.js';
import { getLanguage, tr as t } from '../../i18n/translate.js';
import { useLabour } from './useLabour.js';
import { useCloud } from '../account/CloudProvider.jsx';

const PAGE = 50;
const DAY_MS = 24 * 60 * 60 * 1000;

const BLOCKER_TEXT = {
  closed: 'Month closed',
  reverted: 'Undone',
  missing: 'Deleted forever'
};

function ActivityItem({ entry, info, blocker, onUndo }) {
  const cloud = useCloud();
  const by = cloud.members.find((member) => member.uid === entry.by)?.name;
  const mayUndo = blocker === '' && cloud.canUndo(entry);
  return (
    <Box sx={{ py: 1.25, borderBottom: 1, borderColor: 'divider' }}>
      <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
        <Box sx={{ minWidth: 0 }}>
          <Typography variant="caption" color="text.secondary">{formatLogTime(entry.at, getLanguage())}{by ? ` · ${by}` : ''}</Typography>
          <Typography variant="subtitle2">{info.title}</Typography>
          {info.lines.map((line, index) => <Typography key={index} variant="body2" color="text.secondary">{line}</Typography>)}
          {entry.revertOf && <Chip size="small" label={t('Undo of an earlier change')} sx={{ mt: 0.5 }} />}
        </Box>
        {blocker === '' && !mayUndo && <Chip size="small" variant="outlined" label={t('Admin only')} sx={{ flexShrink: 0 }} />}
        {mayUndo && <Button size="small" startIcon={<UndoIcon />} onClick={onUndo} sx={{ flexShrink: 0 }}>{t('Undo')}</Button>}
        {BLOCKER_TEXT[blocker] && <Chip size="small" variant="outlined" label={t(BLOCKER_TEXT[blocker])} sx={{ flexShrink: 0 }} />}
      </Stack>
    </Box>
  );
}

function Activity({ workerId }) {
  const { raw, actions } = useLabour();
  const confirm = useConfirm();
  const notify = useNotify();
  const [shown, setShown] = useState(PAGE);
  const names = useMemo(() => new Map(raw.workers.map((worker) => [worker.id, worker.name])), [raw.workers]);
  const entries = useMemo(() => [...(raw.log || [])]
    .filter((entry) => !workerId || entryInvolves(entry, workerId))
    .reverse(), [raw.log, workerId]);

  if (!entries.length) return <EmptyState title={t('No changes yet')} description={t('Every change to attendance, payments and workers will be listed here.')} compact />;

  async function undo(entry, info) {
    const ok = await confirm({
      title: t('Undo this change?'),
      message: [info.title, ...info.lines].join('\n'),
      confirmLabel: t('Undo')
    });
    if (!ok) return;
    actions.revert(entry.id);
    notify(t('Change undone.'), 'success');
  }

  return (
    <>
      {entries.slice(0, shown).map((entry) => {
        const info = describeEntry(entry, { names, t, language: getLanguage() });
        return <ActivityItem key={entry.id} entry={entry} info={info} blocker={revertBlocker(raw, entry)} onUndo={() => undo(entry, info)} />;
      })}
      {entries.length > shown && <Button fullWidth onClick={() => setShown((count) => count + PAGE)} sx={{ mt: 1 }}>{t('Show older')}</Button>}
    </>
  );
}

function RecycleBin({ workerId }) {
  const { raw, actions } = useLabour();
  const cloud = useCloud();
  const canPurge = cloud.can('deleteForever');
  const confirm = useConfirm();
  const notify = useNotify();
  const deletedWorkers = new Set(raw.workers.filter((worker) => worker.deletedAt).map((worker) => worker.id));
  const items = recycleBin(raw).filter((item) => !workerId || (item.type === 'worker' ? item.id === workerId : item.record.workerId === workerId));

  if (!items.length) return <EmptyState title={t('Nothing deleted')} description={t('Deleted workers and payments stay here for {days} days so you can restore them.', { days: RECYCLE_DAYS })} compact />;

  async function purge(item, label) {
    const ok = await confirm({
      title: t('Delete forever?'),
      message: `${label}. ${t('This cannot be undone.')}`,
      confirmLabel: t('Delete forever'),
      danger: true
    });
    if (!ok) return;
    const blocked = item.type === 'worker' ? purgeBlocker(raw, item.id) : [];
    if (blocked.length) { notify(t('Cannot delete forever: this worker has records in the closed month {months}. Unlock the month first.', { months: blocked.join(', ') }), 'warning'); return; }
    (item.type === 'worker' ? actions.purgeWorker : actions.purgePayment)(item.id);
  }

  return (
    <>
      <Typography variant="caption" color="text.secondary" component="p" sx={{ mb: 1 }}>
        {t('Items are deleted for good {days} days after you delete them.', { days: RECYCLE_DAYS })}
      </Typography>
      {items.map((item) => {
        const daysLeft = Math.max(0, RECYCLE_DAYS - Math.floor((Date.now() - Date.parse(item.deletedAt)) / DAY_MS));
        const { record } = item;
        const isWorker = item.type === 'worker';
        const label = isWorker
          ? `${record.name} · ${formatCurrency(record.dailyWage)}/day`
          : `${item.workerName} · ${formatCurrency(record.amount)} · ${t(PAYMENT_MODES[record.mode] || 'Cash')} · ${record.date}`;
        const blocked = !isWorker && (deletedWorkers.has(record.workerId)
          ? t('Restore the worker first.')
          : isDateClosed(raw, record.date) ? t('Month closed') : '');
        return (
          <Box key={item.id} sx={{ py: 1.25, borderBottom: 1, borderColor: 'divider' }}>
            <Typography variant="subtitle2">{isWorker ? t('Worker') : t('Payment')}</Typography>
            <Typography variant="body2">{label}</Typography>
            {!isWorker && record.note && <Typography variant="body2" color="text.secondary">{record.note}</Typography>}
            <Typography variant="caption" color="text.secondary">
              {t('Deleted {time} · {days} days left', { time: formatLogTime(item.deletedAt, getLanguage()), days: daysLeft })}
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 0.5, alignItems: 'center' }}>
              <Button
                size="small"
                variant="outlined"
                startIcon={<RestoreIcon />}
                disabled={Boolean(blocked) || !cloud.canRestore(isWorker ? 'worker' : 'payment')}
                onClick={() => {
                  (isWorker ? actions.restoreWorker : actions.restorePayment)(item.id);
                  notify(t('Restored.'), 'success');
                }}
              >
                {t('Restore')}
              </Button>
              {canPurge && <Button size="small" color="error" onClick={() => purge(item, label)}>{t('Delete forever')}</Button>}
              {blocked && <Typography variant="caption" color="text.secondary">{blocked}</Typography>}
            </Stack>
          </Box>
        );
      })}
    </>
  );
}

/** Activity log (with undo) and recycle bin for labour, for everyone or one worker. */
export default function HistoryDialog({ open, workerId: initialWorkerId = '', onClose }) {
  return (
    <ResponsiveDialog open={open} title={t('History')} onClose={onClose}>
      {open && <HistoryBody key={initialWorkerId || 'all'} initialWorkerId={initialWorkerId} />}
    </ResponsiveDialog>
  );
}

function HistoryBody({ initialWorkerId }) {
  const { refreshMembers } = useCloud();
  useEffect(() => { refreshMembers?.(); }, [refreshMembers]); // names of people who joined since sign-in
  const { raw } = useLabour();
  const [tab, setTab] = useState('activity');
  const [workerId, setWorkerId] = useState(initialWorkerId || 'all');
  const options = [
    { value: 'all', label: 'All workers' },
    ...raw.workers.map((worker) => ({ value: worker.id, label: worker.deletedAt ? `${worker.name} (${t('deleted')})` : worker.name }))
  ];

  return (
    <>
      <Tabs value={tab} onChange={(_event, value) => setTab(value)} variant="fullWidth" sx={{ mb: 1.5, borderBottom: 1, borderColor: 'divider' }}>
        <Tab value="activity" label={t('Activity')} />
        <Tab value="deleted" label={t('Recently deleted')} />
      </Tabs>
      <Box sx={{ mb: 1 }}>
        <SelectField label={t('Worker')} value={workerId} options={options} onChange={setWorkerId} size="small" />
      </Box>
      {tab === 'activity' ? <Activity workerId={workerId === 'all' ? '' : workerId} /> : <RecycleBin workerId={workerId === 'all' ? '' : workerId} />}
    </>
  );
}

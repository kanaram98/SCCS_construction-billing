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
import { useBilling } from '../../state/BillingContext.jsx';
import { RECYCLE_DAYS, recycleBin, undoBlocker } from '../../domain/history.js';
import { HISTORY_FILTERS, describeHistoryEntry, matchesFilter, recordName } from '../../domain/history-log.js';
import { formatLogTime } from '../../domain/labour-log.js';
import { getLanguage, tr as t } from '../../i18n/translate.js';
import { useCloud } from '../account/CloudProvider.jsx';

const PAGE = 50;
const DAY_MS = 24 * 60 * 60 * 1000;

const BLOCKER_TEXT = {
  reverted: 'Undone',
  missing: 'Deleted forever',
  deleted: 'Restore it first',
  trimmed: 'Too old to undo'
};

const ENTITY_NAMES = { bills: 'Bill', rates: 'Rate', clients: 'Client', templates: 'Template' };

function Activity({ filter }) {
  const { raw, actions } = useBilling();
  const cloud = useCloud();
  const names = new Map(cloud.members.map((member) => [member.uid, member.name]));
  const allowedUndo = (entry) => cloud.canUndo(entry);
  const confirm = useConfirm();
  const notify = useNotify();
  const [shown, setShown] = useState(PAGE);
  const entries = useMemo(() => [...(raw.log || [])].filter((entry) => matchesFilter(entry.entity, filter)).reverse(), [raw.log, filter]);

  if (!entries.length) return <EmptyState title={t('No changes yet')} description={t('Changes to bills, rates, clients and settings will be listed here.')} compact />;

  async function undo(entry, info) {
    const ok = await confirm({ title: t('Undo this change?'), message: [info.title, ...info.lines].join('\n'), confirmLabel: t('Undo') });
    if (!ok) return;
    actions.history.undo(entry.id);
    notify(t('Change undone.'), 'success');
  }

  return (
    <>
      {entries.slice(0, shown).map((entry) => {
        const info = describeHistoryEntry(entry, t);
        const blocker = undoBlocker(raw, entry);
        return (
          <Box key={entry.id} sx={{ py: 1.25, borderBottom: 1, borderColor: 'divider' }}>
            <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'flex-start', gap: 1 }}>
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="caption" color="text.secondary">
                  {formatLogTime(entry.at, getLanguage())}{names.get(entry.by) ? ` · ${names.get(entry.by)}` : ''}
                </Typography>
                <Typography variant="subtitle2">{info.title}</Typography>
                {info.lines.map((line, index) => <Typography key={index} variant="body2" color="text.secondary">{line}</Typography>)}
                {entry.revertOf && <Chip size="small" label={t('Undo of an earlier change')} sx={{ mt: 0.5 }} />}
              </Box>
              {blocker === '' && !allowedUndo(entry) && <Chip size="small" variant="outlined" label={t('Admin only')} sx={{ flexShrink: 0 }} />}
              {blocker === '' && allowedUndo(entry) && <Button size="small" startIcon={<UndoIcon />} onClick={() => undo(entry, info)} sx={{ flexShrink: 0 }}>{t('Undo')}</Button>}
              {BLOCKER_TEXT[blocker] && <Chip size="small" variant="outlined" label={t(BLOCKER_TEXT[blocker])} sx={{ flexShrink: 0 }} />}
            </Stack>
          </Box>
        );
      })}
      {entries.length > shown && <Button fullWidth onClick={() => setShown((count) => count + PAGE)} sx={{ mt: 1 }}>{t('Show older')}</Button>}
    </>
  );
}

function RecycleBin({ filter }) {
  const { raw, actions } = useBilling();
  const cloud = useCloud();
  const canPurge = cloud.can('deleteForever');
  const confirm = useConfirm();
  const notify = useNotify();
  const items = recycleBin(raw).filter((item) => matchesFilter(item.entity, filter));

  if (!items.length) return <EmptyState title={t('Nothing deleted')} description={t('Deleted bills, rates, clients and templates stay here for {days} days so you can restore them.', { days: RECYCLE_DAYS })} compact />;

  async function purge(item, name) {
    const ok = await confirm({ title: t('Delete forever?'), message: `${name}. ${t('This cannot be undone.')}`, confirmLabel: t('Delete forever'), danger: true });
    if (ok) actions.history.purge(item.entity, item.id);
  }

  return (
    <>
      <Typography variant="caption" color="text.secondary" component="p" sx={{ mb: 1 }}>
        {t('Items are deleted for good {days} days after you delete them.', { days: RECYCLE_DAYS })}
      </Typography>
      {items.map((item) => {
        const name = recordName(item.entity, item.label, t);
        const daysLeft = Math.max(0, RECYCLE_DAYS - Math.floor((Date.now() - Date.parse(item.deletedAt)) / DAY_MS));
        return (
          <Box key={`${item.entity}-${item.id}`} sx={{ py: 1.25, borderBottom: 1, borderColor: 'divider' }}>
            <Typography variant="subtitle2">{t(ENTITY_NAMES[item.entity])}</Typography>
            <Typography variant="body2">{name}</Typography>
            <Typography variant="caption" color="text.secondary">
              {t('Deleted {time} · {days} days left', { time: formatLogTime(item.deletedAt, getLanguage()), days: daysLeft })}
            </Typography>
            <Stack direction="row" spacing={1} sx={{ mt: 0.5 }}>
              <Button
                size="small"
                variant="outlined"
                startIcon={<RestoreIcon />}
                disabled={!cloud.canRestore(item.entity)}
                onClick={() => { actions.history.restore(item.entity, item.id); notify(t('Restored.'), 'success'); }}
              >
                {t('Restore')}
              </Button>
              {canPurge && <Button size="small" color="error" onClick={() => purge(item, name)}>{t('Delete forever')}</Button>}
            </Stack>
          </Box>
        );
      })}
    </>
  );
}

/** History (with undo) and recycle bin for bills, rates, clients, templates, firm and quotation. */
export default function HistoryDialog({ open, filter: initialFilter = 'all', onClose }) {
  return (
    <ResponsiveDialog open={open} title={t('History')} onClose={onClose}>
      {open && <HistoryBody key={initialFilter} initialFilter={initialFilter} />}
    </ResponsiveDialog>
  );
}

function HistoryBody({ initialFilter }) {
  const { refreshMembers } = useCloud();
  useEffect(() => { refreshMembers?.(); }, [refreshMembers]); // names of people who joined since sign-in
  const [tab, setTab] = useState('activity');
  const [filter, setFilter] = useState(initialFilter);
  return (
    <>
      <Tabs value={tab} onChange={(_event, value) => setTab(value)} variant="fullWidth" sx={{ mb: 1.5, borderBottom: 1, borderColor: 'divider' }}>
        <Tab value="activity" label={t('Activity')} />
        <Tab value="deleted" label={t('Recently deleted')} />
      </Tabs>
      <Box sx={{ mb: 1 }}>
        <SelectField label={t('Show')} value={filter} options={HISTORY_FILTERS} onChange={setFilter} size="small" />
      </Box>
      {tab === 'activity' ? <Activity filter={filter} /> : <RecycleBin filter={filter} />}
    </>
  );
}

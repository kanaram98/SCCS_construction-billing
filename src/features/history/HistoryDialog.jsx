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
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import { EmptyState, ResponsiveDialog, SelectField, TextField, useConfirm, useNotify } from '../../components/ui';
import { useBilling } from '../../state/BillingContext.jsx';
import { RECYCLE_DAYS, recycleBin, undoBlocker } from '../../domain/history.js';
import { hasMoney, isFinal, isFrozen } from '../../domain/bill-guard.js';
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

/** Whether a recycle-bin item is a record of money (a bill with payments or in a series, an advance, an expense, a project). */
function holdsMoney(raw, item) {
  if (['advances', 'expenses', 'projects'].includes(item.entity)) return true;
  if (item.entity !== 'bills') return false;
  const record = (raw.bills || []).find((entry) => entry.id === item.id);
  return Boolean(record && (hasMoney(record) || record.raSeriesId || isFinal(record)));
}

const ENTITY_NAMES = { bills: 'Bill', rates: 'Rate', clients: 'Client', templates: 'Template' };

function Activity({ filter }) {
  const { raw, actions } = useBilling();
  const cloud = useCloud();
  const names = new Map(cloud.members.map((member) => [member.uid, member.name]));
  // A settled or cancelled bill is read-only for the contractor, so he cannot undo changes made to it either.
  const frozenBill = (entry) => entry.entity === 'bills' && isFrozen((raw.bills || []).find((bill) => bill.id === entry.refId || bill.id === entry.id));
  const allowedUndo = (entry) => cloud.canUndo(entry) && (cloud.can('reopenBill') || !frozenBill(entry));
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

  const [wiping, setWiping] = useState(false);
  const [emptying, setEmptying] = useState(false);
  const [word, setWord] = useState('');

  // After "Delete everything", wait until the deletions have reached the cloud, then empty the bin.
  useEffect(() => {
    if (!emptying) return undefined;
    const started = Date.now();
    const timer = setInterval(async () => {
      if (Date.now() - started < 2500) return;
      if ((await cloud.pendingChanges()) > 0 && Date.now() - started < 60000) return;
      clearInterval(timer);
      actions.history.emptyRecycleBin();
      setEmptying(false);
      notify(t('Everything is deleted.'), 'success');
    }, 1000);
    return () => clearInterval(timer);
  }, [emptying]); // eslint-disable-line react-hooks/exhaustive-deps

  const eraseTools = canPurge && (
    <>
      <Stack direction="row" spacing={1} sx={{ mb: 1.5 }}>
        <Button size="small" color="error" variant="outlined" disabled={emptying} onClick={() => { setWord(''); setWiping(true); }}>{emptying ? t('Deleting… keep this open') : t('Delete everything…')}</Button>
        {items.length > 0 && <Button size="small" color="error" disabled={emptying} onClick={() => setEmptying(true)}>{t('Empty recycle bin')}</Button>}
      </Stack>
      <Dialog open={wiping} onClose={() => setWiping(false)} maxWidth="xs" fullWidth>
        <DialogTitle>{t('Delete everything?')}</DialogTitle>
        <DialogContent>
          <DialogContentText sx={{ mb: 1.5 }}>{t('All bills, estimates, quotations, projects, advances, expenses, clients and workers are deleted for good. Your rates, templates and firm details stay. This cannot be undone.')}</DialogContentText>
          <TextField label={t('Type DELETE to confirm')} value={word} onChange={setWord} autoFocus />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setWiping(false)}>{t('Cancel')}</Button>
          <Button color="error" variant="contained" disabled={word.trim() !== 'DELETE'} onClick={() => { setWiping(false); actions.history.deleteEverything(); setEmptying(true); }}>{t('Delete everything')}</Button>
        </DialogActions>
      </Dialog>
    </>
  );

  if (!items.length) return <>{eraseTools}<EmptyState title={t('Nothing deleted')} description={t('Deleted bills, rates, clients and templates stay here for {days} days so you can restore them.', { days: RECYCLE_DAYS })} compact /></>;

  async function purge(item, name) {
    const ok = await confirm({ title: t('Delete forever?'), message: `${name}. ${t('This cannot be undone.')}`, confirmLabel: t('Delete forever'), danger: true });
    if (!ok) return;
    // Money records get a second, plainly worded confirmation: once purged they are gone from the books.
    if (holdsMoney(raw, item)) {
      const again = await confirm({ title: t('This is a money record'), message: t('Payments, advances, expenses and bills with payments are part of your accounts. Deleting them forever changes your totals and cannot be undone. Delete anyway?'), confirmLabel: t('Yes, delete forever'), danger: true });
      if (!again) return;
    }
    actions.history.purge(item.entity, item.id);
  }

  return (
    <>
      {eraseTools}
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

import { useEffect, useMemo, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import IconButton from '@mui/material/IconButton';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { alpha } from '@mui/material/styles';
import AddIcon from '@mui/icons-material/Add';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteIcon from '@mui/icons-material/DeleteOutlined';
import { ResponsiveDialog, TextField, useConfirm, useNotify } from '../../components/ui';
import { useBilling } from '../../state/BillingContext.jsx';
import { getItemQuantity, getLineAmount } from '../../domain/calculations.js';
import { getDimensionFields, usesCount } from '../../domain/rates.js';
import { validateEntry } from '../../domain/validation.js';
import { formatCurrency } from '../../domain/formatters.js';
import { tr as t, trn } from '../../i18n/translate.js';
import WorkItemPicker from './WorkItemPicker.jsx';

const SHORT_LABELS = { length: 'Length', width: 'Width', height: 'Height' };
const FIELD_KEYS = ['count', 'length', 'width', 'height', 'quantity', 'note'];

const blankRow = (key, rateId = '') => ({ key, itemId: null, rateId, count: '1', length: '', width: '', height: '', quantity: '1', note: '', saved: '', touched: false });
const rowFromItem = (item) => withSaved({
  key: item.id,
  itemId: item.id,
  rateId: item.rateId,
  count: item.count ?? '1',
  length: item.length ?? '',
  width: item.width ?? '',
  height: item.height ?? '',
  quantity: item.quantity ?? '1',
  note: item.note ?? '',
  saved: '',
  touched: false,
  fallback: { id: item.rateId, name: item.name, unit: item.unit, type: item.type, rate: item.rate }
});
function snapshot(row) {
  return JSON.stringify([row.rateId, ...FIELD_KEYS.map((key) => String(row[key] ?? ''))]);
}
/** An entry that is already saved starts out equal to what is saved, so leaving it alone saves nothing. */
function withSaved(row) {
  return { ...row, saved: snapshot(row) };
}

/** A row with nothing typed yet (only a work item, or nothing): neither saved nor counted as unfinished. */
const isUntouched = (row) => !row.itemId && !row.length && !row.width && !row.height && !row.note && row.count === '1' && row.quantity === '1';

/**
 * Paper-first entry: every entry of one room as an editable row. Type straight down the list;
 * "Next" on the keyboard moves from field to field and on to a new row. Each row is saved as soon as
 * it is complete and you move away from it, so nothing is lost if the phone is closed.
 */
export default function EntrySheet({ open, section, area, focusItemId = '', onClose }) {
  return (
    <>
      {open && <SheetBody key={`${area.id}:${focusItemId}`} section={section} area={area} focusItemId={focusItemId} onClose={onClose} />}
    </>
  );
}

function SheetBody({ section, area, focusItemId, onClose }) {
  const { data, bill, actions } = useBilling();
  const { entry } = actions;
  const notify = useNotify();
  const confirm = useConfirm();
  const counter = useRef(0);
  const nextKey = () => `new-${(counter.current += 1)}`;
  const bodyRef = useRef(null);
  const [rows, setRows] = useState(() => [...area.items.map(rowFromItem), blankRow(`new-${(counter.current += 1)}`)]);
  const [shake, setShake] = useState(false);

  /** Work items used lately in this bill, newest first, so the usual ones are one tap away. */
  const recentIds = useMemo(() => {
    const ids = [];
    for (const sectionEntry of bill.sections || []) {
      for (const areaEntry of sectionEntry.areas || []) {
        for (const item of areaEntry.items || []) {
          const index = ids.indexOf(item.rateId);
          if (index >= 0) ids.splice(index, 1);
          ids.push(item.rateId);
        }
      }
    }
    return ids.reverse().filter((id) => data.rates.some((rate) => rate.id === id)).slice(0, 6);
  }, [bill.sections, data.rates]);

  const rateOf = (row) => data.rates.find((rate) => rate.id === row.rateId) || row.fallback || null;
  const valuesOf = (row, rate) => ({ ...Object.fromEntries(FIELD_KEYS.map((key) => [key, row[key]])), name: rate.name, unit: rate.unit, type: rate.type, rate: rate.rate });
  const issuesOf = (row) => { const rate = rateOf(row); return row.rateId && rate ? validateEntry(row, rate) : []; };
  const amountOf = (row) => {
    const rate = rateOf(row);
    if (!rate || issuesOf(row).length) return null;
    return getLineAmount(row, rate);
  };
  const total = rows.reduce((sum, row) => sum + (amountOf(row) || 0), 0);
  const unfinished = rows.filter((row) => row.rateId && !isUntouched(row) && issuesOf(row).length);

  function patch(key, changes) {
    setShake(false);
    setRows((current) => current.map((row) => (row.key === key ? { ...row, ...changes } : row)));
  }

  /** Saves a complete row (new or changed); an unfinished row stays on screen only. */
  function commit(row) {
    const rate = rateOf(row);
    if (!rate || !row.rateId || issuesOf(row).length) return;
    const now = snapshot(row);
    if (row.itemId && row.saved === now) return;
    if (row.itemId) {
      entry.updateItem(section.id, area.id, row.itemId, valuesOf(row, rate));
      patch(row.key, { saved: now });
    } else {
      const item = entry.addItem(section.id, area.id, row.rateId, valuesOf(row, rate));
      if (item) patch(row.key, { itemId: item.id, saved: now });
    }
  }

  function inputs() {
    return [...(bodyRef.current?.querySelectorAll('[data-sheet-input]') || [])].filter((element) => !element.disabled);
  }

  function focusRowFirstField(key) {
    window.setTimeout(() => {
      const fields = inputs().filter((element) => element.dataset.row === key);
      // the measurement first: how many (Nos) is nearly always 1, so it is reached by tapping, not typed through
      const numbers = fields.filter((element) => element.dataset.sheetInput !== 'item');
      (numbers.find((element) => element.dataset.sheetInput !== 'count') || numbers[0] || fields[0])?.focus();
    }, 40);
  }

  function focusNewRowItem(key) {
    window.setTimeout(() => inputs().find((element) => element.dataset.row === key && element.dataset.sheetInput === 'item')?.focus(), 60);
  }

  /** Enter / the keyboard's Next key: on to the next field, then the next row, adding one at the end. */
  function advance(element) {
    const list = inputs();
    const index = list.indexOf(element);
    const next = list[index + 1];
    if (next && next.dataset.row === element.dataset.row && next.dataset.sheetInput !== 'item') { next.focus(); return; }
    // end of this row: save it, then go to the following row's work item (or a new row)
    const key = element.dataset.row;
    const row = rows.find((entryRow) => entryRow.key === key);
    if (row) commit({ ...row, touched: true });
    const following = list.slice(index + 1).find((candidate) => candidate.dataset.sheetInput === 'item');
    if (following) { following.focus(); return; }
    const created = nextKey();
    setRows((current) => [...current, blankRow(created)]);
    focusNewRowItem(created);
  }

  function addRow() {
    const created = nextKey();
    setRows((current) => [...current, blankRow(created)]);
    focusNewRowItem(created);
  }

  function repeatRow(row) {
    const created = nextKey();
    setRows((current) => {
      const index = current.findIndex((entryRow) => entryRow.key === row.key);
      const copy = { ...row, key: created, itemId: null, saved: '', touched: true, fallback: undefined };
      return [...current.slice(0, index + 1), copy, ...current.slice(index + 1)];
    });
    focusRowFirstField(created);
  }

  async function removeRow(row) {
    if (row.itemId) {
      const rate = rateOf(row);
      const ok = await confirm({ title: t('Delete this entry?'), message: rate?.name || '', confirmLabel: t('Delete'), danger: true });
      if (!ok) return;
      entry.removeItem(section.id, area.id, row.itemId);
    }
    setRows((current) => {
      const left = current.filter((entryRow) => entryRow.key !== row.key);
      return left.length ? left : [blankRow(nextKey())];
    });
  }

  function onRowBlur(event, row) {
    if (event.currentTarget.contains(event.relatedTarget)) return;
    patch(row.key, { touched: true });
    commit({ ...row, touched: true });
  }

  function onKeyDown(event) {
    if (event.key !== 'Enter' || event.defaultPrevented || !event.target.dataset?.sheetInput) return; // defaultPrevented: the list just took the choice
    if (event.target.dataset.sheetInput === 'item' && event.target.getAttribute('aria-expanded') === 'true') return; // choosing from the list
    event.preventDefault();
    advance(event.target);
  }

  // Start where the user tapped: a tapped entry, or the first empty row.
  useEffect(() => {
    const target = focusItemId ? rows.find((row) => row.itemId === focusItemId) : rows.find((row) => !row.itemId);
    if (!target) return;
    if (focusItemId) focusRowFirstField(target.key);
    else focusNewRowItem(target.key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function finish() {
    rows.forEach((row) => commit({ ...row, touched: true }));
    if (unfinished.length) {
      setShake(true);
      notify(trn(unfinished.length, '{count} entry is not finished. Fill in its measurements or delete it.', '{count} entries are not finished. Fill in their measurements or delete them.'), 'warning');
      return;
    }
    onClose();
  }

  async function close() {
    if (unfinished.length) {
      const ok = await confirm({
        title: t('Leave without saving?'),
        message: trn(unfinished.length, '{count} unfinished entry will not be saved.', '{count} unfinished entries will not be saved.'),
        confirmLabel: t('Leave'),
        danger: true
      });
      if (!ok) return;
    }
    rows.forEach((row) => commit({ ...row, touched: true }));
    onClose();
  }

  const saved = rows.filter((row) => row.itemId).length;

  return (
    <ResponsiveDialog
      open
      onClose={close}
      title={`${area.name}`}
      actions={(
        <>
          <Button startIcon={<AddIcon />} onClick={addRow}>{t('Add row')}</Button>
          <Button variant="contained" onClick={finish}>{t('Done')}</Button>
        </>
      )}
    >
      <Box ref={bodyRef} onKeyDown={onKeyDown}>
        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'baseline', mb: 1.5, position: 'sticky', top: -16, zIndex: 2, bgcolor: 'background.paper', py: 0.5 }}>
          <Typography variant="body2" color="text.secondary">{trn(saved, '{count} entry saved', '{count} entries saved')}</Typography>
          <Typography variant="subtitle1" color="primary" sx={{ fontWeight: 700 }}>{t('Room total')}: {formatCurrency(total)}</Typography>
        </Stack>

        <Stack spacing={1.5}>
          {rows.map((row, index) => {
            const rate = rateOf(row);
            const issues = issuesOf(row);
            const fields = rate ? getDimensionFields(rate.type) : [];
            const amount = amountOf(row);
            const showIssue = row.touched && row.rateId && !isUntouched(row) && issues.length > 0;
            return (
              <Box
                key={row.key}
                onBlur={(event) => onRowBlur(event, row)}
                sx={(theme) => {
                  const flagged = showIssue || (shake && unfinished.includes(row));
                  return {
                    border: 1,
                    borderStyle: row.itemId ? 'solid' : 'dashed', // a saved entry is solid, a row still to fill is dashed
                    borderColor: flagged ? 'error.main' : 'divider',
                    borderRadius: 2,
                    p: 1.25,
                    bgcolor: row.itemId ? alpha(theme.palette.primary.main, 0.05) : 'action.hover',
                    // dark mode: the sheet and the rows were the same dark; lift the rows and strengthen their edge
                    ...theme.applyStyles('dark', { bgcolor: alpha('#ffffff', row.itemId ? 0.08 : 0.04), borderColor: flagged ? theme.palette.error.main : alpha('#ffffff', 0.3) })
                  };
                }}
              >
                <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start' }}>
                  <Typography variant="caption" color="text.secondary" sx={{ pt: 1.25, minWidth: 18, fontWeight: 700 }}>{index + 1}</Typography>
                  <Box sx={{ flex: 1, minWidth: 0 }}>
                    <WorkItemPicker
                      compact
                      rates={data.rates}
                      value={row.rateId}
                      recentIds={recentIds}
                      inputProps={{ 'data-sheet-input': 'item', 'data-row': row.key, enterKeyHint: 'next' }}
                      onChange={(rateId) => { patch(row.key, { rateId, touched: true }); focusRowFirstField(row.key); }}
                    />
                  </Box>
                  <Typography variant="subtitle2" color={amount === null ? 'text.disabled' : 'primary'} sx={{ pt: 1, minWidth: 64, textAlign: 'right', whiteSpace: 'nowrap' }}>
                    {amount === null ? '—' : formatCurrency(amount)}
                  </Typography>
                </Stack>

                {rate && (
                  <Stack direction="row" spacing={1} sx={{ mt: 1, ml: 3.25 }}>
                    {usesCount(rate.type) && (
                      <Field label={t('Nos')} value={row.count} row={row} name="count" onChange={(value) => patch(row.key, { count: value, touched: true })} />
                    )}
                    {fields.map((field) => (
                      <Field key={field.key} label={t(SHORT_LABELS[field.key] || field.label)} value={row[field.key]} row={row} name={field.key} unit="ft.in" onChange={(value) => patch(row.key, { [field.key]: value, touched: true })} />
                    ))}
                    {!usesCount(rate.type) && (
                      <Field label={t('Qty ({unit})', { unit: rate.unit })} value={row.quantity} row={row} name="quantity" onChange={(value) => patch(row.key, { quantity: value, touched: true })} />
                    )}
                  </Stack>
                )}

                {rate && !issues.length && (
                  <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 0.5, ml: 3.25 }}>
                    {getItemQuantity(row, rate)} {rate.unit} × {formatCurrency(rate.rate)}
                  </Typography>
                )}
                {showIssue && <Typography variant="caption" color="error" component="div" sx={{ mt: 0.5, ml: 3.25 }}>{issues[0]}</Typography>}

                {rate && (
                  <Stack direction="row" sx={{ mt: 0.5, ml: 3.25, alignItems: 'center' }}>
                    <NoteField row={row} onChange={(value) => patch(row.key, { note: value, touched: true })} />
                    <IconButton aria-label={t('Repeat entry {number}', { number: index + 1 })} onClick={() => repeatRow(row)} disabled={Boolean(issues.length)} sx={{ width: 44, height: 44 }}><ContentCopyIcon fontSize="small" /></IconButton>
                    <IconButton aria-label={t('Delete entry {number}', { number: index + 1 })} onClick={() => removeRow(row)} color="error" sx={{ width: 44, height: 44 }}><DeleteIcon fontSize="small" /></IconButton>
                  </Stack>
                )}
              </Box>
            );
          })}
        </Stack>
      </Box>
    </ResponsiveDialog>
  );
}

/** One short numeric box of a row; Next on the keyboard moves on. */
function Field({ label, value, row, name, unit, onChange }) {
  return (
    <TextField
      size="small"
      label={label}
      value={value}
      inputMode="decimal"
      placeholder={unit ? '0.0' : ''}
      onChange={onChange}
      slotProps={{ htmlInput: { 'data-sheet-input': name, 'data-row': row.key, enterKeyHint: 'next', onFocus: (event) => event.target.select(), style: { minHeight: 28 } }, inputLabel: { shrink: true } }}
      sx={{ flex: 1, minWidth: 0 }}
    />
  );
}

/** The note is hidden until wanted, so rows stay short. */
function NoteField({ row, onChange }) {
  const [open, setOpen] = useState(Boolean(row.note));
  if (!open) {
    return <Link component="button" type="button" underline="hover" variant="caption" onClick={() => setOpen(true)} sx={{ flex: 1, textAlign: 'left' }}>{t('+ Note')}</Link>;
  }
  return (
    <TextField
      size="small"
      value={row.note}
      placeholder={t('Note (optional)')}
      onChange={onChange}
      slotProps={{ htmlInput: { 'data-sheet-input': 'note', 'data-row': row.key, enterKeyHint: 'next', 'aria-label': t('Note (optional)') } }}
      sx={{ flex: 1 }}
    />
  );
}

import { Fragment, useEffect, useMemo, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Link from '@mui/material/Link';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import CalculateIcon from '@mui/icons-material/CalculateOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutlined';
import PlaylistAddIcon from '@mui/icons-material/PlaylistAddOutlined';
import { ResponsiveDialog, TextField, useConfirm, useNotify } from '../../components/ui';
import { useBilling } from '../../state/BillingContext.jsx';
import { billStyleOf, getAreaTotal, getItemQuantity, getLineAmount, groupItemLines } from '../../domain/calculations.js';
import { ENTRY_FORMULAS, UNIT_CHOICES, describeMeasurement, formulaLabel, getDimensionFields, measuredAs, resolveRate, usesCount } from '../../domain/rates.js';
import { validateEntry } from '../../domain/validation.js';
import { MEASUREMENT_KEYS } from '../../domain/bill-tree.js';
import { formatCurrency, formatQuantity } from '../../domain/formatters.js';
import { quotedRates } from '../../domain/quotations.js';
import { tr as t, trn } from '../../i18n/translate.js';
import FeetInchCalculator from './FeetInchCalculator.jsx';
import AddWorksDialog from './AddWorksDialog.jsx';
import WorkItemPicker from './WorkItemPicker.jsx';

const SHORT_LABELS = { length: 'Length', width: 'Width', height: 'Height' };
const FIELD_KEYS = ['count', 'length', 'width', 'height', 'quantity', 'note', 'calc', 'calcUnit'];
const BLANK = { itemId: null, linkedTo: '', rateId: '', calc: '', calcUnit: '', count: '1', length: '', width: '', height: '', quantity: '1', note: '' };

const formFromItem = (item) => ({
  itemId: item.id,
  linkedTo: item.linkedTo ?? '',
  rateId: item.rateId,
  calc: item.calc ?? '',
  calcUnit: item.calcUnit ?? '',
  count: item.count ?? '1',
  length: item.length ?? '',
  width: item.width ?? '',
  height: item.height ?? '',
  quantity: item.quantity ?? '1',
  note: item.note ?? ''
});

/** Nothing typed beyond the work item itself. */
const isUntouched = (form) => !form.linkedTo && !form.length && !form.width && !form.height && !form.note && form.count === '1' && form.quantity === '1';

/**
 * Add the entries of one room. A small form at the top (work item, measurements, Add) and the entries
 * already in the room listed below it. After Add the form keeps the work item and clears the
 * measurements, so the same kind of entry is quick to repeat. Tap an entry below to change it.
 */
export default function EntrySheet({ open, section, area, focusItemId = '', onClose }) {
  return <>{open && <SheetBody key={`${area.id}:${focusItemId}`} section={section} area={area} focusItemId={focusItemId} onClose={onClose} />}</>;
}

function SheetBody({ section, area, focusItemId, onClose }) {
  const { data, bill, actions } = useBilling();
  const { entry } = actions;
  const notify = useNotify();
  const confirm = useConfirm();
  const bodyRef = useRef(null);
  const [form, setForm] = useState(() => {
    const item = focusItemId && area.items.find((entryItem) => entryItem.id === focusItemId);
    return item ? formFromItem(item) : { ...BLANK };
  });
  const [touched, setTouched] = useState(false);
  const [showFormulas, setShowFormulas] = useState(false);
  const [calculator, setCalculator] = useState(false);
  /** What the pop-up is adding works to: { item } (one entry's measurement) or { group } (the total of a work item in this room). */
  const [shareFrom, setShareFrom] = useState(null);

  // New entries are priced from the bill's quotation (or the standard rates); a saved entry keeps its own price.
  const quoted = useMemo(() => quotedRates(data.rates, data.quotations.find((entryQuotation) => entryQuotation.id === bill.quotationId)), [data.rates, data.quotations, bill.quotationId]);
  const editing = form.itemId ? area.items.find((item) => item.id === form.itemId) : null;
  // The work item as priced. The entry may measure it its own way (form.calc); `rate` is the work item as measured here.
  const baseRate = form.rateId ? (editing && editing.rateId === form.rateId ? resolveRate({ ...editing, calc: '', calcUnit: '' }, quoted) : quoted.find((entryRate) => entryRate.id === form.rateId) || null) : null;
  const rate = baseRate ? measuredAs(baseRate, form.calc, form.calcUnit) : baseRate;
  /** The entry whose measurement this one shares (another work on the same door, floor area ...). */
  const source = form.linkedTo ? area.items.find((item) => item.id === form.linkedTo && item.id !== form.itemId) || null : null;
  const measure = source ? { ...form, ...Object.fromEntries(MEASUREMENT_KEYS.map((key) => [key, source[key] ?? ''])) } : form;
  const nameOf = (item) => `${item.name}${item.note ? ` · ${item.note}` : ''}`;
  const issues = rate ? validateEntry(measure, rate) : [];
  const amount = rate && !issues.length ? getLineAmount(measure, rate) : null;
  const fields = rate ? getDimensionFields(rate.type) : [];
  const roomStyle = billStyleOf(bill) === 'room';
  const total = getAreaTotal(area, quoted, billStyleOf(bill));
  const [floorOpen, setFloorOpen] = useState(false);
  /** Entries of the same work item are listed together under their total (in a new-style bill, the line the bill shows for them). */
  const roomGroups = useMemo(() => groupItemLines(area.items, quoted), [area.items, quoted]);
  const orderedItems = roomGroups.flatMap((group) => group.items);
  /** Entries that belong to a group header, so they can be tinted like it. */
  const inGroup = new Set(roomGroups.filter((group) => group.items.length > 1).flatMap((group) => group.items));
  const groupOfFirst = new Map(roomGroups.filter((group) => group.items.length > 1).map((group) => [group.items[0], group]));
  /** All the lines of this floor, as the "By floor" layout of the bill shows them. */
  const floorLines = useMemo(() => {
    if (!roomStyle) return [];
    const live = (bill.sections || []).find((entry) => entry.id === section.id) || section;
    return groupItemLines((live.areas || []).flatMap((entry) => (entry.id === area.id ? area.items : entry.items || [])), quoted);
  }, [roomStyle, bill.sections, section, area, quoted]);

  /** Work items used lately in this bill, newest first. */
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
    return ids.reverse().filter((id) => quoted.some((entryRate) => entryRate.id === id && !entryRate.archived)).slice(0, 5);
  }, [bill.sections, quoted]);

  const focusField = (name) => window.setTimeout(() => {
    const inputs = [...(bodyRef.current?.querySelectorAll('[data-sheet-input]') || [])].filter((element) => !element.disabled);
    (name ? inputs.find((element) => element.dataset.sheetInput === name) : inputs.find((element) => element.dataset.sheetInput !== 'item' && element.dataset.sheetInput !== 'count') || inputs.find((element) => element.dataset.sheetInput === 'count'))?.focus();
  }, 40);

  const update = (changes) => setForm((current) => ({ ...current, ...changes }));
  const pickRate = (rateId) => { update({ rateId, calc: rateId === form.rateId ? form.calc : '', calcUnit: rateId === form.rateId ? form.calcUnit : '' }); setShowFormulas(false); setTouched(true); if (rateId) focusField(); };

  /** Saves the form as a new entry, or as the change to the entry being edited. Returns true when saved. */
  function save() {
    setTouched(true);
    if (!rate || !form.rateId || issues.length) return false;
    const values = { ...Object.fromEntries(FIELD_KEYS.map((key) => [key, measure[key]])), ...(source ? { linkedTo: source.id } : editing?.linkedTo ? { linkedTo: '' } : {}), calc: form.calc === baseRate.type ? '' : form.calc, calcUnit: rate.type === 'direct' && form.calcUnit.trim() !== baseRate.unit ? form.calcUnit.trim() : '', name: baseRate.name, unit: baseRate.unit, type: baseRate.type, rate: baseRate.rate };
    if (form.itemId) entry.updateItem(section.id, area.id, form.itemId, values);
    else if (!entry.addItem(section.id, area.id, form.rateId, values)) return false;
    return true;
  }

  function add() {
    const wasEditing = Boolean(form.itemId);
    if (!save()) return;
    if (wasEditing) setForm({ ...BLANK });
    else if (source) setForm({ ...BLANK, linkedTo: source.id }); // the next work on the same measurement
    else setForm({ ...BLANK, rateId: form.rateId, calc: form.calc, calcUnit: form.calcUnit }); // same work item, way of measuring and unit again; only the measurements are cleared
    setTouched(false);
    if (wasEditing) window.setTimeout(() => bodyRef.current?.querySelector('[data-sheet-input="item"]')?.focus(), 40);
    else focusField();
  }

  async function remove(item) {
    const ok = await confirm({ title: t('Delete this entry?'), message: resolveRate(item, quoted).name, confirmLabel: t('Delete'), danger: true });
    if (!ok) return;
    entry.removeItem(section.id, area.id, item.id);
    if (form.itemId === item.id) setForm({ ...BLANK });
  }

  /** One new entry per chosen work item, all sharing the numbers of the entry the pop-up was opened from. */
  function addWorks(rateIds) {
    const { item: from, group } = shareFrom;
    rateIds.forEach((rateId) => {
      if (from) {
        entry.addItem(section.id, area.id, rateId, Object.fromEntries([['linkedTo', from.id], ...MEASUREMENT_KEYS.map((key) => [key, from[key] ?? ''])]));
        return;
      }
      // The total of a work item: one entry of that quantity, in the unit of the total.
      const base = quoted.find((entryRate) => entryRate.id === rateId);
      entry.addItem(section.id, area.id, rateId, { calc: base.type === 'direct' ? '' : 'direct', calcUnit: group.unit !== base.unit ? group.unit : '', count: 1, quantity: String(group.quantity), note: t('Total of {name}', { name: group.name }) });
    });
    setShareFrom(null);
    notify(trn(rateIds.length, '{count} work added on {name}.', '{count} works added on {name}.', { name: from ? nameOf(from) : group.name }));
  }

  function onKeyDown(event) {
    if (event.key !== 'Enter' || event.defaultPrevented || !event.target.dataset?.sheetInput) return;
    if (event.target.dataset.sheetInput === 'item') return; // choosing from the list
    event.preventDefault();
    const inputs = [...(bodyRef.current?.querySelectorAll('[data-sheet-input]') || [])].filter((element) => !element.disabled && element.dataset.sheetInput !== 'item');
    const next = inputs[inputs.indexOf(event.target) + 1];
    if (next) next.focus();
    else add(); // Enter in the last box adds the entry
  }

  useEffect(() => {
    if (focusItemId) focusField();
    else window.setTimeout(() => bodyRef.current?.querySelector('[data-sheet-input="item"]')?.focus(), 80);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const pending = form.rateId && !isUntouched(form);
  const unfinished = Boolean(pending && issues.length);

  async function finish() {
    if (pending && !issues.length) save(); // whatever is typed is not lost
    if (unfinished) {
      setTouched(true);
      notify(trn(1, '{count} entry is not finished. Fill in its measurements or delete it.', '{count} entries are not finished. Fill in their measurements or delete them.'), 'warning');
      return;
    }
    onClose();
  }

  async function close() {
    if (unfinished) {
      const ok = await confirm({ title: t('Leave without saving?'), message: trn(1, '{count} unfinished entry will not be saved.', '{count} unfinished entries will not be saved.'), confirmLabel: t('Leave'), danger: true });
      if (!ok) return;
    } else if (pending && !issues.length) save();
    onClose();
  }

  return (
    <ResponsiveDialog
      open
      onClose={close}
      title={area.name}
      actions={<Button variant="contained" onClick={finish}>{t('Done')}</Button>}
    >
      <Box ref={bodyRef} onKeyDown={onKeyDown}>
        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'baseline', mb: 1 }}>
          <Typography variant="body2" color="text.secondary">{trn(area.items.length, '{count} entry saved', '{count} entries saved')}</Typography>
          <Typography variant="subtitle1" color="primary" sx={{ fontWeight: 700 }}>{t('Room total')}: {formatCurrency(total)}</Typography>
        </Stack>

        {/* The form */}
        <Box sx={{ border: 1, borderColor: editing ? 'primary.main' : 'divider', borderRadius: 2, p: 1.25, bgcolor: 'background.default' }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700, display: 'block', mb: 0.75 }}>
            {editing ? t('Changing an entry') : t('New entry')}
          </Typography>
          <WorkItemPicker
            compact
            rates={quoted.filter((entryRate) => !entryRate.archived || entryRate.id === form.rateId)}
            value={form.rateId}
            recentIds={recentIds}
            inputProps={{ 'data-sheet-input': 'item', enterKeyHint: 'next' }}
            onChange={pickRate}
          />
          {rate && (
            <Box sx={{ mt: 1 }}>
              <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', gap: 1 }}>
                <Typography variant="caption" color="text.secondary" sx={{ minWidth: 0 }}>
                  {t('Measured as')}: <strong>{t(formulaLabel(rate.type))}</strong> · <strong>{rate.unit}</strong>{' '}
                  <Link component="button" type="button" underline="hover" variant="caption" onClick={() => setShowFormulas((current) => !current)}>{showFormulas ? t('Hide') : t('Change')}</Link>
                </Typography>
                <Button size="small" startIcon={<CalculateIcon fontSize="small" />} onClick={() => setCalculator(true)} sx={{ flexShrink: 0 }}>{t('Calculator')}</Button>
              </Stack>
              {showFormulas && (
                <Box sx={{ mt: 0.75 }}>
                  <Stack direction="row" sx={{ gap: 0.75, flexWrap: 'wrap' }}>
                    {ENTRY_FORMULAS.map((formula) => (
                      <Chip key={formula.id} size="small" label={t(formula.label)} color={rate.type === formula.id ? 'primary' : 'default'} variant={rate.type === formula.id ? 'filled' : 'outlined'}
                        onClick={() => { update({ calc: formula.id === baseRate.type ? '' : formula.id }); setTouched(true); }} />
                    ))}
                  </Stack>
                  {rate.type === 'direct' && (
                    <Box sx={{ mt: 0.75 }}>
                      <TextField size="small" label={t('Unit')} value={form.calcUnit || baseRate.unit} onChange={(value) => { update({ calcUnit: value }); setTouched(true); }} slotProps={{ htmlInput: { maxLength: 20 }, inputLabel: { shrink: true } }} sx={{ maxWidth: 160 }} />
                      <Stack direction="row" sx={{ gap: 0.75, flexWrap: 'wrap', mt: 0.75 }}>
                        {[...new Set([baseRate.unit, ...UNIT_CHOICES])].filter(Boolean).map((unit) => (
                          <Chip key={unit} size="small" label={unit} color={rate.unit === unit ? 'primary' : 'default'} variant={rate.unit === unit ? 'filled' : 'outlined'} onClick={() => { update({ calcUnit: unit === baseRate.unit ? '' : unit }); setTouched(true); }} />
                        ))}
                      </Stack>
                    </Box>
                  )}
                  <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 0.5 }}>
                    {t('Quantity')} = {t(ENTRY_FORMULAS.find((formula) => formula.id === rate.type)?.formula || '')}. {rate.type === 'direct' ? t('Type any unit. The price is for each {unit}.', { unit: rate.unit }) : t('The unit goes with the way of measuring. The price is for each {unit}.', { unit: rate.unit })}
                  </Typography>
                </Box>
              )}
            </Box>
          )}
          {rate && source && (
            <Typography variant="body2" sx={{ mt: 1 }}>{t('Uses the measurement of {name}', { name: nameOf(source) })}: <strong>{describeMeasurement(source, resolveRate(source, quoted))}</strong>{' '}
              <Link component="button" type="button" underline="hover" variant="body2" onClick={() => update({ linkedTo: '', ...Object.fromEntries(MEASUREMENT_KEYS.map((key) => [key, source[key] ?? ''])) })}>{t('Measure separately')}</Link>
            </Typography>
          )}
          {rate && !source && (
            <Stack direction="row" sx={{ mt: 1, gap: 1, flexWrap: 'wrap', alignItems: 'flex-end' }}>
              {usesCount(rate.type) && <Field label={t('Nos')} value={form.count} name="count" onChange={(value) => { update({ count: value }); setTouched(true); }} />}
              {fields.map((field) => (
                <Field key={field.key} label={t(SHORT_LABELS[field.key] || field.label)} value={form[field.key]} name={field.key} unit="ft.in" onChange={(value) => { update({ [field.key]: value }); setTouched(true); }} />
              ))}
              {!usesCount(rate.type) && <Field label={t('Qty ({unit})', { unit: rate.unit })} value={form.quantity} name="quantity" onChange={(value) => { update({ quantity: value }); setTouched(true); }} />}
            </Stack>
          )}
          {rate && (
            <Stack direction="row" sx={{ mt: 0.75, alignItems: 'center', justifyContent: 'space-between' }}>
              <Typography variant="caption" color={touched && pending && issues.length ? 'error' : 'text.secondary'} sx={{ flex: 1, minWidth: 0 }}>
                {touched && pending && issues.length ? issues[0] : issues.length ? '' : `${describeMeasurement(measure, rate)} → ${formatQuantity(getItemQuantity(measure, rate), rate.type)} ${rate.unit} × ${formatCurrency(rate.rate)}`}
              </Typography>
              <Typography variant="subtitle1" color={amount === null ? 'text.disabled' : 'primary'} sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{amount === null ? '—' : formatCurrency(amount)}</Typography>
            </Stack>
          )}
          {rate && <NoteField key={form.itemId || 'new'} value={form.note} onChange={(value) => update({ note: value })} />}
          <Stack direction="row" spacing={1} sx={{ mt: 1 }}>
            {editing && <Button onClick={() => { setForm({ ...BLANK }); setTouched(false); }}>{t('Cancel')}</Button>}
            <Button fullWidth variant="contained" disabled={!rate} onClick={add}>{editing ? t('Save changes') : t('Add entry')}</Button>
          </Stack>
        </Box>

        {/* What is already in the room */}
        {area.items.length > 0 && (
          <Box sx={{ mt: 1.5 }}>
            <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 700 }}>{t('In this room')}</Typography>
            {orderedItems.map((item) => {
              const index = area.items.indexOf(item);
              const itemRate = resolveRate(item, quoted);
              const group = groupOfFirst.get(item);
              return (
                <Fragment key={item.id}>
                {group && (
                  <Stack direction="row" sx={(theme) => ({ justifyContent: 'space-between', alignItems: 'center', gap: 1, mt: 0.75, px: 1, py: 0.25, borderRadius: 1.5, borderLeft: '3px solid #5a8f3c', bgcolor: 'rgba(90, 143, 60, 0.12)', color: '#3f6b28', ...theme.applyStyles('dark', { borderLeftColor: '#9fc140', bgcolor: 'rgba(159, 193, 64, 0.14)', color: '#c3e07a' }) })}>
                    <Typography variant="caption" sx={{ fontWeight: 700, flex: 1, minWidth: 0 }} noWrap>{group.name} · {formatQuantity(group.quantity, group.type)} {group.unit}</Typography>
                    {roomStyle && <Typography variant="caption" sx={{ fontWeight: 700, whiteSpace: 'nowrap', color: 'inherit' }}>{t('{amount} on the bill', { amount: formatCurrency(group.amount) })}</Typography>}
                    <IconButton aria-label={t('Add works on the total of {name}', { name: group.name })} title={t('Add works on this total')} onClick={() => setShareFrom({ group })} color="inherit" size="small" sx={{ p: 0.25 }}><PlaylistAddIcon fontSize="small" /></IconButton>
                  </Stack>
                )}
                <Stack direction="row" sx={(theme) => ({ alignItems: 'center', borderBottom: 1, borderColor: 'divider', bgcolor: 'transparent', ...(inGroup.has(item) ? { pl: 1, borderLeft: '3px solid #5a8f3c', bgcolor: 'rgba(90, 143, 60, 0.06)', ...theme.applyStyles('dark', { borderLeftColor: '#9fc140', bgcolor: 'rgba(159, 193, 64, 0.07)' }) } : {}), ...(form.itemId === item.id ? { bgcolor: 'action.selected' } : {}) })}>
                  <Box component="button" type="button" onClick={() => { setForm(formFromItem(item)); setTouched(false); focusField(); }} aria-label={t('Change entry {number}', { number: index + 1 })}
                    sx={{ flex: 1, minWidth: 0, textAlign: 'left', background: 'none', border: 0, p: 0, py: 0.9, color: 'inherit', font: 'inherit', cursor: 'pointer' }}>
                    <Stack direction="row" sx={{ justifyContent: 'space-between', gap: 1 }}>
                      <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>{item.linkedTo ? '↳ ' : ''}{itemRate.name}{item.note ? ` · ${item.note}` : ''}</Typography>
                      <Typography variant="body2" color="primary" sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{formatCurrency(getLineAmount(item, itemRate))}</Typography>
                    </Stack>
                    <Typography variant="caption" color="text.secondary" component="div" noWrap>{describeMeasurement(item, itemRate)} · {formatQuantity(getItemQuantity(item, itemRate), itemRate.type)} {itemRate.unit} × {formatCurrency(itemRate.rate)}</Typography>
                  </Box>
                  <IconButton aria-label={t('Add another work on the measurement of entry {number}', { number: index + 1 })} title={t('Add another work on this measurement')} onClick={() => setShareFrom({ item: area.items.find((entryItem) => entryItem.id === item.linkedTo) || item })} color="primary" size="small"><PlaylistAddIcon fontSize="small" /></IconButton>
                  <IconButton aria-label={t('Delete entry {number}', { number: index + 1 })} onClick={() => remove(item)} color="error" size="small"><DeleteIcon fontSize="small" /></IconButton>
                </Stack>
                </Fragment>
              );
            })}
          </Box>
        )}
        {roomStyle && floorLines.length > 0 && (
          <Box sx={{ mt: 1.5, borderRadius: 2, bgcolor: 'primary.dark', color: 'primary.contrastText', p: 1.25 }}>
            <Box component="button" type="button" onClick={() => setFloorOpen((open) => !open)} aria-expanded={floorOpen} sx={{ all: 'unset', cursor: 'pointer', display: 'block', width: '100%', fontSize: '0.7rem', fontWeight: 700, letterSpacing: '.04em', textTransform: 'uppercase', opacity: 0.9 }}>
              {floorOpen ? '▾' : '▸'} {t('{floor} · what the bill shows by floor', { floor: section.name })}
            </Box>
            {floorOpen && floorLines.map((line) => (
              <Stack key={line.key} direction="row" sx={{ justifyContent: 'space-between', gap: 1, py: 0.4, mt: 0.4, borderTop: 1, borderColor: 'rgba(255,255,255,.25)' }}>
                <Typography variant="body2" noWrap>{line.name}</Typography>
                <Typography variant="body2" sx={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{formatQuantity(line.quantity, line.type)} {line.unit} · {formatCurrency(line.amount)}</Typography>
              </Stack>
            ))}
          </Box>
        )}
      </Box>
      <FeetInchCalculator
        open={calculator}
        targets={fields.map((field) => ({ key: field.key, label: SHORT_LABELS[field.key] || field.label }))}
        onUse={(key, text) => { update({ [key]: text }); setTouched(true); }}
        onUseQuantity={rate && !usesCount(rate.type) ? (value) => { update({ quantity: value }); setTouched(true); } : undefined}
        onClose={() => setCalculator(false)}
      />
      {shareFrom && (
        <AddWorksDialog
          title={shareFrom.group ? t('{name} · total of {count} entries', { name: shareFrom.group.name, count: shareFrom.group.items.length }) : nameOf(shareFrom.item)}
          measurement={shareFrom.group ? `${formatQuantity(shareFrom.group.quantity, shareFrom.group.type)} ${shareFrom.group.unit}` : describeMeasurement(shareFrom.item, resolveRate(shareFrom.item, quoted))}
          rates={quoted.filter((entryRate) => !entryRate.archived)}
          onAdd={addWorks}
          onClose={() => setShareFrom(null)}
        />
      )}
    </ResponsiveDialog>
  );
}

/** One short numeric box; Next on the keyboard moves on, and Enter in the last one adds the entry. */
function Field({ label, value, name, unit, onChange }) {
  return (
    <TextField
      size="small"
      label={label}
      value={value}
      inputMode="decimal"
      placeholder={unit ? '0.0' : ''}
      onChange={onChange}
      slotProps={{ htmlInput: { 'data-sheet-input': name, enterKeyHint: 'next', onFocus: (event) => event.target.select(), style: { minHeight: 28 } }, inputLabel: { shrink: true } }}
      sx={{ flex: '1 1 64px', minWidth: 0, maxWidth: 110 }}
    />
  );
}

/** The note is hidden until wanted, so the form stays short. */
function NoteField({ value, onChange }) {
  const [open, setOpen] = useState(Boolean(value));
  if (!open) {
    return <Link component="button" type="button" underline="hover" variant="caption" onClick={() => setOpen(true)} sx={{ display: 'block', mt: 0.5 }}>{t('+ Note')}</Link>;
  }
  return (
    <TextField
      size="small"
      value={value}
      placeholder={t('Note (optional)')}
      onChange={onChange}
      slotProps={{ htmlInput: { 'data-sheet-input': 'note', enterKeyHint: 'done', 'aria-label': t('Note (optional)') } }}
      sx={{ mt: 0.75 }}
    />
  );
}

import { useMemo, useState } from 'react';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import { EmptyState, ResponsiveDialog, SelectField, useConfirm, useNotify } from '../../components/ui';
import RenameDialog from '../../components/ui/RenameDialog.jsx';
import { useBilling } from '../../state/BillingContext.jsx';
import { useCloud } from '../account/CloudProvider.jsx';
import { isQuotationFinal, quotationLabel, quotationRates, quotationUsage } from '../../domain/quotations.js';
import { tr as t } from '../../i18n/translate.js';
import RatesTable from './RatesTable.jsx';
import RateFormDialog, { RateForm } from './RateFormDialog.jsx';
import QuotationActions from './QuotationActions.jsx';
import QuotationSheet from './QuotationSheet.jsx';
import { useQuotationExport } from './useQuotationExport.js';

/**
 * One small popup: pick a work item from the standard rates, or switch (in the same popup) to type a
 * new item that belongs to this quotation only.
 */
function AddItemForm({ rates, onAdd, onAddNew, onClose }) {
  const [rateId, setRateId] = useState('');
  const [mode, setMode] = useState(rates.length ? 'pick' : 'new');
  if (mode === 'new') {
    return (
      <>
        <Typography variant="caption" color="text.secondary" component="p" sx={{ mb: 0.5 }}>{t('A new item is added to this quotation only, not to your standard rates.')}</Typography>
        <RateForm submitLabel={t('Add to quotation')} onSave={(values) => { onAddNew(values); onClose(); }} onClose={rates.length ? () => setMode('pick') : onClose} />
      </>
    );
  }
  return (
    <div style={{ paddingTop: 8 }}>
      <SelectField label={t('Work item')} value={rateId} placeholder={t('Choose from your standard rates')} options={rates.map((rate) => ({ value: rate.id, label: `${rate.name} · ${rate.unit}` }))} onChange={setRateId} />
      <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8, marginTop: 16, flexWrap: 'wrap' }}>
        <Button onClick={() => setMode('new')}>{t('New item for this quotation')}</Button>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button onClick={onClose}>{t('Cancel')}</Button>
          <Button variant="contained" disabled={!rateId} onClick={() => { onAdd(rateId); onClose(); }}>{t('Add to quotation')}</Button>
        </div>
      </div>
    </div>
  );
}

/**
 * One quotation: its items and prices, with Add item at the bottom of the list. A draft is edited freely and can be
 * made final; a final one is frozen (the admin makes a new version to change it).
 */
export default function QuotationDetail({ quotationId, onBack }) {
  const { data, actions } = useBilling();
  const cloud = useCloud();
  const confirm = useConfirm();
  const notify = useNotify();
  const quotation = data.quotations.find((entry) => entry.id === quotationId);
  const [editing, setEditing] = useState(null); // a line whose price is being changed
  const [adding, setAdding] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const rates = useMemo(() => (quotation ? quotationRates(quotation) : []), [quotation]);
  const project = data.projects.find((entry) => entry.id === quotation?.projectId);
  const settings = useMemo(() => ({ ...data.quotation, clientName: project?.client || data.quotation.clientName }), [data.quotation, project]);
  const exporter = useQuotationExport({ quotation: settings, rates });

  if (!quotation) {
    return <EmptyState title={t('Quotation not found')} action={<Button variant="outlined" onClick={onBack}>{t('Back to quotations')}</Button>} />;
  }

  const final = isQuotationFinal(quotation);
  const used = quotationUsage(quotation.id, data.bills);
  const canVersion = cloud.can('newQuotationVersion');
  const missing = data.rates.filter((rate) => !rate.archived && !quotation.lines.some((entry) => entry.rateId === rate.id));

  async function finalize() {
    const ok = await confirm({
      title: t('Make {label} final?', { label: quotationLabel(quotation) }),
      message: t('Its prices are saved for good. After this only the admin can change it, by making a new version. Estimates and bills can then use it.'),
      confirmLabel: t('Make final')
    });
    if (!ok) return;
    actions.quotations.finalize(quotation.id);
    notify(t('{label} is final.', { label: quotationLabel(quotation) }), 'success');
  }

  function newVersion() {
    const copy = actions.quotations.newVersion(quotation.id);
    if (!copy) return;
    notify(t('{label} created as a draft.', { label: quotationLabel(copy) }), 'info');
    onBack(copy.id);
  }

  async function remove() {
    const ok = await confirm({
      title: t('Delete {label}?', { label: quotationLabel(quotation) }),
      message: t('It moves to Recently deleted. Bills that use it block this; a quotation in use cannot be deleted.'),
      confirmLabel: t('Delete'),
      danger: true
    });
    if (ok && actions.quotations.remove(quotation.id)) onBack();
  }

  return (
    <section className="print-page">
      <div className="no-print">
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1.5 }}>
          <IconButton aria-label={t('Back to quotations')} onClick={() => onBack()}><ArrowBackIcon /></IconButton>
          <div style={{ flex: 1, minWidth: 0 }}>
            <Typography variant="h6" component="h2" noWrap>{quotationLabel(quotation)} · {quotation.name}</Typography>
            <Typography variant="body2" color="text.secondary" noWrap>{[project?.name, project?.client].filter(Boolean).join(' · ')}</Typography>
          </div>
          <Chip size="small" color={final ? 'success' : 'default'} variant={final ? 'filled' : 'outlined'} label={final ? t('Final') : t('Draft')} />
        </Stack>

        <QuotationActions exporter={exporter} disabled={!rates.length} />

        <RatesTable
          rates={rates}
          onEdit={final ? undefined : setEditing}
          onRemove={final ? undefined : (rate) => actions.quotations.removeLine(quotation.id, rate.id)}
          usage={() => 0}
        />
        <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1, mb: 1.5 }}>
          {final
            ? t('This quotation is final: its prices are saved.')
            : t('Tap a row to change its price.')}
          {used > 0 ? ` ${used === 1 ? t('Used by 1 bill') : t('Used by {count} bills', { count: used })}.` : ''}
        </Typography>

        {!final && (
          <Button fullWidth variant="outlined" startIcon={<AddIcon />} onClick={() => setAdding(true)} sx={{ mb: 1.5 }}>{t('Add item')}</Button>
        )}

        <Stack direction="row" useFlexGap sx={{ flexWrap: 'wrap', gap: 1, mb: 2 }}>
          {!final && <Button variant="contained" onClick={finalize} disabled={!rates.length}>{t('Make final')}</Button>}
          {!final && <Button onClick={() => setRenaming(true)}>{t('Rename')}</Button>}
          {final && canVersion && <Button variant="outlined" onClick={newVersion}>{t('New version')}</Button>}
          {(!final || canVersion) && <Button color="error" onClick={remove} disabled={used > 0}>{t('Delete')}</Button>}
        </Stack>
        {final && !canVersion && (
          <Typography variant="caption" color="text.secondary" component="p" sx={{ mb: 2 }}>{t('A final quotation cannot be changed. Ask the admin for a new version.')}</Typography>
        )}
      </div>

      <QuotationSheet quotation={settings} rates={rates} exporter={exporter} draft={!final} showClient={false} />

      <RateFormDialog
        open={Boolean(editing)}
        rate={editing}
        priceOnly
        onSave={(values) => {
          actions.quotations.setPrice(quotation.id, editing.id, values.rate);
          notify(t('{name} price updated in this quotation.', { name: editing.name }));
          setEditing(null);
        }}
        onClose={() => setEditing(null)}
      />
      <ResponsiveDialog open={adding} title={t('Add item')} onClose={() => setAdding(false)} maxWidth="xs">
        {adding && <AddItemForm rates={missing} onAdd={(rateId) => actions.quotations.addLine(quotation.id, rateId)} onAddNew={(values) => { actions.quotations.addNewLine(quotation.id, values); notify(t('{name} added.', { name: values.name })); }} onClose={() => setAdding(false)} />}
      </ResponsiveDialog>
      <RenameDialog open={renaming} title={t('Rename quotation')} label={t('Quotation name')} value={quotation.name} onSave={(name) => actions.quotations.rename(quotation.id, name)} onClose={() => setRenaming(false)} />
    </section>
  );
}

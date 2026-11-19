import { useMemo, useState } from 'react';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import { useBilling } from '../../state/BillingContext.jsx';
import { useConfirm, useNotify } from '../../components/ui';
import { useUndoable } from '../../hooks/useUndoable.js';
import { tr as t } from '../../i18n/translate.js';
import { useCloud } from '../account/CloudProvider.jsx';
import { rateUsage } from '../../domain/quotations.js';
import { missingCivilRates } from '../../domain/rates.js';
import RatesTable from './RatesTable.jsx';
import RateFormDialog from './RateFormDialog.jsx';
import PriceChangeDialog from './PriceChangeDialog.jsx';
import QuotationActions from './QuotationActions.jsx';
import QuotationSheet from './QuotationSheet.jsx';
import { useQuotationExport } from './useQuotationExport.js';

/** The standard rates: the price list every new quotation starts from, and what bills without a quotation use. */
export default function StandardRates() {
  const { data, actions } = useBilling();
  const undoable = useUndoable();
  const notify = useNotify();
  const confirm = useConfirm();
  const canEditRates = useCloud().can('editRate');
  /** null = closed, 'new' = adding, otherwise the rate being edited. */
  const [editing, setEditing] = useState(null);
  /** A price change waiting for the choice: update draft bills too, or new entries only. */
  const [pricing, setPricing] = useState(null);
  const missing = missingCivilRates(data.rates).length;
  const printable = useMemo(() => data.rates.filter((rate) => !rate.archived), [data.rates]);
  const exporter = useQuotationExport({ quotation: data.quotation, rates: printable });

  function save(values) {
    if (editing === 'new') {
      actions.rates.add(values);
      notify(t('{name} added.', { name: values.name }));
    } else {
      const original = data.rates.find((rate) => rate.id === editing.id) || editing;
      const usage = rateUsage(editing.id, data.bills);
      if (Number(values.rate) !== Number(original.rate) && usage.entries > 0) {
        // Existing entries keep their price; ask whether draft bills should follow.
        setPricing({ rate: editing, values, usage });
        setEditing(null);
        return;
      }
      actions.rates.update(editing.id, values);
      notify(t('{name} updated.', { name: values.name }));
    }
    setEditing(null);
  }

  function confirmPrice(updateDrafts) {
    actions.rates.update(pricing.rate.id, pricing.values, { updateDrafts });
    notify(updateDrafts ? t('{name} updated, and draft bills re-priced.', { name: pricing.values.name }) : t('{name} updated for new entries.', { name: pricing.values.name }));
    setPricing(null);
  }

  /** A work item no bill uses is deleted; one that is in use is retired (hidden from new entries, bills unchanged). */
  async function removeRate(rate) {
    const usage = rateUsage(rate.id, data.bills);
    if (usage.entries > 0) {
      const ok = await confirm({
        title: t('Retire {name}?', { name: rate.name }),
        message: t('It is used in {entries} entries of {bills} bills, so it cannot be deleted. Retiring hides it from new entries; those bills do not change. You can bring it back any time.', { entries: usage.entries, bills: usage.bills }),
        confirmLabel: t('Retire')
      });
      if (!ok) return;
      actions.rates.archive(rate.id);
      notify(t('{name} retired.', { name: rate.name }), 'info');
      return;
    }
    undoable(t('{name} deleted.', { name: rate.name || t('Work item') }), () => actions.rates.remove(rate.id));
  }

  return (
    <section className="print-page">
      <div className="no-print">
        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
          {t('Your standard prices. A new quotation starts as a copy of these, and a bill with no quotation uses them.')}
        </Typography>
        <QuotationActions exporter={exporter} disabled={!printable.length} />
        <RatesTable
          rates={data.rates}
          onEdit={canEditRates ? setEditing : undefined}
          onRemove={removeRate}
          onRestore={(rate) => actions.rates.unarchive(rate.id)}
          usage={(rate) => rateUsage(rate.id, data.bills).entries}
        />
        <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1, mb: 1.5 }}>
          {canEditRates
            ? t('Tap a row to edit. A new price applies to new entries; existing entries keep the price they were made with.')
            : t('You can add rates. Only the admin can change or delete them.')}
        </Typography>
        <Button fullWidth variant="outlined" startIcon={<AddIcon />} onClick={() => setEditing('new')} sx={{ mb: missing ? 1 : 2 }}>{t('Add item')}</Button>
        {missing > 0 && (
          <Button fullWidth variant="text" onClick={() => { actions.rates.addMissingCivil(); notify(t('{count} civil work rates added.', { count: missing })); }} sx={{ mb: 2 }}>{t('Add the civil work rates ({count})', { count: missing })}</Button>
        )}
      </div>

      <QuotationSheet quotation={data.quotation} rates={printable} exporter={exporter} />

      <RateFormDialog open={Boolean(editing)} rate={editing === 'new' ? null : editing} onSave={save} onClose={() => setEditing(null)} />
      <PriceChangeDialog change={pricing} onChoose={confirmPrice} onClose={() => setPricing(null)} />
    </section>
  );
}

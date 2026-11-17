import { useState } from 'react';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import { useBilling } from '../../state/BillingContext.jsx';
import { PageHeading, useNotify } from '../../components/ui';
import { useUndoable } from '../../hooks/useUndoable.js';
import RatesTable from './RatesTable.jsx';
import RateFormDialog from './RateFormDialog.jsx';
import { tr as t } from '../../i18n/translate.js';

export default function RatesPage() {
  const { data, actions } = useBilling();
  const undoable = useUndoable();
  const notify = useNotify();
  /** null = closed, 'new' = adding, otherwise the rate being edited. */
  const [editing, setEditing] = useState(null);

  function save(values) {
    if (editing === 'new') {
      actions.rates.add(values);
      notify(t('{name} added.', { name: values.name }));
    } else {
      actions.rates.update(editing.id, values);
      notify(t('{name} updated.', { name: values.name }));
    }
    setEditing(null);
  }

  /** Entries that use a deleted rate keep their saved copy of it. */
  function removeRate(rate) {
    undoable(t('{name} deleted.', { name: rate.name || t('Work item') }), () => actions.rates.remove(rate.id));
  }

  return (
    <section>
      <PageHeading
        title={t('Rates')}
        description={t('Work items available in measurement entry.')}
        action={<Button variant="contained" startIcon={<AddIcon />} onClick={() => setEditing('new')}>{t('Add item')}</Button>}
      />
      <RatesTable rates={data.rates} onEdit={setEditing} onRemove={removeRate} />
      <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
        {t('Tap a row to edit. Changing a rate updates the amounts of entries that use it.')}
      </Typography>
      <RateFormDialog
        open={Boolean(editing)}
        rate={editing === 'new' ? null : editing}
        onSave={save}
        onClose={() => setEditing(null)}
      />
    </section>
  );
}

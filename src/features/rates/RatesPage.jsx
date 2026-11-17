import { useState } from 'react';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import { useBilling } from '../../state/BillingContext.jsx';
import { PageHeading, useNotify } from '../../components/ui';
import { useUndoable } from '../../hooks/useUndoable.js';
import RatesTable from './RatesTable.jsx';
import RateFormDialog from './RateFormDialog.jsx';
import { tr as t } from '../../i18n/translate.js';

/** Work-item rates. `embedded` renders it as a card inside Settings. */
export default function RatesPage({ embedded = false }) {
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
      {embedded ? (
        <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
          <Typography variant="h6" component="h2">{t('Work item rates')}</Typography>
          <Button variant="contained" startIcon={<AddIcon />} onClick={() => setEditing('new')}>{t('Add item')}</Button>
        </Stack>
      ) : (
        <PageHeading
          title={t('Rates')}
          description={t('Work items available in measurement entry.')}
          action={<Button variant="contained" startIcon={<AddIcon />} onClick={() => setEditing('new')}>{t('Add item')}</Button>}
        />
      )}
      <RatesTable rates={data.rates} onEdit={setEditing} onRemove={removeRate} />
      <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1, mb: 2 }}>
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

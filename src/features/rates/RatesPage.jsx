import { useState } from 'react';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import { useBilling } from '../../state/BillingContext.jsx';
import { PageHeading, useConfirm, useNotify } from '../../components/ui';
import RatesTable from './RatesTable.jsx';
import RateFormDialog from './RateFormDialog.jsx';

export default function RatesPage() {
  const { data, actions } = useBilling();
  const confirm = useConfirm();
  const notify = useNotify();
  /** null = closed, 'new' = adding, otherwise the rate being edited. */
  const [editing, setEditing] = useState(null);

  function save(values) {
    if (editing === 'new') {
      actions.rates.add(values);
      notify(`${values.name} added.`);
    } else {
      actions.rates.update(editing.id, values);
      notify(`${values.name} updated.`);
    }
    setEditing(null);
  }

  async function removeRate(rate) {
    const confirmed = await confirm({
      title: `Delete ${rate.name || 'this work item'}?`,
      message: 'Existing entries keep their saved rate.',
      confirmLabel: 'Delete',
      danger: true
    });
    if (!confirmed) return;
    actions.rates.remove(rate.id);
    notify(`${rate.name} deleted.`, 'info');
  }

  return (
    <section>
      <PageHeading
        title="Rates"
        description="Work items available in measurement entry."
        action={<Button variant="contained" startIcon={<AddIcon />} onClick={() => setEditing('new')}>Add item</Button>}
      />
      <RatesTable rates={data.rates} onEdit={setEditing} onRemove={removeRate} />
      <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
        Tap a row to edit. Changing a rate updates the amounts of entries that use it.
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

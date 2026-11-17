import Button from '@mui/material/Button';
import AddIcon from '@mui/icons-material/Add';
import { useBilling } from '../../state/BillingContext.jsx';
import { PageHeading, useConfirm } from '../../components/ui';
import RateRow from './RateRow.jsx';

export default function RatesPage() {
  const { data, actions } = useBilling();
  const confirm = useConfirm();

  async function removeRate(rate) {
    const confirmed = await confirm({
      title: `Remove ${rate.name || 'this work item'}?`,
      message: 'Existing entries keep their saved rate.',
      confirmLabel: 'Remove',
      danger: true
    });
    if (confirmed) actions.rates.remove(rate.id);
  }

  return (
    <section>
      <PageHeading
        title="Rates"
        description="Work items and units available in measurement entry."
        action={<Button variant="contained" startIcon={<AddIcon />} onClick={actions.rates.add}>Add item</Button>}
      />
      {data.rates.map((rate) => (
        <RateRow
          key={rate.id}
          rate={rate}
          canRemove={data.rates.length > 1}
          onChange={(patch) => actions.rates.update(rate.id, patch)}
          onRemove={() => removeRate(rate)}
        />
      ))}
    </section>
  );
}

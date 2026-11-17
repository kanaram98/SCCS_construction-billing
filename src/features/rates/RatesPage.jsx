import { useBilling } from '../../state/BillingContext.jsx';
import { Button, PageHeading } from '../../components/ui';
import RateRow from './RateRow.jsx';

export default function RatesPage() {
  const { data, actions } = useBilling();
  return (
    <section>
      <PageHeading
        title="Work item rates"
        description="Configure the items and units available in measurement entry."
        action={<Button variant="primary" onClick={actions.rates.add}>+ Add item</Button>}
      />
      <div className="card rate-list">
        {data.rates.map((rate) => (
          <RateRow
            key={rate.id}
            rate={rate}
            canRemove={data.rates.length > 1}
            onChange={(patch) => actions.rates.update(rate.id, patch)}
            onRemove={() => actions.rates.remove(rate.id)}
          />
        ))}
      </div>
    </section>
  );
}

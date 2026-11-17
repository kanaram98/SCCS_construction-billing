import { Button, MessageList, TextButton } from '../../components/ui';
import { formatCurrency } from '../../domain/formatters.js';
import EntryFields from './EntryFields.jsx';

/** Presentational add/edit form; state comes from `useEntryForm`. */
export default function EntryForm({ form }) {
  const { entry, isEditing, availableRates, selectedRate } = form;
  return (
    <form className="entry-form" onSubmit={form.submit}>
      <div className="entry-form-heading">
        <div>
          <strong>{isEditing ? 'Edit entry' : 'Add entry'}</strong>
          <span>
            {isEditing
              ? 'Update this row or cancel to add a new one.'
              : 'Enter one measured item, then add the next without leaving this area.'}
          </span>
        </div>
        {isEditing && <TextButton onClick={() => form.reset()}>Cancel edit</TextButton>}
      </div>

      <div className="entry-form-fields">
        <label className="entry-work-select">Work item
          <select value={entry.rateId} onChange={(event) => form.update({ rateId: event.target.value })} required>
            <option value="" disabled>Select work item</option>
            {availableRates.map((rate) => <option key={rate.id} value={rate.id}>{rate.name} · {rate.unit}</option>)}
          </select>
        </label>
        {selectedRate && <EntryFields rate={selectedRate} entry={entry} onChange={form.update} />}
      </div>

      <MessageList
        className="entry-form-errors"
        role={form.errorsAreAlert ? 'alert' : 'status'}
        messages={form.visibleErrors}
      />

      <div className="entry-form-footer">
        <span>
          {selectedRate
            ? `Rate: ${formatCurrency(selectedRate.rate)} / ${selectedRate.unit}`
            : 'Select a work item to enter measurements.'}
        </span>
        <Button variant="primary" size="compact" type="submit" disabled={!form.canSubmit}>
          {isEditing ? 'Save changes' : '+ Add entry'}
        </Button>
      </div>
    </form>
  );
}

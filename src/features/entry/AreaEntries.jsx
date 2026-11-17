import { useBilling } from '../../state/BillingContext.jsx';
import { useEntryForm } from './useEntryForm.js';
import EntryForm from './EntryForm.jsx';
import EntryTable from './EntryTable.jsx';

/** Entry form plus the table of entries for a single area. */
export default function AreaEntries({ sectionId, area, sections, onCopied }) {
  const { data, actions } = useBilling();
  const { entry: entryActions } = actions;
  const form = useEntryForm({
    rates: data.rates,
    items: area.items,
    onAdd: (rateId, values) => entryActions.addItem(sectionId, area.id, rateId, values),
    onUpdate: (itemId, values) => entryActions.updateItem(sectionId, area.id, itemId, values)
  });

  function deleteItem(itemId) {
    entryActions.removeItem(sectionId, area.id, itemId);
    form.handleItemRemoved(itemId);
  }

  function copyItem(itemId, targetSectionId) {
    const result = entryActions.copyItem(sectionId, area.id, itemId, targetSectionId);
    if (result) onCopied(result);
  }

  return (
    <div className="area-entry-workspace">
      <EntryForm form={form} />
      {area.items.length === 0 ? (
        <p className="area-empty-note">No entries yet. Use the form above to add the first one.</p>
      ) : (
        <EntryTable
          items={area.items}
          rates={data.rates}
          sections={sections}
          sectionId={sectionId}
          onEdit={form.startEditing}
          onDelete={deleteItem}
          onCopy={copyItem}
        />
      )}
    </div>
  );
}

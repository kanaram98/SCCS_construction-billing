import { useState } from 'react';
import { validateEntry } from '../../domain/validation.js';

function emptyEntry(rateId = '') {
  return { rateId, count: '1', length: '', width: '', height: '', quantity: '1', note: '' };
}

function entryFromItem(item) {
  return {
    rateId: item.rateId,
    count: item.count ?? '1',
    length: item.length ?? '',
    width: item.width ?? '',
    height: item.height ?? '',
    quantity: item.quantity ?? '1',
    note: item.note ?? ''
  };
}

/**
 * Add/edit form state for one area's entries.
 * Errors appear live once the user has typed, and as an alert after a failed submit.
 */
export function useEntryForm({ rates, items, onAdd, onUpdate }) {
  const [entry, setEntry] = useState(() => emptyEntry(rates[0]?.id || ''));
  const [editingId, setEditingId] = useState(null);
  const [hasTouched, setHasTouched] = useState(false);
  const [submitErrors, setSubmitErrors] = useState([]);

  // Keep a deleted rate selectable while editing an entry that still uses it.
  const editingItem = items.find((item) => item.id === editingId);
  const availableRates = editingItem && !rates.some((rate) => rate.id === editingItem.rateId)
    ? [...rates, { ...editingItem, id: editingItem.rateId }]
    : rates;
  const selectedRate = availableRates.find((rate) => rate.id === entry.rateId);
  const liveErrors = validateEntry(entry, selectedRate);
  const visibleErrors = submitErrors.length ? submitErrors : hasTouched ? liveErrors : [];

  function reset(rateId = entry.rateId) {
    setEntry(emptyEntry(rateId));
    setEditingId(null);
    setHasTouched(false);
    setSubmitErrors([]);
  }

  function update(patch) {
    setEntry((current) => ({ ...current, ...patch }));
    setHasTouched(true);
    setSubmitErrors([]);
  }

  function startEditing(item) {
    setEntry(entryFromItem(item));
    setEditingId(item.id);
    setHasTouched(true);
    setSubmitErrors([]);
  }

  function submit(event) {
    event.preventDefault();
    if (liveErrors.length) {
      setSubmitErrors(liveErrors);
      return;
    }
    const values = {
      ...entry,
      name: selectedRate.name,
      unit: selectedRate.unit,
      type: selectedRate.type,
      rate: selectedRate.rate
    };
    if (editingId) {
      onUpdate(editingId, values);
    } else if (!onAdd(entry.rateId, values)) {
      setSubmitErrors(['This work item is no longer available. Select another work item.']);
      return;
    }
    reset(entry.rateId);
  }

  /** Clears the form if the deleted item was being edited. */
  function handleItemRemoved(itemId) {
    if (editingId === itemId) reset();
  }

  return {
    entry,
    isEditing: Boolean(editingId),
    availableRates,
    selectedRate,
    canSubmit: liveErrors.length === 0,
    visibleErrors,
    errorsAreAlert: submitErrors.length > 0,
    update,
    reset,
    startEditing,
    submit,
    handleItemRemoved
  };
}

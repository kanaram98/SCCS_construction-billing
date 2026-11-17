import { useBilling } from '../state/BillingContext.jsx';
import { useNotify } from '../components/ui';
import { tr } from '../i18n/translate.js';

/**
 * Runs a destructive change and shows a toast with Undo, which puts the
 * whole app state back to how it was just before the change.
 *
 *   const undoable = useUndoable();
 *   undoable('Entry deleted.', () => actions.entry.removeItem(...));
 */
export function useUndoable() {
  const { data, actions } = useBilling();
  const notify = useNotify();
  return (message, change) => {
    const snapshot = data;
    change();
    notify(message, 'info', {
      label: tr('Undo'),
      onClick: () => actions.data.restoreSnapshot(snapshot)
    });
  };
}

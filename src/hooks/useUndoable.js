import { useBilling } from '../state/BillingContext.jsx';
import { useNotify } from '../components/ui';
import { tr } from '../i18n/translate.js';

/**
 * Runs a destructive change and shows a toast with Undo, which puts the
 * whole app state (including history) back to how it was just before the change.
 * The change is also kept in History, so it can be undone later too.
 *
 *   const undoable = useUndoable();
 *   undoable('Entry deleted.', () => actions.entry.removeItem(...));
 */
export function useUndoable() {
  const { raw, actions } = useBilling();
  const notify = useNotify();
  return (message, change) => {
    const snapshot = raw;
    change();
    notify(message, 'info', {
      label: tr('Undo'),
      onClick: () => actions.data.restoreSnapshot(snapshot)
    });
  };
}

import { useBilling } from '../../state/BillingContext.jsx';
import { useConfirm, useNotify } from '../../components/ui';
import { backupFilename, createBackup, parseBackup } from '../../domain/backup.js';
import { deliverFile, isShareCancelled, readFileAsText } from '../../services/files.js';
import { pluralize } from '../../domain/formatters.js';

/** Export a backup file, or restore one after confirmation (with undo). */
export function useBackup() {
  const { data, actions } = useBilling();
  const notify = useNotify();
  const confirm = useConfirm();

  async function exportBackup() {
    const now = new Date();
    const file = new File(
      [JSON.stringify(createBackup(data, now))],
      backupFilename(now),
      { type: 'application/json' }
    );
    try {
      const how = await deliverFile(file);
      actions.data.markBackedUp(now);
      notify(how === 'shared' ? 'Backup shared. Keep it somewhere safe.' : 'Backup file downloaded.');
    } catch (error) {
      if (isShareCancelled(error)) return;
      console.error('Could not export backup.', error);
      notify(`Backup failed: ${error.message || 'Unknown error'}`, 'error');
    }
  }

  async function restoreBackup(file) {
    let parsed;
    try {
      parsed = parseBackup(await readFileAsText(file));
    } catch (error) {
      notify(error.message, 'error');
      return;
    }
    const date = parsed.exportedAt ? new Date(parsed.exportedAt).toLocaleDateString() : 'an unknown date';
    const confirmed = await confirm({
      title: 'Restore this backup?',
      message: `It has ${parsed.billCount} ${pluralize(parsed.billCount, 'bill')} from ${date}. All bills, rates and settings on this device will be replaced.`,
      confirmLabel: 'Restore',
      danger: true
    });
    if (!confirmed) return;
    const previous = data;
    actions.data.restore(parsed.state);
    notify('Backup restored.', 'success', { label: 'Undo', onClick: () => actions.data.restoreSnapshot(previous) });
  }

  return { exportBackup, restoreBackup };
}

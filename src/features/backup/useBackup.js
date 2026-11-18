import { useBilling } from '../../state/BillingContext.jsx';
import { useCloud } from '../account/CloudProvider.jsx';
import { useConfirm, useNotify } from '../../components/ui';
import { backupFilename, createBackup, parseBackup } from '../../domain/backup.js';
import { deliverFile, isShareCancelled, readFileAsText } from '../../services/files.js';
import { tr as t, trn } from '../../i18n/translate.js';

/** Export a backup file, or restore one after confirmation (with undo). */
export function useBackup() {
  const { raw, actions } = useBilling();
  const notify = useNotify();
  const confirm = useConfirm();
  const cloud = useCloud();

  async function exportBackup() {
    const now = new Date();
    const file = new File(
      [JSON.stringify(createBackup(raw, now))],
      backupFilename(now),
      { type: 'application/json' }
    );
    try {
      const how = await deliverFile(file);
      actions.data.markBackedUp(now);
      notify(how === 'shared' ? t('Backup shared. Keep it somewhere safe.') : t('Backup file downloaded.'));
    } catch (error) {
      if (isShareCancelled(error)) return;
      console.error('Could not export backup.', error);
      notify(t('Backup failed: {reason}', { reason: error.message || t('Unknown error') }), 'error');
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
    const date = parsed.exportedAt ? new Date(parsed.exportedAt).toLocaleDateString() : t('an unknown date');
    const confirmed = await confirm({
      title: t('Restore this backup?'),
      message: (cloud.pending > 0 ? trn(cloud.pending, 'Warning: {count} change on this phone has not reached the cloud yet and will be replaced. ', 'Warning: {count} changes on this phone have not reached the cloud yet and will be replaced. ') : '') + trn(parsed.billCount, 'It has {count} bill from {date}. All bills, rates and settings on this device will be replaced.', 'It has {count} bills from {date}. All bills, rates and settings on this device will be replaced.', { date }),
      confirmLabel: t('Restore'),
      danger: true
    });
    if (!confirmed) return;
    const previous = raw;
    actions.data.restore(parsed.state);
    notify(t('Backup restored.'), 'success', { label: t('Undo'), onClick: () => actions.data.restoreSnapshot(previous) });
  }

  return { exportBackup, restoreBackup };
}

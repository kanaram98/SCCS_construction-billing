import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import { useBilling } from '../../state/BillingContext.jsx';
import { describeLastBackup, needsBackupReminder } from '../../domain/backup.js';
import { useBackup } from './useBackup.js';
import { tr as t } from '../../i18n/translate.js';

/** Nudges the user to back up when they have entries and no recent backup. */
export default function BackupReminder() {
  const { data } = useBilling();
  const { exportBackup } = useBackup();
  if (!needsBackupReminder(data)) return null;
  return (
    <Alert
      severity="warning"
      sx={{ mb: 2 }}
      action={<Button color="inherit" size="small" onClick={exportBackup}>{t('Back up')}</Button>}
    >
      {t('Last backup: {when}. Save a copy so your bills aren’t lost.', { when: t(describeLastBackup(data)) })}
    </Alert>
  );
}

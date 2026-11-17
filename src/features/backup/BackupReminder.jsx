import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import { useBilling } from '../../state/BillingContext.jsx';
import { describeLastBackup, needsBackupReminder } from '../../domain/backup.js';
import { useBackup } from './useBackup.js';

/** Nudges the user to back up when they have entries and no recent backup. */
export default function BackupReminder() {
  const { data } = useBilling();
  const { exportBackup } = useBackup();
  if (!needsBackupReminder(data)) return null;
  return (
    <Alert
      severity="warning"
      sx={{ mb: 2 }}
      action={<Button color="inherit" size="small" onClick={exportBackup}>Back up</Button>}
    >
      Last backup: {describeLastBackup(data)}. Save a copy so your bills aren’t lost.
    </Alert>
  );
}

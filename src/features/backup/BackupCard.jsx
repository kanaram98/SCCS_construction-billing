import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import BackupIcon from '@mui/icons-material/BackupOutlined';
import RestoreIcon from '@mui/icons-material/RestoreOutlined';
import { useBilling } from '../../state/BillingContext.jsx';
import { Card } from '../../components/ui';
import { describeLastBackup } from '../../domain/backup.js';
import { useBackup } from './useBackup.js';

/** Back up all data to a file, or restore from one. */
export default function BackupCard() {
  const { data } = useBilling();
  const { exportBackup, restoreBackup } = useBackup();

  return (
    <Card
      title="Backup & restore"
      description="Bills are stored only on this device. Save a backup file to WhatsApp, Drive or email so you can restore it if the phone is reset or changed."
    >
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
        <Button variant="contained" startIcon={<BackupIcon />} onClick={exportBackup}>Back up now</Button>
        <Button component="label" variant="outlined" startIcon={<RestoreIcon />}>
          Restore from file
          <input
            hidden
            type="file"
            accept=".json,application/json"
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) restoreBackup(file);
            }}
          />
        </Button>
      </Stack>
      <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
        Last backup: {describeLastBackup(data)}
      </Typography>
    </Card>
  );
}

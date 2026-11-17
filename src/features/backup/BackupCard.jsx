import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import BackupIcon from '@mui/icons-material/BackupOutlined';
import RestoreIcon from '@mui/icons-material/RestoreOutlined';
import { useBilling } from '../../state/BillingContext.jsx';
import { Card } from '../../components/ui';
import { describeLastBackup } from '../../domain/backup.js';
import { useBackup } from './useBackup.js';
import { tr as t } from '../../i18n/translate.js';
import { useCloud } from '../account/CloudProvider.jsx';

/** Back up all data to a file, or restore from one. */
export default function BackupCard() {
  const { data } = useBilling();
  const { exportBackup, restoreBackup } = useBackup();
  const cloud = useCloud();

  return (
    <Card
      title={t('Backup & restore')}
      description={cloud.user
        ? t('Your data is synced to the cloud. A backup file is an extra copy you keep yourself (WhatsApp, Drive or email).')
        : t('Bills are stored only on this device. Save a backup file to WhatsApp, Drive or email so you can restore it if the phone is reset or changed.')}
    >
      <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1}>
        <Button variant="contained" startIcon={<BackupIcon />} onClick={exportBackup}>{t('Back up now')}</Button>
        <Button component="label" variant="outlined" startIcon={<RestoreIcon />}>
          {t('Restore from file')}
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
        {t('Last backup: {when}', { when: t(describeLastBackup(data)) })}
      </Typography>
    </Card>
  );
}

import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import GoogleIcon from '@mui/icons-material/Google';
import LogoutIcon from '@mui/icons-material/Logout';
import { Card } from '../../components/ui';
import { ROLES } from '../../domain/permissions.js';
import { tr as t } from '../../i18n/translate.js';
import { useCloud } from './CloudProvider.jsx';

/** What each sync state means, in words. */
export const CLOUD_STATUS_TEXT = Object.freeze({
  'signed-out': 'Not signed in. Bills are only on this device.',
  connecting: 'Connecting…',
  syncing: 'Syncing…',
  synced: 'Synced. Your data is safe in the cloud.',
  offline: 'Offline. Changes are saved here and sync when you are back online.',
  error: 'Sync problem. Changes are kept on this device; try again later.',
  'no-access': 'No access'
});

/** Sign in with Google, sync status and sign out. Hidden when the cloud isn't set up. */
export default function AccountCard() {
  const cloud = useCloud();
  if (!cloud.configured) return null;
  const { user, role, status } = cloud;

  if (!user) {
    return (
      <Card title={t('Cloud sync')} description={t('Sign in with Google to keep your bills safe in the cloud and use them on another phone.')}>
        <Button variant="contained" startIcon={<GoogleIcon />} onClick={cloud.signIn} disabled={status === 'connecting'}>
          {t('Sign in with Google')}
        </Button>
      </Card>
    );
  }

  return (
    <Card title={t('Cloud sync')}>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', flexWrap: 'wrap', mb: 1 }}>
        <Typography variant="subtitle2">{user.displayName || user.email}</Typography>
        {role && <Chip size="small" color={role === 'admin' ? 'primary' : 'default'} label={t(ROLES[role])} />}
      </Stack>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>{user.email}</Typography>
      {status === 'no-access' ? (
        <Alert severity="warning" sx={{ mb: 1.5 }}>
          {t('This Google account is not in the workspace yet. Ask the admin to invite {email}.', { email: user.email })}
        </Alert>
      ) : (
        <Typography variant="body2" sx={{ mb: 1.5 }} color={status === 'error' ? 'error' : 'text.primary'}>{t(CLOUD_STATUS_TEXT[status] || status)}</Typography>
      )}
      <Button size="small" startIcon={<LogoutIcon />} onClick={cloud.signOut}>{t('Sign out')}</Button>
      <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
        {t('Signing out keeps the data on this device.')}
      </Typography>
    </Card>
  );
}

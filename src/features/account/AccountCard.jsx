import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import GoogleIcon from '@mui/icons-material/Google';
import LogoutIcon from '@mui/icons-material/Logout';
import { Card, useConfirm } from '../../components/ui';
import { ROLES } from '../../domain/permissions.js';
import { tr as t, trn } from '../../i18n/translate.js';
import { useCloud } from './CloudProvider.jsx';

/** What each sync state means, in words. */
export const CLOUD_STATUS_TEXT = Object.freeze({
  'signed-out': 'Not signed in. Bills are only on this device.',
  connecting: 'Connecting…',
  syncing: 'Syncing…',
  synced: 'Synced. Your data is safe in the cloud.',
  offline: 'Offline. Changes are saved here and sync when you are back online.',
  error: 'Sync problem. Changes are kept on this device; try again later.',
  'no-access': 'No access',
  'switch-blocked': 'Waiting: another account has changes on this phone.'
});

/** Sign in with Google, sync status and sign out. Hidden when the cloud isn't set up. */
export default function AccountCard() {
  const cloud = useCloud();
  const confirm = useConfirm();
  if (!cloud.configured) return null;
  const { user, role, status, lastUser, switchInfo } = cloud;

  async function signOut() {
    const pending = await cloud.pendingChanges();
    if (pending > 0) {
      const ok = await confirm({
        title: t('Some changes are not in the cloud yet'),
        message: trn(pending,
          '{count} change has not reached the cloud yet (no internet?). If you sign out it stays on this phone and uploads when you sign in again with this account.',
          '{count} changes have not reached the cloud yet (no internet?). If you sign out they stay on this phone and upload when you sign in again with this account.'),
        confirmLabel: t('Sign out anyway')
      });
      if (!ok) return;
    }
    await cloud.signOut();
  }

  async function continueAnyway() {
    const ok = await confirm({
      title: t('Continue as {email}?', { email: user.email }),
      message: trn(switchInfo.count,
        'The {count} change by {name} that is not in the cloud will be lost from this phone. The phone will show the cloud data.',
        'The {count} changes by {name} that are not in the cloud will be lost from this phone. The phone will show the cloud data.',
        { name: switchInfo.previous.name }),
      confirmLabel: t('Continue anyway'),
      danger: true
    });
    if (ok) cloud.continueSwitch();
  }

  if (!user) {
    return (
      <Card
        title={t('Cloud sync')}
        description={lastUser
          ? t('Signed out. Only Labour is available on this phone. Sign in as {email} to open bills and upload labour entries.', { email: lastUser.email })
          : t('Sign in with Google to keep your bills safe in the cloud and use them on another phone.')}
      >
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
      {status === 'no-access' && (
        <Alert severity="warning" sx={{ mb: 1.5 }}>
          {t('This Google account is not in the workspace yet. Ask the admin to invite {email}.', { email: user.email })}
          {cloud.noAccessReason && <Typography variant="caption" component="div" sx={{ mt: 0.5, wordBreak: 'break-word' }}>{t('Details: {reason}', { reason: cloud.noAccessReason })}</Typography>}
        </Alert>
      )}
      {status === 'switch-blocked' && switchInfo && (
        <Alert
          severity="warning"
          sx={{ mb: 1.5 }}
          action={<Button color="inherit" size="small" onClick={continueAnyway}>{t('Continue anyway')}</Button>}
        >
          {trn(switchInfo.count,
            'This phone has {count} change by {name} ({email}) that is not in the cloud yet. Sign out and let {name} sign in to upload it first.',
            'This phone has {count} changes by {name} ({email}) that are not in the cloud yet. Sign out and let {name} sign in to upload them first.',
            { name: switchInfo.previous.name, email: switchInfo.previous.email })}
        </Alert>
      )}
      {status !== 'no-access' && status !== 'switch-blocked' && (
        <Typography variant="body2" sx={{ mb: 1.5 }} color={status === 'error' ? 'error' : 'text.primary'}>{t(CLOUD_STATUS_TEXT[status] || status)}</Typography>
      )}
      <Button size="small" startIcon={<LogoutIcon />} onClick={signOut}>{t('Sign out')}</Button>
      <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
        {t('Signed out, only Labour can be used on this phone; entries upload at the next sign-in.')}
      </Typography>
    </Card>
  );
}

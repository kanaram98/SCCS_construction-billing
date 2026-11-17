import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import { tr as t } from '../../i18n/translate.js';
import { useCloud } from './CloudProvider.jsx';

/** Explains why only Labour (or only sign-in) is available while signed out. */
export default function SignedOutBanner({ onOpenSettings }) {
  const cloud = useCloud();
  if (cloud.access === 'full') return null;
  if (cloud.access === 'labour') {
    return (
      <Alert severity="info" className="no-print" sx={{ mb: 2 }} action={<Button color="inherit" size="small" onClick={cloud.signIn}>{t('Sign in')}</Button>}>
        {t('Signed out: only Labour is available. Attendance and payments you enter here upload when {name} signs in again.', { name: cloud.lastUser?.name || cloud.lastUser?.email })}
      </Alert>
    );
  }
  return (
    <Alert severity="info" className="no-print" sx={{ mb: 2 }} action={<Button color="inherit" size="small" onClick={onOpenSettings}>{t('Settings')}</Button>}>
      {t('Sign in with Google to open the app.')}
    </Alert>
  );
}

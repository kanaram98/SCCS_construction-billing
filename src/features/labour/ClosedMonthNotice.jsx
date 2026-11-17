import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import LockIcon from '@mui/icons-material/LockOutlined';
import { monthLabel } from '../../domain/labour.js';
import { getLanguage, tr as t } from '../../i18n/translate.js';
import { useMonthLock } from './useLabour.js';
import { useCloud } from '../account/CloudProvider.jsx';

/** Shown on a closed month: nothing can change until it is unlocked. */
export default function ClosedMonthNotice({ month }) {
  const lock = useMonthLock();
  const canUnlock = useCloud().can('unlockMonth');
  if (!lock.isClosed(month)) return null;
  return (
    <Alert
      severity="info"
      icon={<LockIcon />}
      sx={{ mb: 1.5 }}
      action={canUnlock ? <Button color="inherit" size="small" onClick={() => lock.unlock(month)}>{t('Unlock')}</Button> : undefined}
    >
      {t('{month} is closed. Attendance and payments can’t be changed.', { month: monthLabel(month, getLanguage()) })}
    </Alert>
  );
}

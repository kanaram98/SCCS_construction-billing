import AppBar from '@mui/material/AppBar';
import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Toolbar from '@mui/material/Toolbar';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import CloudDoneIcon from '@mui/icons-material/CloudDoneOutlined';
import CloudOffIcon from '@mui/icons-material/CloudOff';
import InstallMobileIcon from '@mui/icons-material/InstallMobile';
import { APP_NAME } from '../../config/app.js';
import { SAVE_STATUS } from '../../state/useBillingStore.js';
import CloudSyncIcon from '@mui/icons-material/CloudSyncOutlined';
import { useCloud } from '../../features/account/CloudProvider.jsx';
import { CLOUD_STATUS_TEXT } from '../../features/account/AccountCard.jsx';
import { DRAWER_WIDTH } from '../../theme.js';
import IconButton from '@mui/material/IconButton';
import SettingsIcon from '@mui/icons-material/SettingsOutlined';
import { tr as t } from '../../i18n/translate.js';

export default function AppHeader({ subtitle, saveStatus, canInstall, onInstall, onOpenSettings }) {
  const saveFailed = saveStatus === SAVE_STATUS.failed;
  const cloud = useCloud();
  const cloudActive = cloud.configured && cloud.user && cloud.status !== 'no-access';
  const statusText = cloudActive ? CLOUD_STATUS_TEXT[cloud.status] || cloud.status : saveStatus;
  const color = saveFailed || cloud.status === 'error' ? 'error.main' : cloudActive && cloud.status === 'offline' ? 'text.disabled' : 'success.main';
  const icon = saveFailed || (cloudActive && (cloud.status === 'error' || cloud.status === 'offline'))
    ? <CloudOffIcon />
    : cloudActive && (cloud.status === 'syncing' || cloud.status === 'connecting') ? <CloudSyncIcon /> : <CloudDoneIcon />;
  return (
    <AppBar
      position="sticky"
      color="inherit"
      elevation={0}
      className="no-print"
      sx={{ borderBottom: 1, borderColor: 'divider', pl: { md: `${DRAWER_WIDTH}px` } }}
    >
      <Toolbar sx={{ gap: 1.5, pt: 'env(safe-area-inset-top)' }}>
        <Avatar variant="rounded" sx={{ bgcolor: 'primary.main', fontWeight: 800, width: 38, height: 38 }}>₹</Avatar>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="subtitle1" noWrap sx={{ lineHeight: 1.2 }}>{t(APP_NAME)}</Typography>
          <Typography variant="caption" color="text.secondary" noWrap component="div">
            {subtitle || t('Feet-and-inches billing')}
          </Typography>
        </Box>
        {canInstall && (
          <Button size="small" variant="contained" startIcon={<InstallMobileIcon />} onClick={onInstall}>{t('Install')}</Button>
        )}
        <Tooltip title={t(statusText)}>
          <Box role="status" aria-label={t(statusText)} sx={{ display: 'flex', color }}>
            {icon}
          </Box>
        </Tooltip>
        <Tooltip title={t('App settings')}>
          <IconButton aria-label={t('App settings')} onClick={onOpenSettings} edge="end">
            <SettingsIcon />
          </IconButton>
        </Tooltip>
      </Toolbar>
    </AppBar>
  );
}

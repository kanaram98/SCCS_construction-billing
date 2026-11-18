import Avatar from '@mui/material/Avatar';
import Box from '@mui/material/Box';
import Divider from '@mui/material/Divider';
import Drawer from '@mui/material/Drawer';
import SwipeableDrawer from '@mui/material/SwipeableDrawer';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import CloseIcon from '@mui/icons-material/Close';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Toolbar from '@mui/material/Toolbar';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import StraightenIcon from '@mui/icons-material/Straighten';
import HomeIcon from '@mui/icons-material/HomeOutlined';
import AssessmentIcon from '@mui/icons-material/AssessmentOutlined';
import DescriptionIcon from '@mui/icons-material/DescriptionOutlined';
import SellIcon from '@mui/icons-material/SellOutlined';
import SettingsIcon from '@mui/icons-material/SettingsOutlined';
import BusinessIcon from '@mui/icons-material/BusinessOutlined';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdfOutlined';
import EngineeringIcon from '@mui/icons-material/EngineeringOutlined';
import AccountTreeIcon from '@mui/icons-material/AccountTreeOutlined';
import PaymentsIcon from '@mui/icons-material/PaymentsOutlined';
import { APP_NAME, NAVIGATION, VIEWS } from '../../config/app.js';
import { useIsMobile } from '../../hooks/useIsMobile.js';
import { DRAWER_WIDTH } from '../../theme.js';
import { tr as t } from '../../i18n/translate.js';

const ICONS = {
  [VIEWS.bills]: <ReceiptLongIcon />,
  [VIEWS.entry]: <StraightenIcon />,
  [VIEWS.home]: <HomeIcon />,
  [VIEWS.rates]: <SellIcon />,
  [VIEWS.settings]: <SettingsIcon />,
  [VIEWS.project]: <DescriptionIcon />,
  [VIEWS.firm]: <BusinessIcon />,
  [VIEWS.reports]: <AssessmentIcon />,
  [VIEWS.print]: <PictureAsPdfIcon />,
  [VIEWS.labour]: <EngineeringIcon />,
  [VIEWS.projects]: <AccountTreeIcon />,
  [VIEWS.expenses]: <PaymentsIcon />
};

/**
 * Navigation: a slide-in side drawer on phones and tablets (opened with the menu
 * button in the top bar), a permanent sidebar on desktop.
 * `views`: limit the tabs (e.g. Labour only while signed out); null shows all.
 */
export default function MainNav({ activeView, onNavigate, views = null, open = false, onClose = () => {}, onOpen = () => {} }) {
  const tabs = NAVIGATION.filter(({ id }) => !views || views.includes(id));
  const isMobile = useIsMobile();
  const items = [...tabs, { id: VIEWS.settings, label: 'Settings' }];

  const list = (
    <List component="nav" aria-label={t('Main navigation')} sx={{ px: 1 }}>
      {items.map(({ id, label }) => (
        <ListItemButton
          key={id}
          selected={activeView === id}
          onClick={() => { onNavigate(id); onClose(); }}
          sx={{ mb: 0.5, '&.Mui-selected': { bgcolor: 'rgba(245, 168, 0, 0.2)' }, '&.Mui-selected:hover': { bgcolor: 'rgba(245, 168, 0, 0.3)' } }}
        >
          <ListItemIcon sx={{ minWidth: 40 }}>{ICONS[id]}</ListItemIcon>
          <ListItemText primary={t(label)} />
        </ListItemButton>
      ))}
    </List>
  );

  if (isMobile) {
    return (
      <SwipeableDrawer
        open={open}
        onClose={onClose}
        onOpen={onOpen}
        disableBackdropTransition
        disableDiscovery
        swipeAreaWidth={24}
        className="no-print"
        sx={{ '& .MuiDrawer-paper': { width: 'min(82vw, 300px)', boxSizing: 'border-box', pt: 'env(safe-area-inset-top)' } }}
      >
        <Toolbar sx={{ gap: 1.5, minHeight: 64 }}>
          <Avatar variant="rounded" sx={{ bgcolor: 'primary.main', fontWeight: 800, width: 38, height: 38 }}>₹</Avatar>
          <Typography variant="subtitle1" noWrap sx={{ flex: 1 }}>{t(APP_NAME)}</Typography>
          <IconButton aria-label={t('Close menu')} onClick={onClose} edge="end"><CloseIcon /></IconButton>
        </Toolbar>
        <Divider />
        <Box sx={{ pt: 1, overflowY: 'auto', pb: 'env(safe-area-inset-bottom)' }}>{list}</Box>
      </SwipeableDrawer>
    );
  }

  return (
    <Drawer
      variant="permanent"
      className="no-print"
      sx={{ width: DRAWER_WIDTH, flexShrink: 0, '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box' } }}
    >
      <Toolbar />
      {list}
    </Drawer>
  );
}

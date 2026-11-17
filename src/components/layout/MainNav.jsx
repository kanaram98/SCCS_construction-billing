import BottomNavigation from '@mui/material/BottomNavigation';
import BottomNavigationAction from '@mui/material/BottomNavigationAction';
import Drawer from '@mui/material/Drawer';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Paper from '@mui/material/Paper';
import Toolbar from '@mui/material/Toolbar';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import StraightenIcon from '@mui/icons-material/Straighten';
import HomeIcon from '@mui/icons-material/HomeOutlined';
import SellIcon from '@mui/icons-material/SellOutlined';
import SettingsIcon from '@mui/icons-material/SettingsOutlined';
import BusinessIcon from '@mui/icons-material/BusinessOutlined';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdfOutlined';
import EngineeringIcon from '@mui/icons-material/EngineeringOutlined';
import { NAVIGATION, VIEWS } from '../../config/app.js';
import { useIsMobile } from '../../hooks/useIsMobile.js';
import { BOTTOM_NAV_HEIGHT, DRAWER_WIDTH } from '../../theme.js';
import { tr as t } from '../../i18n/translate.js';

const ICONS = {
  [VIEWS.bills]: <ReceiptLongIcon />,
  [VIEWS.entry]: <StraightenIcon />,
  [VIEWS.home]: <HomeIcon />,
  [VIEWS.rates]: <SellIcon />,
  [VIEWS.settings]: <SettingsIcon />,
  [VIEWS.project]: <BusinessIcon />,
  [VIEWS.print]: <PictureAsPdfIcon />,
  [VIEWS.labour]: <EngineeringIcon />
};

/** Bottom tab bar on phones/tablets, permanent sidebar on desktop. */
/** `views`: limit the tabs (e.g. Labour only while signed out); null shows all. */
export default function MainNav({ activeView, onNavigate, views = null }) {
  const tabs = NAVIGATION.filter(({ id }) => !views || views.includes(id));
  const isMobile = useIsMobile();

  if (isMobile) {
    if (!tabs.length) return null;
    return (
      <Paper
        elevation={8}
        className="no-print"
        component="nav"
        aria-label={t('Main navigation')}
        sx={{ position: 'fixed', left: 0, right: 0, bottom: 0, zIndex: (theme) => theme.zIndex.appBar + 1, pb: 'env(safe-area-inset-bottom)' }}
      >
        <BottomNavigation showLabels value={activeView} onChange={(_event, view) => onNavigate(view)} sx={{ height: BOTTOM_NAV_HEIGHT }}>
          {tabs.map(({ id, shortLabel, label }) => (
            <BottomNavigationAction key={id} value={id} label={t(shortLabel || label)} icon={ICONS[id]} sx={{ minWidth: 0, px: 0.25, '& .MuiBottomNavigationAction-label': { fontSize: '0.7rem', '&.Mui-selected': { fontSize: '0.72rem' } } }} />
          ))}
        </BottomNavigation>
      </Paper>
    );
  }

  return (
    <Drawer
      variant="permanent"
      className="no-print"
      sx={{ width: DRAWER_WIDTH, flexShrink: 0, '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box' } }}
    >
      <Toolbar />
      <List component="nav" aria-label={t('Main navigation')} sx={{ px: 1 }}>
        {[...tabs, { id: VIEWS.settings, label: 'Settings' }].map(({ id, label }) => (
          <ListItemButton
            key={id}
            selected={activeView === id}
            onClick={() => onNavigate(id)}
            sx={{ mb: 0.5, '&.Mui-selected': { bgcolor: 'rgba(245, 168, 0, 0.2)' }, '&.Mui-selected:hover': { bgcolor: 'rgba(245, 168, 0, 0.3)' } }}
          >
            <ListItemIcon sx={{ minWidth: 40 }}>{ICONS[id]}</ListItemIcon>
            <ListItemText primary={t(label)} />
          </ListItemButton>
        ))}
      </List>
    </Drawer>
  );
}

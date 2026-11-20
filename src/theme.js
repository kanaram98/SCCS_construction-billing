import { createTheme } from '@mui/material/styles';

/**
 * App theme: mobile-first, touch-friendly sizes, in the colours of the SCCS logo
 * (orange, amber, leaf green and the charcoal of the lettering).
 * Light and dark colour schemes; the active one follows the device setting
 * unless the user picks one (stored by MUI in localStorage).
 */
const theme = createTheme({
  cssVariables: { colorSchemeSelector: 'data-mui-color-scheme' },
  colorSchemes: {
    light: {
      palette: {
        primary: { main: '#cc4c15', contrastText: '#ffffff' },
        secondary: { main: '#4f8a3c', contrastText: '#ffffff' },
        background: { default: '#f6f3ef', paper: '#ffffff' },
        text: { primary: '#2d2d2f', secondary: '#6b6b70' },
        divider: '#e4e0da'
      }
    },
    dark: {
      palette: {
        primary: { main: '#f7a547', contrastText: '#2a1606' },
        secondary: { main: '#9fc140', contrastText: '#1a2410' },
        background: { default: '#141415', paper: '#1e1e20' },
        text: { primary: '#ececee', secondary: '#a8a8ae' },
        divider: '#343437'
      }
    }
  },
  shape: { borderRadius: 12 },
  typography: {
    fontFamily: 'Inter, "Segoe UI", system-ui, -apple-system, Roboto, sans-serif',
    h5: { fontWeight: 700, fontSize: '1.35rem' },
    h6: { fontWeight: 700, fontSize: '1.05rem' },
    subtitle1: { fontWeight: 650 },
    subtitle2: { fontWeight: 650 },
    button: { textTransform: 'none', fontWeight: 600 }
  },
  components: {
    // Inputs stay at 16px so iOS Safari does not zoom in on focus.
    MuiTextField: { defaultProps: { size: 'small', fullWidth: true } },
    MuiButton: { defaultProps: { disableElevation: true } },
    MuiFab: { defaultProps: { color: 'primary' } },
    MuiCard: { defaultProps: { variant: 'outlined' } },
    MuiAccordion: {
      defaultProps: { disableGutters: true, variant: 'outlined' },
      styleOverrides: { root: { borderRadius: 12, overflow: 'hidden', '&::before': { display: 'none' } } }
    },
    MuiAccordionSummary: { styleOverrides: { content: { minWidth: 0 } } },
    MuiBottomNavigationAction: { styleOverrides: { root: { minWidth: 0, paddingInline: 4 } } },
    // Menu entries: a soft logo-orange wash on hover and for the page you are on, with an orange edge.
    MuiListItemButton: {
      styleOverrides: {
        root: {
          borderRadius: 10,
          '&:hover': { backgroundColor: 'rgba(236, 107, 53, 0.09)' },
          '&.Mui-selected': { backgroundColor: 'rgba(236, 107, 53, 0.16)', boxShadow: 'inset 3px 0 0 #ec6b35' },
          '&.Mui-selected:hover': { backgroundColor: 'rgba(236, 107, 53, 0.24)' },
          '&.Mui-selected .MuiListItemIcon-root': { color: '#ec6b35' }
        }
      }
    },
    MuiSnackbar: { defaultProps: { anchorOrigin: { vertical: 'bottom', horizontal: 'center' } } }
  }
});

export default theme;


/** Width of the desktop navigation drawer. */
export const DRAWER_WIDTH = 220;
/** Height reserved for the mobile bottom navigation bar. */
/** Height reserved at the bottom of phone screens. Navigation is in the side drawer, so none. */
export const BOTTOM_NAV_HEIGHT = 0;

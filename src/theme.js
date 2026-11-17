import { createTheme } from '@mui/material/styles';

/**
 * App theme: mobile-first, touch-friendly sizes, brand navy + amber.
 * Light and dark colour schemes; the active one follows the device setting
 * unless the user picks one (stored by MUI in localStorage).
 */
const theme = createTheme({
  cssVariables: { colorSchemeSelector: 'data-mui-color-scheme' },
  colorSchemes: {
    light: {
      palette: {
        primary: { main: '#1f3a5f' },
        secondary: { main: '#f5a800', contrastText: '#17202b' },
        background: { default: '#f1f3f6', paper: '#ffffff' },
        text: { primary: '#17202b', secondary: '#647184' },
        divider: '#dde2e9'
      }
    },
    dark: {
      palette: {
        primary: { main: '#8fb4e3' },
        secondary: { main: '#f5b829', contrastText: '#17202b' },
        background: { default: '#0f141a', paper: '#18202a' },
        text: { primary: '#e6ebf1', secondary: '#9aa8b8' },
        divider: '#2b3644'
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
    MuiListItemButton: { styleOverrides: { root: { borderRadius: 10 } } },
    MuiSnackbar: { defaultProps: { anchorOrigin: { vertical: 'bottom', horizontal: 'center' } } }
  }
});

export default theme;

/** Subtle tinted background for nested surfaces (areas, chips, table heads). */
export const SUBTLE_SURFACE = 'action.hover';

/** Width of the desktop navigation drawer. */
export const DRAWER_WIDTH = 220;
/** Height reserved for the mobile bottom navigation bar. */
export const BOTTOM_NAV_HEIGHT = 64;

import { createTheme } from '@mui/material/styles';

/** App theme: mobile-first, touch-friendly sizes, brand navy + amber. */
const theme = createTheme({
  palette: {
    primary: { main: '#1f3a5f' },
    secondary: { main: '#f5a800', contrastText: '#17202b' },
    background: { default: '#f1f3f6', paper: '#ffffff' },
    text: { primary: '#17202b', secondary: '#647184' },
    divider: '#dde2e9'
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
    MuiPaper: { styleOverrides: { outlined: { borderColor: '#dde2e9' } } },
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

/** Width of the desktop navigation drawer. */
export const DRAWER_WIDTH = 220;
/** Height reserved for the mobile bottom navigation bar. */
export const BOTTOM_NAV_HEIGHT = 64;

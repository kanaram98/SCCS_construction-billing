import useMediaQuery from '@mui/material/useMediaQuery';
import { useTheme } from '@mui/material/styles';

/** True below the `md` breakpoint: phones and small tablets get the bottom-navigation layout. */
export function useIsMobile() {
  const theme = useTheme();
  return useMediaQuery(theme.breakpoints.down('md'));
}

/** True on phone-width screens, where dialogs open full screen. */
export function useIsPhone() {
  const theme = useTheme();
  return useMediaQuery(theme.breakpoints.down('sm'));
}

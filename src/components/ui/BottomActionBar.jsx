import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import { BOTTOM_NAV_HEIGHT, DRAWER_WIDTH } from '../../theme.js';

/**
 * Bar pinned to the bottom of the screen (above the mobile bottom navigation).
 * Renders a spacer so page content is never hidden behind it.
 */
export default function BottomActionBar({ children }) {
  return (
    <>
      <Box sx={{ height: 76 }} aria-hidden="true" />
      <Paper
        elevation={6}
        className="no-print"
        sx={{
          position: 'fixed',
          zIndex: (theme) => theme.zIndex.appBar,
          left: { xs: 8, md: DRAWER_WIDTH + 16 },
          right: { xs: 8, md: 16 },
          bottom: { xs: `calc(${BOTTOM_NAV_HEIGHT + 8}px + env(safe-area-inset-bottom))`, md: 16 },
          maxWidth: 900,
          mx: { md: 'auto' },
          px: 1.5,
          py: 1,
          borderRadius: 3
        }}
      >
        <Stack direction="row" spacing={1.5} sx={{ alignItems: 'center', justifyContent: 'space-between' }}>
          {children}
        </Stack>
      </Paper>
    </>
  );
}

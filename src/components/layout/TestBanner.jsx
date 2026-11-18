import { useEffect } from 'react';
import Box from '@mui/material/Box';
import { APP_ENV } from '../../config/app.js';

/** Only in the test copy of the app: a ribbon and tab title so it is never mistaken for the real one. */
export default function TestBanner() {
  const isTest = APP_ENV === 'test';
  useEffect(() => {
    if (!isTest) return;
    document.title = `TEST · ${document.title.replace(/^TEST · /, '')}`;
  }, [isTest]);
  if (!isTest) return null;
  return (
    <Box
      className="no-print"
      role="status"
      sx={{ position: 'fixed', bottom: 'calc(8px + env(safe-area-inset-bottom))', right: 8, zIndex: 2000, pointerEvents: 'none', bgcolor: 'error.main', color: 'error.contrastText', fontSize: 11, fontWeight: 800, letterSpacing: 0.5, px: 1.25, py: 0.4, borderRadius: 1, opacity: 0.92 }}
    >
      TEST COPY · fake data only
    </Box>
  );
}

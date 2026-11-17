import Box from '@mui/material/Box';
import { Notice } from '../../components/ui';
import { tr as t } from '../../i18n/translate.js';
import { useCloud } from './CloudProvider.jsx';

/**
 * Shows its contents read-only, with a note, to people whose role can't do
 * `action` (the server refuses such changes anyway).
 */
export default function AdminOnly({ action = 'editFirm', message, children }) {
  const cloud = useCloud();
  if (cloud.can(action)) return children;
  return (
    <>
      <Notice tone="info">{message || t('Only the admin can change these details.')}</Notice>
      <Box component="fieldset" disabled sx={{ border: 0, p: 0, m: 0, minWidth: 0, opacity: 0.75 }}>
        {children}
      </Box>
    </>
  );
}

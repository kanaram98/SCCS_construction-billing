import Box from '@mui/material/Box';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { formatCurrency } from '../../domain/formatters.js';

/** Accordion header content for a section or area: name, counts and total. */
export default function GroupSummary({ name, meta, total, variant = 'section' }) {
  return (
    <Stack direction="row" spacing={1} sx={{ width: '100%', pr: 1, alignItems: 'center', justifyContent: 'space-between', minWidth: 0 }}>
      <Box sx={{ minWidth: 0 }}>
        <Typography variant={variant === 'section' ? 'subtitle1' : 'subtitle2'} noWrap>{name || 'Untitled'}</Typography>
        <Typography variant="caption" color="text.secondary">{meta}</Typography>
      </Box>
      <Typography variant="subtitle2" color="primary" sx={{ whiteSpace: 'nowrap' }}>{formatCurrency(total)}</Typography>
    </Stack>
  );
}

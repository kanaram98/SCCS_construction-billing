import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import { localToday, monthLabel, monthOf, shiftMonth } from '../../domain/labour.js';
import { getLanguage, tr as t } from '../../i18n/translate.js';

/** "◀ November 2026 ▶": go back month by month; never past the current month. */
export default function MonthBar({ month, onChange }) {
  const current = monthOf(localToday());
  return (
    <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1.5 }}>
      <IconButton aria-label={t('Previous month')} onClick={() => onChange(shiftMonth(month, -1))}><ChevronLeftIcon /></IconButton>
      <Typography variant="h6" component="h2">{monthLabel(month, getLanguage())}</Typography>
      <IconButton aria-label={t('Next month')} onClick={() => onChange(shiftMonth(month, 1))} disabled={month >= current}><ChevronRightIcon /></IconButton>
    </Stack>
  );
}

import Box from '@mui/material/Box';
import ButtonBase from '@mui/material/ButtonBase';
import Typography from '@mui/material/Typography';
import { daysOfMonth, firstWeekday, weekdayNames } from '../domain/labour.js';
import { getLanguage } from '../i18n/translate.js';

/** Day tile colours (shared by the attendance and expense calendars). */
const TONES = {
  full: { bgcolor: 'success.main', color: 'success.contrastText', borderColor: 'success.main' },
  partial: { bgcolor: 'warning.light', color: 'common.black', borderColor: 'warning.main' },
  amber: { bgcolor: 'warning.main', color: 'common.black', borderColor: 'warning.dark' },
  absent: { bgcolor: 'error.main', color: 'error.contrastText', borderColor: 'error.main' },
  empty: { bgcolor: 'transparent', color: 'text.primary', borderColor: 'divider' }
};

/** One day of the month: its number and a short value. Days after `today` are disabled. */
export function DayTile({ date, today, tone, value, note, ariaLabel, onClick }) {
  const future = date > today;
  return (
    <ButtonBase
      onClick={onClick}
      disabled={future}
      aria-label={ariaLabel}
      sx={{
        ...TONES[tone],
        flexDirection: 'column',
        border: 1,
        borderRadius: '10px',
        minHeight: 46,
        py: 0.5,
        opacity: future ? 0.35 : 1,
        outline: date === today ? '2px solid' : 'none',
        outlineColor: 'primary.main',
        outlineOffset: 1
      }}
    >
      <Typography variant="caption" sx={{ lineHeight: 1.1, opacity: 0.8 }}>{Number(date.slice(8))}</Typography>
      <Typography variant="caption" sx={{ fontWeight: 700, lineHeight: 1.3, minHeight: '1.3em' }}>{value}</Typography>
      {note ? <Typography component="span" sx={{ fontSize: '0.62rem', lineHeight: 1.1, opacity: 0.85 }}>{note}</Typography> : null}
    </ButtonBase>
  );
}

/** A month as a Sunday-first grid of tiles; `renderTile(date)` makes each one. */
export function MonthCalendar({ month, renderTile }) {
  const names = weekdayNames(getLanguage());
  const blanks = firstWeekday(month);
  return (
    <Box sx={{ display: 'grid', gridTemplateColumns: 'repeat(7, minmax(0, 1fr))', gap: 0.5 }}>
      {names.map((name, index) => (
        <Typography key={index} variant="caption" color="text.secondary" sx={{ textAlign: 'center', fontWeight: 600 }}>{name}</Typography>
      ))}
      {Array.from({ length: blanks }, (_unused, index) => <span key={`blank-${index}`} />)}
      {daysOfMonth(month).map(renderTile)}
    </Box>
  );
}

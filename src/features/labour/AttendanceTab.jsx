import { useMemo } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import DoneAllIcon from '@mui/icons-material/DoneAll';
import EngineeringIcon from '@mui/icons-material/EngineeringOutlined';
import { EmptyState, TextField } from '../../components/ui';
import { useBilling } from '../../state/BillingContext.jsx';
import { useUndoable } from '../../hooks/useUndoable.js';
import { ATTENDANCE_UNITS, daySummary, formatUnits, localToday, shiftDate } from '../../domain/labour.js';
import { formatCurrency } from '../../domain/formatters.js';
import { tr as t } from '../../i18n/translate.js';

const UNIT_LABELS = { 0: 'A', 0.5: '½P', 1: '1P', 1.5: '1½P', 2: '2P' };

/** Date picker with previous / next day. */
function DateBar({ date, onChange }) {
  const today = localToday();
  return (
    <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1.5 }}>
      <IconButton aria-label={t('Previous day')} onClick={() => onChange(shiftDate(date, -1))}><ChevronLeftIcon /></IconButton>
      <Box sx={{ flex: 1 }}>
        <TextField label={t('Date')} type="date" value={date} onChange={(value) => value && onChange(value)} />
      </Box>
      <IconButton aria-label={t('Next day')} onClick={() => onChange(shiftDate(date, 1))} disabled={date >= today}><ChevronRightIcon /></IconButton>
      {date !== today && <Chip label={t('Today')} onClick={() => onChange(today)} color="primary" variant="outlined" />}
    </Stack>
  );
}

function WorkerRow({ worker, mark, onMark }) {
  const value = mark ? String(mark.units) : null;
  return (
    <Box sx={{ py: 1.25, borderBottom: 1, borderColor: 'divider', '&:last-child': { borderBottom: 0 } }}>
      <Stack direction="row" sx={{ alignItems: 'baseline', justifyContent: 'space-between', mb: 0.75 }}>
        <Typography variant="subtitle2" noWrap sx={{ minWidth: 0 }}>{worker.name}</Typography>
        <Typography variant="caption" color="text.secondary" noWrap sx={{ ml: 1 }}>
          {[worker.role, t('{amount}/day', { amount: formatCurrency(worker.dailyWage) })].filter(Boolean).join(' · ')}
        </Typography>
      </Stack>
      <ToggleButtonGroup
        exclusive
        fullWidth
        size="small"
        value={value}
        aria-label={t('Attendance for {name}', { name: worker.name })}
        onChange={(_event, next) => onMark(next === null ? null : Number(next))}
      >
        {ATTENDANCE_UNITS.map((units) => (
          <ToggleButton
            key={units}
            value={String(units)}
            aria-label={`${worker.name} ${formatUnits(units)}`}
            color={units === 0 ? 'error' : 'success'}
            sx={{
              fontWeight: 700,
              py: 0.75,
              '&.Mui-selected, &.Mui-selected:hover': {
                bgcolor: units === 0 ? 'error.main' : 'success.main',
                color: units === 0 ? 'error.contrastText' : 'success.contrastText'
              }
            }}
          >
            {UNIT_LABELS[units]}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </Box>
  );
}

/** Mark today's attendance for every working labourer. */
export default function AttendanceTab({ date, onDateChange, onAddWorkers }) {
  const { data, actions } = useBilling();
  const undoable = useUndoable();
  const { labour } = data;
  const workers = useMemo(() => labour.workers.filter((worker) => worker.active), [labour.workers]);
  const marks = labour.attendance[date] || {};
  const summary = daySummary(labour, date);
  const unmarked = workers.filter((worker) => !marks[worker.id]);

  if (!workers.length) {
    return (
      <EmptyState
        icon={<EngineeringIcon fontSize="large" />}
        title={t('No workers yet')}
        description={t('Add your workers with their daily wage, then mark attendance every day.')}
        action={<Button variant="contained" onClick={onAddWorkers}>{t('Add workers')}</Button>}
      />
    );
  }

  return (
    <>
      <DateBar date={date} onChange={onDateChange} />
      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ py: 1.5, '&:last-child': { pb: 1.5 } }}>
          <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
            <Typography variant="body2">
              <strong>{t('{present} present', { present: summary.present })}</strong>
              {' · '}{formatUnits(summary.units)}{' · '}{formatCurrency(summary.cost)}
            </Typography>
            <Stack direction="row" spacing={1}>
              {unmarked.length > 0 && (
                <Button size="small" startIcon={<DoneAllIcon />} onClick={() => actions.labour.markAll(date, unmarked, 1)}>
                  {summary.marked > 0 ? t('Rest 1P') : t('All 1P')}
                </Button>
              )}
              {summary.marked > 0 && (
                <Button size="small" color="inherit" onClick={() => undoable(t('Day cleared.'), () => actions.labour.markAll(date, workers, null))}>
                  {t('Clear')}
                </Button>
              )}
            </Stack>
          </Stack>
          {unmarked.length > 0 && summary.marked > 0 && (
            <Typography variant="caption" color="warning.main">{t('{count} not marked yet', { count: unmarked.length })}</Typography>
          )}
        </CardContent>
      </Card>
      <Card>
        <CardContent sx={{ py: 0.5, '&:last-child': { pb: 0.5 } }}>
          {workers.map((worker) => (
            <WorkerRow key={worker.id} worker={worker} mark={marks[worker.id]} onMark={(units) => actions.labour.mark(date, worker, units)} />
          ))}
        </CardContent>
      </Card>
      <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
        {t('A = absent · ½P = half day · 1P = full day · 1½P = day and a half · 2P = double. Tap again to clear.')}
      </Typography>
    </>
  );
}

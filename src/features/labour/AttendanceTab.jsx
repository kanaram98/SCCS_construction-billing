import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import EngineeringIcon from '@mui/icons-material/EngineeringOutlined';
import EventAvailableIcon from '@mui/icons-material/EventAvailableOutlined';
import LockIcon from '@mui/icons-material/LockOutlined';
import { EmptyState, ResponsiveDialog, SelectField } from '../../components/ui';
import { useBilling } from '../../state/BillingContext.jsx';
import { useUndoable } from '../../hooks/useUndoable.js';
import {
  ATTENDANCE_UNITS, dayLabel, daySummary, formatUnits,
  isDateClosed, localToday, monthOf, shiftDate, workerMonth
} from '../../domain/labour.js';
import { formatCurrency } from '../../domain/formatters.js';
import { compactAmount } from '../../domain/projects.js';
import { getLanguage, tr as t } from '../../i18n/translate.js';
import { DayTile, MonthCalendar } from '../../components/DayGrid.jsx';
import MonthBar from './MonthBar.jsx';
import ClosedMonthNotice from './ClosedMonthNotice.jsx';
import { useLabour, useMonthLock, useOldDateGuard } from './useLabour.js';
import { useCloud } from '../account/CloudProvider.jsx';
import { CONTRACTOR_TIMESHEET_DAYS } from '../../domain/permissions.js';
import { Notice } from '../../components/ui';

const UNIT_LABELS = { 0: 'A', 0.5: '½P', 1: '1P', 1.5: '1½P', 2: '2P' };
const unitLabel = (units) => UNIT_LABELS[units] ?? formatUnits(units);

/** Workers to show on a day: everyone working, plus anyone who left but was marked that day. */
function workersOn(labour, date) {
  const marks = labour.attendance[date] || {};
  return labour.workers.filter((worker) => worker.active || marks[worker.id]);
}

// ── Calendar ──────────────────────────────────────────────────────────

// ── Day sheet ─────────────────────────────────────────────────────────

function WorkerRow({ worker, mark, onMark, disabled }) {
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
        disabled={disabled}
        value={mark ? String(mark.units) : null}
        aria-label={t('Attendance for {name}', { name: worker.name })}
        onChange={(_event, next) => onMark(next === null ? null : Number(next))}
      >
        {ATTENDANCE_UNITS.map((units) => (
          <ToggleButton
            key={units}
            value={String(units)}
            aria-label={`${worker.name} ${formatUnits(units)}`}
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

/** Everyone's attendance for one day, with ◀ ▶ to move between days of the month. */
function DaySheet({ date, month, siteId, onDateChange, onClose }) {
  const { labour, actions } = useLabour();
  const undoable = useUndoable();
  const allowOld = useOldDateGuard();
  const cloud = useCloud();
  const tooOld = Boolean(date) && !cloud.canEditDate(date);
  const closed = Boolean(date) && (isDateClosed(labour, date) || tooOld);
  const change = (apply) => async () => { if (await allowOld(date)) apply(); };
  const today = localToday();
  const workers = date ? workersOn(labour, date) : [];
  const marks = (date && labour.attendance[date]) || {};
  const summary = date ? daySummary(labour, date) : null;
  const unmarked = workers.filter((worker) => !marks[worker.id]);
  const previous = date && shiftDate(date, -1);
  const next = date && shiftDate(date, 1);

  return (
    <ResponsiveDialog open={Boolean(date)} title={date ? dayLabel(date, getLanguage()) : ''} onClose={onClose} maxWidth="xs">
      {date && (
        <>
          <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
            <IconButton aria-label={t('Previous day')} disabled={monthOf(previous) !== month} onClick={() => onDateChange(previous)}><ChevronLeftIcon /></IconButton>
            <Typography variant="body2" sx={{ textAlign: 'center' }}>
              <strong>{t('{present} present', { present: summary.present })}</strong>
              {' · '}{formatUnits(summary.units)}{' · '}{formatCurrency(summary.cost)}
            </Typography>
            <IconButton aria-label={t('Next day')} disabled={monthOf(next) !== month || next > today} onClick={() => onDateChange(next)}><ChevronRightIcon /></IconButton>
          </Stack>
          <ClosedMonthNotice month={month} />
          {tooOld && <Notice tone="info">{t('This day is more than {days} days old. Only the admin can change it.', { days: CONTRACTOR_TIMESHEET_DAYS })}</Notice>}
          <Stack direction="row" spacing={1} sx={{ justifyContent: 'center', flexWrap: 'wrap', rowGap: 1, mb: 1, display: closed ? 'none' : 'flex' }}>
            {unmarked.length > 0 && (
              <>
                <Typography variant="caption" color="text.secondary" sx={{ alignSelf: 'center' }}>{summary.marked > 0 ? t('Fill the rest:') : t('Fill all:')}</Typography>
                {[0.5, 1, 1.5, 2].map((units) => (
                  <Button key={units} size="small" variant="outlined" onClick={change(() => actions.markAll(date, unmarked, units, siteId))} aria-label={t('Fill {units} for everyone', { units: formatUnits(units) })} sx={{ minWidth: 0, px: 1.25 }}>
                    {UNIT_LABELS[units]}
                  </Button>
                ))}
              </>
            )}
            {summary.marked > 0 && (
              <Button size="small" color="inherit" onClick={change(() => undoable(t('Day cleared.'), () => actions.markAll(date, workers, null)))}>
                {t('Clear')}
              </Button>
            )}
          </Stack>
          {workers.map((worker) => (
            <WorkerRow key={worker.id} worker={worker} mark={marks[worker.id]} disabled={closed} onMark={(units) => change(() => actions.mark(date, worker, units, siteId))()} />
          ))}
          <Button fullWidth variant="contained" onClick={onClose} sx={{ mt: 2 }}>{t('Done')}</Button>
        </>
      )}
    </ResponsiveDialog>
  );
}

/** The site new marks are saved against: remembered on this phone; the only running project by default. */
function useSite(projects) {
  const [stored, setStored] = useState(() => {
    try { return window.localStorage.getItem('attendance_site') || ''; } catch { return ''; }
  });
  const running = projects.filter((project) => project.status === 'running');
  const valid = projects.some((project) => project.id === stored);
  const siteId = valid ? stored : (running.length === 1 ? running[0].id : '');
  function setSite(next) {
    setStored(next);
    try { window.localStorage.setItem('attendance_site', next); } catch { /* remembering is optional */ }
  }
  return [siteId, setSite];
}

// ── Tab ───────────────────────────────────────────────────────────────

/**
 * Month calendar of attendance. "All workers": tap a day to fill everyone's
 * attendance. One worker selected: tap a day to pick their mark directly.
 */
export default function AttendanceTab({ month, onMonthChange, onAddWorkers }) {
  const { labour, actions } = useLabour();
  const allowOld = useOldDateGuard();
  const lock = useMonthLock();
  const closed = lock.isClosed(month);
  const cloud = useCloud();
  const today = localToday();
  const { data } = useBilling();
  const [workerId, setWorkerId] = useState('all');
  const [siteId, setSite] = useSite(data.projects);
  const [openDate, setOpenDate] = useState(null);
  const [picker, setPicker] = useState(null); // { anchor, date } in single-worker view
  const active = useMemo(() => labour.workers.filter((worker) => worker.active), [labour.workers]);
  const worker = labour.workers.find((entry) => entry.id === workerId) || null;
  const workerSummary = worker ? workerMonth(labour, worker.id, month) : null;
  const todayMarks = labour.attendance[today] || {};
  const todayUnmarked = workersOn(labour, today).filter((entry) => !todayMarks[entry.id]);
  const todayMarked = Object.keys(todayMarks).length > 0;

  if (!labour.workers.length) {
    return (
      <EmptyState
        icon={<EngineeringIcon fontSize="large" />}
        title={t('No workers yet')}
        description={t('Add your workers with their daily wage, then mark attendance every day.')}
        action={<Button variant="contained" onClick={onAddWorkers}>{t('Add workers')}</Button>}
      />
    );
  }

  function allTile(date) {
    const workers = workersOn(labour, date);
    const summary = daySummary(labour, date);
    const tone = !summary.marked ? 'empty' : summary.present === 0 ? 'absent' : summary.marked >= workers.length ? 'full' : 'partial';
    return (
      <DayTile
        key={date}
        date={date}
        today={today}
        tone={tone}
        value={summary.marked ? formatUnits(summary.units) : ''}
        note={summary.marked && summary.cost > 0 ? compactAmount(summary.cost) : ''}
        ariaLabel={`${dayLabel(date, getLanguage())}: ${summary.marked ? `${t('{present} present', { present: summary.present })} · ${formatCurrency(summary.cost)}` : t('Not marked')}`}
        onClick={() => setOpenDate(date)}
      />
    );
  }

  function workerTile(date) {
    const mark = labour.attendance[date]?.[worker.id];
    const tone = !mark ? 'empty' : mark.units === 0 ? 'absent' : 'full';
    return (
      <DayTile
        key={date}
        date={date}
        today={today}
        tone={tone}
        value={mark ? unitLabel(mark.units) : ''}
        ariaLabel={`${dayLabel(date, getLanguage())}: ${mark ? formatUnits(mark.units) : t('Not marked')}`}
        onClick={(event) => (closed || !cloud.canEditDate(date) ? setOpenDate(date) : setPicker({ anchor: event.currentTarget, date }))}
      />
    );
  }

  async function pick(units) {
    const { date } = picker;
    setPicker(null);
    if (await allowOld(date)) actions.mark(date, worker, units, siteId);
  }

  const showWorkers = [...active, ...(worker && !worker.active ? [worker] : [])];

  return (
    <>
      <MonthBar month={month} onChange={onMonthChange} />
      <ClosedMonthNotice month={month} />

      {data.projects.length > 0 && (
        <SelectField
          label={t('Working at (site)')}
          value={siteId}
          placeholder={t('No site')}
          options={data.projects.filter((project) => project.status === 'running' || project.id === siteId).map((project) => ({ value: project.id, label: project.name }))}
          helperText={t('New marks are saved against this site, so each project can show its labour cost.')}
          onChange={setSite}
          sx={{ mb: 1.5 }}
        />
      )}
      <Stack direction="row" spacing={1} sx={{ overflowX: 'auto', pb: 1, mb: 1, mx: -0.5, px: 0.5 }}>
        <Chip label={t('All workers')} color={workerId === 'all' ? 'primary' : 'default'} variant={workerId === 'all' ? 'filled' : 'outlined'} onClick={() => setWorkerId('all')} />
        {showWorkers.map((entry) => (
          <Chip
            key={entry.id}
            label={entry.name}
            color={workerId === entry.id ? 'primary' : 'default'}
            variant={workerId === entry.id ? 'filled' : 'outlined'}
            onClick={() => setWorkerId(entry.id)}
          />
        ))}
      </Stack>

      <Card sx={{ mb: 2 }}>
        <CardContent sx={{ p: 1.25, '&:last-child': { pb: 1.25 } }}>
          <MonthCalendar month={month} renderTile={worker ? workerTile : allTile} />
        </CardContent>
      </Card>

      {worker ? (
        <Typography variant="body2" sx={{ mb: 1 }}>
          <strong>{worker.name}</strong>{': '}
          {t('{units} · {days} days · {absent} absent', { units: formatUnits(workerSummary.units), days: workerSummary.days, absent: workerSummary.absent })}
          {' · '}{formatCurrency(workerSummary.earned)}
        </Typography>
      ) : (
        month === monthOf(today) && !closed && (
          <Button fullWidth variant="contained" startIcon={<EventAvailableIcon />} onClick={() => setOpenDate(today)} sx={{ mb: 1 }}>
            {t('Mark today’s attendance')}
          </Button>
        )
      )}
      {!worker && month === monthOf(today) && !closed && todayUnmarked.length > 0 && (
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', justifyContent: 'center', mb: 1 }}>
          <Typography variant="caption" color="text.secondary">{todayMarked ? t('Fill the rest:') : t('Fill all:')}</Typography>
          {[0.5, 1, 1.5, 2].map((units) => (
            <Button key={units} size="small" variant="outlined" onClick={() => actions.markAll(today, todayUnmarked, units, siteId)} aria-label={t('Fill {units} for everyone today', { units: formatUnits(units) })} sx={{ minWidth: 0, px: 1.25 }}>{UNIT_LABELS[units]}</Button>
          ))}
        </Stack>
      )}
      <Typography variant="caption" color="text.secondary" component="p">
        {worker
          ? t('Tap a day to choose A, ½P, 1P, 1½P or 2P.')
          : t('Tap a day to fill attendance. Green = everyone marked, yellow = some marked, red = all absent.')}
      </Typography>

      {!closed && (
        <Button fullWidth variant="outlined" startIcon={<LockIcon />} onClick={() => lock.close(month)} sx={{ mt: 1.5 }}>{t('Close month')}</Button>
      )}

      <DaySheet date={openDate} month={month} siteId={siteId} onDateChange={setOpenDate} onClose={() => setOpenDate(null)} />

      <Menu anchorEl={picker?.anchor} open={Boolean(picker)} onClose={() => setPicker(null)}>
        {ATTENDANCE_UNITS.map((units) => (
          <MenuItem
            key={units}
            selected={labour.attendance[picker?.date]?.[worker?.id]?.units === units}
            onClick={() => pick(units)}
            sx={{ fontWeight: 700, color: units === 0 ? 'error.main' : 'inherit' }}
          >
            {UNIT_LABELS[units]}
          </MenuItem>
        ))}
        <MenuItem onClick={() => pick(null)} sx={{ color: 'text.secondary' }}>{t('Clear')}</MenuItem>
      </Menu>
    </>
  );
}

import { useMemo, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import DownloadIcon from '@mui/icons-material/Download';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonthOutlined';
import ListIcon from '@mui/icons-material/ViewListOutlined';
import PdfIcon from '@mui/icons-material/PictureAsPdfOutlined';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import TableViewIcon from '@mui/icons-material/TableChartOutlined';
import Chip from '@mui/material/Chip';
import { EmptyState, PageHeading, SelectField, StatCard, TextField, useConfirm, useNotify } from '../../components/ui';
import { useBilling } from '../../state/BillingContext.jsx';
import { useUndoable } from '../../hooks/useUndoable.js';
import { useActiveProject } from '../../hooks/useActiveProject.js';
import { VIEWS } from '../../config/app.js';
import { EXPENSE_AMBER_ABOVE, EXPENSE_CATEGORIES, EXPENSE_RED_ABOVE, compactAmount, expenseDayTone, expensesByCategory, expensesByDay, totalAmount } from '../../domain/projects.js';
import { dayLabel, localToday, monthLabel, monthOf, shiftMonth } from '../../domain/labour.js';
import { formatCurrency } from '../../domain/formatters.js';
import { isShareCancelled } from '../../services/files.js';
import { getLanguage, makeTranslator, tr as t, trn } from '../../i18n/translate.js';
import { useCloud } from '../account/CloudProvider.jsx';
import { DayTile, MonthCalendar } from '../../components/DayGrid.jsx';
import FitToWidth from '../print/preview/FitToWidth.jsx';
import ExpenseDays from './ExpenseDays.jsx';
import ExpenseDaySheet from './ExpenseDaySheet.jsx';
import ExpenseDialog from './ExpenseDialog.jsx';
import ExpenseSheetDocument from './ExpenseSheetDocument.jsx';

const PORTRAIT_WIDTH_PX = 794; // A4 portrait at 96 dpi

/** "◀ November 2026 ▶": back month by month, not past the current month. */
function MonthNav({ month, onChange }) {
  const current = monthOf(localToday());
  return (
    <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mb: 1 }}>
      <IconButton aria-label={t('Previous month')} onClick={() => onChange(shiftMonth(month, -1))}><ChevronLeftIcon /></IconButton>
      <Typography variant="h6" component="h2">{monthLabel(month, getLanguage())}</Typography>
      <IconButton aria-label={t('Next month')} onClick={() => onChange(shiftMonth(month, 1))} disabled={month >= current}><ChevronRightIcon /></IconButton>
    </Stack>
  );
}

/** Site expenses day by day: add (also offline), edit, export as PDF or CSV. */
export default function ExpensesPage({ onNavigate, focus = {} }) {
  const { data, actions } = useBilling();
  const cloud = useCloud();
  const notify = useNotify();
  const confirm = useConfirm();
  const undoable = useUndoable();
  const sheetRef = useRef(null);
  const [month, setMonth] = useState(() => focus.month || monthOf(localToday()));
  const [view, setView] = useState('calendar'); // calendar | table | pdf
  const [editing, setEditing] = useState(null); // an expense, 'new' or null
  const [newDate, setNewDate] = useState(''); // the day a new expense starts on
  const [openDay, setOpenDay] = useState(''); // the day shown in the day sheet
  const [busy, setBusy] = useState(false);
  const { projects, expenses } = data;
  const [projectId, setProjectId] = useActiveProject(projects, focus.projectId);
  const language = getLanguage();
  const docT = makeTranslator(language);

  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('');
  const wholeMonth = useMemo(() => expensesByDay(expenses, { projectId, month }).flatMap((day) => day.items), [expenses, projectId, month]);
  const shown = useMemo(() => {
    const words = query.trim().toLowerCase();
    return expenses.filter((expense) => (!category || expense.category === category)
      && (!words || `${expense.note || ''} ${t(EXPENSE_CATEGORIES[expense.category] || expense.category)} ${expense.amount}`.toLowerCase().includes(words)));
  }, [expenses, query, category]);
  const days = useMemo(() => expensesByDay(shown, { projectId, month }), [shown, projectId, month]);
  const monthItems = days.flatMap((day) => day.items);
  const today = localToday();
  const dayOf = useMemo(() => new Map(days.map((day) => [day.date, day])), [days]);
  const todayTotal = totalAmount(monthItems.filter((expense) => expense.date === today));
  const projectLabel = projects.find((project) => project.id === projectId)?.name || '';
  const dateError = (date) => (cloud.canEditDate(date) ? '' : t('Only the admin can use a date older than 2 days.'));
  const mayChange = (expense) => cloud.canEditDate(expense.date);

  function startNew(date = '') {
    setNewDate(date);
    setOpenDay('');
    setEditing('new');
  }

  function tapDay(date) {
    if (dayOf.has(date)) setOpenDay(date);
    else startNew(date);
  }

  function open(expense) {
    setOpenDay('');
    if (!mayChange(expense)) {
      notify(t('This expense is more than 2 days old. Only the admin can change it.'), 'info');
      return;
    }
    setEditing(expense);
  }

  function save(values) {
    if (editing === 'new') {
      actions.expenses.add(values);
      notify(t('Expense added.'), 'success');
    } else {
      actions.expenses.update(editing.id, values);
    }
    setEditing(null);
  }

  async function remove() {
    const expense = editing;
    const ok = await confirm({ title: t('Delete this expense?'), message: `${formatCurrency(expense.amount)} · ${expense.date}`, confirmLabel: t('Delete'), danger: true });
    if (!ok) return;
    setEditing(null);
    undoable(t('Expense deleted.'), () => actions.expenses.remove(expense.id));
  }

  async function deleteOne(expense) {
    const ok = await confirm({ title: t('Delete this expense?'), message: `${formatCurrency(expense.amount)} · ${expense.date}`, confirmLabel: t('Delete'), danger: true });
    if (!ok) return;
    undoable(t('Expense deleted.'), () => actions.expenses.remove(expense.id));
  }

  async function deleteDay(day) {
    const ok = await confirm({
      title: t('Delete all expenses of this day?'),
      message: `${dayLabel(day.date, language)} · ${trn(day.items.length, '{count} expense', '{count} expenses')} · ${formatCurrency(day.total)}`,
      confirmLabel: t('Delete all'),
      danger: true
    });
    if (!ok) return;
    setOpenDay('');
    undoable(trn(day.items.length, '{count} expense deleted.', '{count} expenses deleted.'), () => day.items.forEach((expense) => actions.expenses.remove(expense.id)));
  }

  async function exportAs(kind) {
    setBusy(true);
    try {
      const { exportExpensePdf, exportExpenseCsv } = await import('../../documents/expense-export.js');
      const details = { days, projects, projectLabel, showProject: !projectId, month, firm: data.firm, language };
      if (kind === 'pdf') await exportExpensePdf({ ...details, rendered: sheetRef.current?.querySelector('.expense-document') });
      else await exportExpenseCsv(details);
      notify(t('File ready to save or share.'));
    } catch (error) {
      if (!isShareCancelled(error)) notify(t('Export failed: {reason}', { reason: error.message || t('Unknown error') }), 'error');
    } finally {
      setBusy(false);
    }
  }

  if (!projects.length) {
    return (
      <section>
        <PageHeading title={t('Expenses')} description={t('Daily site spending: food, travel and more.')} />
        <EmptyState
          title={t('Add a project first')}
          description={t('Expenses belong to a project (site). Add your first project, then come back to record expenses.')}
          action={<Button variant="contained" onClick={() => onNavigate(VIEWS.projects)}>{t('Go to Projects')}</Button>}
        />
      </section>
    );
  }

  return (
    <section>
      <PageHeading
        title={t('Expenses')}
        description={t('Daily site spending: food, travel and more.')}
        action={<Button variant="contained" startIcon={<AddIcon />} onClick={() => startNew()}>{t('Add expense')}</Button>}
      />
      <SelectField
        label={t('Project')}
        value={projectId}
        helperText={t('You see and add expenses for this project only. Switch project to work on another.')}
        options={projects.map((project) => ({ value: project.id, label: project.name }))}
        onChange={setProjectId}
        sx={{ mb: 1.5 }}
      />
      <MonthNav month={month} onChange={setMonth} />
      <Grid container spacing={1.5} sx={{ mb: 1.5 }}>
        <Grid size={6}><StatCard label={t('This month')} value={formatCurrency(totalAmount(monthItems))} /></Grid>
        <Grid size={6}><StatCard label={t('Today')} value={formatCurrency(todayTotal)} /></Grid>
      </Grid>
      {monthItems.length > 0 && (
        <>
          <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.75, mb: 1 }}>
            {expensesByCategory(wholeMonth).map((entry) => (
              <Chip
                key={entry.category}
                size="small"
                color={category === entry.category ? 'primary' : 'default'}
                variant={category === entry.category ? 'filled' : 'outlined'}
                aria-pressed={category === entry.category}
                label={`${t(EXPENSE_CATEGORIES[entry.category] || entry.category)} ${formatCurrency(entry.total)}`}
                onClick={() => setCategory(category === entry.category ? '' : entry.category)}
              />
            ))}
          </Stack>
          <TextField
            type="search"
            value={query}
            onChange={setQuery}
            placeholder={t('Search notes, category or amount')}
            slotProps={{ htmlInput: { 'aria-label': t('Search expenses') } }}
            sx={{ mb: 1.5, bgcolor: 'background.paper' }}
          />
          <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
            <Button fullWidth variant="outlined" startIcon={<DownloadIcon />} onClick={() => exportAs('pdf')} disabled={busy}>PDF</Button>
            <Button fullWidth variant="outlined" startIcon={<TableViewIcon />} onClick={() => exportAs('csv')} disabled={busy}>{t('Excel (CSV)')}</Button>
          </Stack>
        </>
      )}
      <ToggleButtonGroup exclusive fullWidth size="small" value={view} onChange={(_event, next) => next && setView(next)} aria-label={t('Show expenses as')} sx={{ mb: 1.5 }}>
        <ToggleButton value="calendar"><CalendarMonthIcon fontSize="small" sx={{ mr: 0.5 }} />{t('Calendar')}</ToggleButton>
        <ToggleButton value="table"><ListIcon fontSize="small" sx={{ mr: 0.5 }} />{t('Table')}</ToggleButton>
        <ToggleButton value="pdf"><PdfIcon fontSize="small" sx={{ mr: 0.5 }} />{t('PDF preview')}</ToggleButton>
      </ToggleButtonGroup>

      {view === 'calendar' && (
        <>
          <Card sx={{ mb: 1.5 }}>
            <CardContent sx={{ p: 1.25, '&:last-child': { pb: 1.25 } }}>
              <MonthCalendar
                month={month}
                renderTile={(date) => {
                  const total = dayOf.get(date)?.total || 0;
                  return (
                    <DayTile
                      key={date}
                      date={date}
                      today={today}
                      tone={expenseDayTone(total)}
                      value={total ? compactAmount(total) : ''}
                      ariaLabel={`${dayLabel(date, language)}: ${total ? formatCurrency(total) : t('No expenses')}`}
                      onClick={() => tapDay(date)}
                    />
                  );
                }}
              />
            </CardContent>
          </Card>
          <Typography variant="caption" color="text.secondary" component="p" sx={{ mb: 1 }}>
            {t('Tap a day to add or see its expenses. Green = up to {amber}, amber = over {amber}, red = over {red} in a day.', { amber: formatCurrency(EXPENSE_AMBER_ABOVE), red: formatCurrency(EXPENSE_RED_ABOVE) })}
          </Typography>
        </>
      )}
      {view === 'table' && <ExpenseDays days={days} projects={projects} showProject={!projectId} onOpen={open} onDelete={deleteOne} onDeleteDay={deleteDay} canDelete={mayChange} />}
      {view === 'pdf' && (
        days.length ? (
          <Box ref={sheetRef} sx={{ border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden', bgcolor: '#fff', mb: 1 }}>
            <FitToWidth contentWidth={PORTRAIT_WIDTH_PX}>
              <ExpenseSheetDocument days={days} projects={projects} projectLabel={projectLabel} showProject={!projectId} month={month} firm={data.firm} t={docT} language={language} />
            </FitToWidth>
          </Box>
        ) : <ExpenseDays days={days} projects={projects} />
      )}
      <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
        {cloud.can('editProject')
          ? t('Tap an expense to edit or delete it.')
          : t('You can add expenses and change your own for 2 days. Older ones need the admin.')}
      </Typography>

      {/* Off-screen sheet used for Hindi PDFs (the preview itself is used when it is showing). */}
      {view !== 'pdf' && (
        <Box ref={sheetRef} sx={{ display: 'none' }} aria-hidden>
          <ExpenseSheetDocument days={days} projects={projects} projectLabel={projectLabel} showProject={!projectId} month={month} firm={data.firm} t={docT} language={language} />
        </Box>
      )}

      <ExpenseDaySheet day={dayOf.get(openDay) || null} projects={projects} showProject={!projectId} onOpen={open} onAdd={startNew} onClose={() => setOpenDay('')} onDelete={deleteOne} onDeleteDay={deleteDay} canDelete={mayChange} />

      <ExpenseDialog
        open={Boolean(editing)}
        expense={editing === 'new' ? null : editing}
        projects={projects}
        projectId={projectId}
        defaultDate={newDate}
        dateError={dateError}
        onSave={save}
        onDelete={editing && editing !== 'new' ? remove : undefined}
        onClose={() => setEditing(null)}
      />
    </section>
  );
}

import { useMemo, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import ChevronLeftIcon from '@mui/icons-material/ChevronLeft';
import ChevronRightIcon from '@mui/icons-material/ChevronRight';
import DownloadIcon from '@mui/icons-material/Download';
import TableViewIcon from '@mui/icons-material/TableChartOutlined';
import { EmptyState, PageHeading, SelectField, StatCard, useConfirm, useNotify } from '../../components/ui';
import { useBilling } from '../../state/BillingContext.jsx';
import { useUndoable } from '../../hooks/useUndoable.js';
import { VIEWS } from '../../config/app.js';
import { EXPENSE_CATEGORIES, expensesByCategory, expensesByDay, totalAmount } from '../../domain/projects.js';
import { localToday, monthLabel, monthOf, shiftMonth } from '../../domain/labour.js';
import { formatCurrency } from '../../domain/formatters.js';
import { isShareCancelled } from '../../services/files.js';
import { getLanguage, makeTranslator, tr as t } from '../../i18n/translate.js';
import { useCloud } from '../account/CloudProvider.jsx';
import ExpenseDays from './ExpenseDays.jsx';
import ExpenseDialog from './ExpenseDialog.jsx';
import ExpenseSheetDocument from './ExpenseSheetDocument.jsx';

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
export default function ExpensesPage({ onNavigate }) {
  const { data, actions } = useBilling();
  const cloud = useCloud();
  const notify = useNotify();
  const confirm = useConfirm();
  const undoable = useUndoable();
  const sheetRef = useRef(null);
  const [projectId, setProjectId] = useState('');
  const [month, setMonth] = useState(() => monthOf(localToday()));
  const [editing, setEditing] = useState(null); // an expense, 'new' or null
  const [busy, setBusy] = useState(false);
  const { projects, expenses } = data;
  const language = getLanguage();
  const docT = makeTranslator(language);

  const days = useMemo(() => expensesByDay(expenses, { projectId, month }), [expenses, projectId, month]);
  const monthItems = days.flatMap((day) => day.items);
  const today = localToday();
  const todayTotal = totalAmount(monthItems.filter((expense) => expense.date === today));
  const projectLabel = projectId ? projects.find((project) => project.id === projectId)?.name || '' : t('All projects');
  const dateError = (date) => (cloud.canEditDate(date) ? '' : t('Only the admin can use a date older than 2 days.'));
  const mayChange = (expense) => cloud.canEditDate(expense.date);

  function open(expense) {
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
        action={<Button variant="contained" startIcon={<AddIcon />} onClick={() => setEditing('new')}>{t('Add expense')}</Button>}
      />
      <SelectField
        label={t('Project')}
        value={projectId}
        placeholder={t('All projects')}
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
          <Typography variant="caption" color="text.secondary" component="p" sx={{ mb: 1 }}>
            {expensesByCategory(monthItems).map((entry) => `${t(EXPENSE_CATEGORIES[entry.category] || entry.category)} ${formatCurrency(entry.total)}`).join(' · ')}
          </Typography>
          <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
            <Button fullWidth variant="outlined" startIcon={<DownloadIcon />} onClick={() => exportAs('pdf')} disabled={busy}>PDF</Button>
            <Button fullWidth variant="outlined" startIcon={<TableViewIcon />} onClick={() => exportAs('csv')} disabled={busy}>{t('Excel (CSV)')}</Button>
          </Stack>
        </>
      )}
      <ExpenseDays days={days} projects={projects} showProject={!projectId} onOpen={open} />
      <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>
        {cloud.can('editProject')
          ? t('Tap an expense to edit or delete it.')
          : t('You can add expenses and change your own for 2 days. Older ones need the admin.')}
      </Typography>

      {/* Off-screen sheet used for Hindi PDFs. */}
      <Box ref={sheetRef} sx={{ display: 'none' }} aria-hidden>
        <ExpenseSheetDocument days={days} projects={projects} projectLabel={projectLabel} showProject={!projectId} month={month} firm={data.firm} t={docT} language={language} />
      </Box>

      <ExpenseDialog
        open={Boolean(editing)}
        expense={editing === 'new' ? null : editing}
        projects={projects}
        projectId={projectId}
        dateError={dateError}
        onSave={save}
        onDelete={editing && editing !== 'new' ? remove : undefined}
        onClose={() => setEditing(null)}
      />
    </section>
  );
}

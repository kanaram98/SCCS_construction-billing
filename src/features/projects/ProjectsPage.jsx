import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import EditIcon from '@mui/icons-material/EditOutlined';
import { EmptyState, PageHeading, StatCard, useConfirm, useNotify } from '../../components/ui';
import { useBilling } from '../../state/BillingContext.jsx';
import { useUndoable } from '../../hooks/useUndoable.js';
import { PAYMENT_MODES } from '../../domain/payments.js';
import { PROJECT_STATUSES, EXPENSE_CATEGORIES, expensesByDay } from '../../domain/projects.js';
import { projectSummary } from '../../domain/project-report.js';
import { billLabel, isEstimate } from '../../domain/bill-kinds.js';
import { getBillTotals } from '../../domain/calculations.js';
import { VIEWS } from '../../config/app.js';
import { formatCurrency } from '../../domain/formatters.js';
import { tr as t, trn } from '../../i18n/translate.js';
import Alert from '@mui/material/Alert';
import { useCloud } from '../account/CloudProvider.jsx';
import ExpenseDays from '../expenses/ExpenseDays.jsx';
import ExpenseDialog from '../expenses/ExpenseDialog.jsx';
import AdvanceDialog from './AdvanceDialog.jsx';
import ProjectDialog from './ProjectDialog.jsx';

function ProjectCard({ project, summary, onOpen }) {
  return (
    <Card sx={{ mb: 1.5 }}>
      <CardActionArea onClick={onOpen} sx={{ p: 1.75 }} aria-label={t('Open project {name}', { name: project.name })}>
        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', gap: 1 }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle1" noWrap>{project.name}</Typography>
            <Typography variant="caption" color="text.secondary" noWrap component="div">{project.client || t('No client')}</Typography>
          </Box>
          <Chip size="small" color={project.status === 'running' ? 'success' : 'default'} variant="outlined" label={t(PROJECT_STATUSES[project.status] || project.status)} />
        </Stack>
        <Grid container spacing={1} sx={{ mt: 0.5 }}>
          <Grid size={4}><Typography variant="caption" color="text.secondary" component="div">{t('Billed')}</Typography><Typography variant="body2" sx={{ fontWeight: 600 }}>{formatCurrency(summary.billed)}</Typography></Grid>
          <Grid size={4}><Typography variant="caption" color="text.secondary" component="div">{t('Received')}</Typography><Typography variant="body2" sx={{ fontWeight: 600 }}>{formatCurrency(summary.received)}</Typography></Grid>
          <Grid size={4}><Typography variant="caption" color="text.secondary" component="div">{t('Expenses')}</Typography><Typography variant="body2" sx={{ fontWeight: 600 }}>{formatCurrency(summary.expenses)}</Typography></Grid>
        </Grid>
      </CardActionArea>
    </Card>
  );
}

/** One project: money summary, advances from the client, expenses. */
function ProjectDetail({ project, onBack, onNavigate }) {
  const { data, actions } = useBilling();
  const cloud = useCloud();
  const notify = useNotify();
  const confirm = useConfirm();
  const undoable = useUndoable();
  const [tab, setTab] = useState('advances');
  const [advanceDialog, setAdvanceDialog] = useState(null);
  const [expenseDialog, setExpenseDialog] = useState(null);
  const [projectDialog, setProjectDialog] = useState(false);
  const summary = useMemo(() => projectSummary(project, data), [project, data]);
  const advances = data.advances.filter((advance) => advance.projectId === project.id).sort((a, b) => b.date.localeCompare(a.date));
  const days = useMemo(() => expensesByDay(data.expenses, { projectId: project.id }), [data.expenses, project.id]);
  const projectBills = data.bills.filter((bill) => bill.projectId === project.id);
  const canEditAdvance = cloud.can('editAdvance');
  const canEditProject = cloud.can('editProject');

  async function removeAdvance(advance) {
    const ok = await confirm({ title: t('Delete this advance?'), message: `${formatCurrency(advance.amount)} · ${advance.date}`, confirmLabel: t('Delete'), danger: true });
    if (!ok) return;
    setAdvanceDialog(null);
    undoable(t('Advance deleted.'), () => actions.advances.remove(advance.id));
  }

  return (
    <section>
      <Stack direction="row" sx={{ alignItems: 'center', mb: 1 }}>
        <IconButton aria-label={t('Back to projects')} onClick={onBack} edge="start"><ArrowBackIcon /></IconButton>
        <Box sx={{ minWidth: 0, flex: 1 }}>
          <Typography variant="h5" component="h1" noWrap>{project.name}</Typography>
          <Typography variant="body2" color="text.secondary" noWrap>{[project.client, t(PROJECT_STATUSES[project.status])].filter(Boolean).join(' · ')}</Typography>
        </Box>
        {canEditProject && <IconButton aria-label={t('Edit project')} onClick={() => setProjectDialog(true)}><EditIcon /></IconButton>}
      </Stack>

      <Grid container spacing={1.5} sx={{ mb: 2 }}>
        <Grid size={6}><StatCard label={t('Billed')} value={formatCurrency(summary.billed)} /></Grid>
        <Grid size={6}><StatCard label={t('Received (bills + advances)')} value={formatCurrency(summary.received)} /></Grid>
        <Grid size={6}><StatCard label={summary.receivable < 0 ? t('Client paid ahead') : t('Client still owes')} value={formatCurrency(Math.abs(summary.receivable))} /></Grid>
        <Grid size={6}><StatCard label={t('Site expenses')} value={formatCurrency(summary.expenses)} /></Grid>
      </Grid>
      {summary.agreed > 0 && (
        <Typography variant="caption" color="text.secondary" component="p" sx={{ mb: 1.5 }}>
          {t('Agreed amount {amount}', { amount: formatCurrency(summary.agreed) })}
        </Typography>
      )}

      <Tabs value={tab} onChange={(_event, value) => setTab(value)} variant="fullWidth" sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Tab value="advances" label={t('Advances')} />
        <Tab value="expenses" label={t('Expenses')} />
        <Tab value="bills" label={t('Bills')} />
      </Tabs>

      {tab === 'bills' && (
        <>
          {!projectBills.length ? (
            <EmptyState title={t('No bills yet')} description={t('Create a bill from the Bills tab and choose this project, or link a bill in Bill details.')} compact />
          ) : (
            <Card>
              {projectBills.map((bill, index) => {
                const totals = getBillTotals(bill, data.rates);
                return (
                  <Box
                    key={bill.id}
                    component="button"
                    type="button"
                    onClick={() => { actions.bills.open(bill.id); onNavigate(VIEWS.entry); }}
                    aria-label={t('Open {name}', { name: billLabel(bill, t) })}
                    sx={{ all: 'unset', boxSizing: 'border-box', display: 'flex', width: '100%', justifyContent: 'space-between', gap: 1, px: 1.75, py: 1.25, borderTop: index ? 1 : 0, borderColor: 'divider', cursor: 'pointer' }}
                  >
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{billLabel(bill, t)}</Typography>
                      <Typography variant="caption" color="text.secondary">{bill.date}{isEstimate(bill) ? ` · ${t('Estimate')}` : ''}</Typography>
                    </Box>
                    <Box sx={{ textAlign: 'right' }}>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>{formatCurrency(totals.total)}</Typography>
                      {!isEstimate(bill) && <Typography variant="caption" color="text.secondary">{t('Due {amount}', { amount: formatCurrency(totals.balance) })}</Typography>}
                    </Box>
                  </Box>
                );
              })}
            </Card>
          )}
        </>
      )}

      {tab === 'advances' && (
        <>
          <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="body2" color="text.secondary">{t('Received from the client: {amount}', { amount: formatCurrency(summary.advances) })}</Typography>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setAdvanceDialog('new')}>{t('Add advance')}</Button>
          </Stack>
          {!advances.length ? (
            <EmptyState title={t('No advances yet')} description={t('Record money the client gave you for this project, even before any bill is made.')} compact />
          ) : (
            <Card>
              {advances.map((advance, index) => (
                <Box
                  key={advance.id}
                  component={canEditAdvance ? 'button' : 'div'}
                  type={canEditAdvance ? 'button' : undefined}
                  onClick={canEditAdvance ? () => setAdvanceDialog(advance) : undefined}
                  aria-label={canEditAdvance ? t('Open advance {amount}', { amount: formatCurrency(advance.amount) }) : undefined}
                  sx={{ all: 'unset', boxSizing: 'border-box', display: 'flex', width: '100%', justifyContent: 'space-between', gap: 1, px: 1.75, py: 1.25, borderTop: index ? 1 : 0, borderColor: 'divider', cursor: canEditAdvance ? 'pointer' : 'default' }}
                >
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" sx={{ fontWeight: 600 }}>{formatCurrency(advance.amount)} · {t(PAYMENT_MODES[advance.mode] || 'Cash')}</Typography>
                    <Typography variant="caption" color="text.secondary" component="div" sx={{ wordBreak: 'break-word' }}>{[advance.date, advance.note].filter(Boolean).join(' · ')}</Typography>
                  </Box>
                </Box>
              ))}
            </Card>
          )}
          {!canEditAdvance && <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1 }}>{t('You can add advances. Only the admin can change or delete them.')}</Typography>}
        </>
      )}

      {tab === 'expenses' && (
        <>
          <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 1 }}>
            <Typography variant="body2" color="text.secondary">
              {summary.expensesByCategory.map((entry) => `${t(EXPENSE_CATEGORIES[entry.category] || entry.category)} ${formatCurrency(entry.total)}`).join(' · ') || t('No expenses')}
            </Typography>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setExpenseDialog('new')}>{t('Add expense')}</Button>
          </Stack>
          <ExpenseDays days={days} projects={data.projects} onOpen={(expense) => (cloud.canEditDate(expense.date) ? setExpenseDialog(expense) : notify(t('This expense is more than 2 days old. Only the admin can change it.'), 'info'))} />
        </>
      )}

      <AdvanceDialog
        open={Boolean(advanceDialog)}
        advance={advanceDialog === 'new' ? null : advanceDialog}
        projects={data.projects}
        projectId={project.id}
        onDelete={advanceDialog && advanceDialog !== 'new' && canEditAdvance ? () => removeAdvance(advanceDialog) : undefined}
        onSave={(values) => {
          if (advanceDialog === 'new') { actions.advances.add(values); notify(t('Advance recorded.'), 'success'); } else actions.advances.update(advanceDialog.id, values);
          setAdvanceDialog(null);
        }}
        onClose={() => setAdvanceDialog(null)}
      />
      <ExpenseDialog
        open={Boolean(expenseDialog)}
        expense={expenseDialog === 'new' ? null : expenseDialog}
        projects={data.projects}
        projectId={project.id}
        dateError={(date) => (cloud.canEditDate(date) ? '' : t('Only the admin can use a date older than 2 days.'))}
        onSave={(values) => {
          if (expenseDialog === 'new') { actions.expenses.add(values); notify(t('Expense added.'), 'success'); } else actions.expenses.update(expenseDialog.id, values);
          setExpenseDialog(null);
        }}
        onDelete={expenseDialog && expenseDialog !== 'new' ? () => { const expense = expenseDialog; setExpenseDialog(null); undoable(t('Expense deleted.'), () => actions.expenses.remove(expense.id)); } : undefined}
        onClose={() => setExpenseDialog(null)}
      />
      <ProjectDialog open={projectDialog} project={project} onSave={(values) => { actions.projects.update(project.id, values); setProjectDialog(false); }} onClose={() => setProjectDialog(false)} />
    </section>
  );
}

/** Projects (sites): the list, and one project's advances and expenses. */
export default function ProjectsPage({ onNavigate }) {
  const { data, actions } = useBilling();
  const confirm = useConfirm();
  const notify = useNotify();
  const [selectedId, setSelectedId] = useState('');
  const [adding, setAdding] = useState(false);
  const selected = data.projects.find((project) => project.id === selectedId);

  if (selected) return <ProjectDetail project={selected} onBack={() => setSelectedId('')} onNavigate={onNavigate} />;

  const unlinked = data.bills.filter((bill) => !bill.projectId && !bill.isSample && bill.projectName?.trim()).length;
  async function linkBills() {
    const ok = await confirm({
      title: t('Link my existing bills to projects?'),
      message: t('A project is made for each project name and client on your bills, and the bills are linked to it. You can change this later.'),
      confirmLabel: t('Link bills')
    });
    if (!ok) return;
    const count = actions.projects.linkBills();
    notify(trn(count, '{count} bill linked.', '{count} bills linked.'), 'success');
  }

  return (
    <section>
      <PageHeading
        title={t('Projects')}
        description={t('Each site you work on: what you billed, what the client paid, what you spent.')}
        action={<Button variant="contained" startIcon={<AddIcon />} onClick={() => setAdding(true)}>{t('Add project')}</Button>}
      />
      {unlinked > 0 && (
        <Alert severity="info" sx={{ mb: 2 }} action={<Button color="inherit" size="small" onClick={linkBills}>{t('Link bills')}</Button>}>
          {trn(unlinked, '{count} bill is not linked to a project.', '{count} bills are not linked to a project.')}
        </Alert>
      )}
      {!data.projects.length ? (
        <EmptyState title={t('No projects yet')} description={t('Add a project for each site. Then record advances and expenses under it, and link bills to it.')} />
      ) : (
        data.projects.map((project) => <ProjectCard key={project.id} project={project} summary={projectSummary(project, data)} onOpen={() => setSelectedId(project.id)} />)
      )}
      <ProjectDialog
        open={adding}
        onSave={(values) => { const project = actions.projects.add(values); setAdding(false); setSelectedId(project.id); notify(t('Project added.'), 'success'); }}
        onClose={() => setAdding(false)}
      />
    </section>
  );
}

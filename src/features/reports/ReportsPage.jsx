import { useMemo, useRef, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import DownloadIcon from '@mui/icons-material/Download';
import TableViewIcon from '@mui/icons-material/TableChartOutlined';
import { EmptyState, Notice, PageHeading, SelectField, StatCard, TextField, useNotify } from '../../components/ui';
import { useBilling } from '../../state/BillingContext.jsx';
import { VIEWS } from '../../config/app.js';
import { localToday } from '../../domain/labour.js';
import { formatCurrency } from '../../domain/formatters.js';
import { PERIOD_LABELS, periodRange, projectStatement } from '../../domain/project-statement.js';
import { DEFAULT_REPORT_SCOPE, REPORT_SCOPES } from '../../domain/report-scope.js';
import { statementTables } from '../../documents/statement-tables.js';
import { isShareCancelled } from '../../services/files.js';
import { getLanguage, makeTranslator, tr as t } from '../../i18n/translate.js';
import FitToWidth from '../print/preview/FitToWidth.jsx';
import ProjectStatementDocument from './ProjectStatementDocument.jsx';

const PORTRAIT_WIDTH_PX = 794; // A4 portrait at 96 dpi

/** Reports: the full statement of one project (bills, advances, expenses, labour, earning, cash). */
export default function ReportsPage({ onNavigate }) {
  const { data } = useBilling();
  const notify = useNotify();
  const sheetRef = useRef(null);
  const [projectId, setProjectId] = useState(() => data.projects.find((project) => project.status === 'running')?.id || data.projects[0]?.id || '');
  const [periodKind, setPeriodKind] = useState('all');
  /** Which bills the figures count: submitted only, plus ready (pending), or everything including drafts. */
  const [scope, setScope] = useState(DEFAULT_REPORT_SCOPE);
  const [custom, setCustom] = useState({ from: '', to: '' });
  const [view, setView] = useState('summary'); // summary | pdf
  const [busy, setBusy] = useState(false);
  const language = getLanguage();
  const docT = makeTranslator(language);
  const project = data.projects.find((entry) => entry.id === projectId) || null;
  const period = useMemo(() => periodRange(periodKind, { today: localToday(), ...custom }), [periodKind, custom]);
  const statement = useMemo(() => (project ? projectStatement(project, data, period, { scope }) : null), [project, data, period, scope]);

  async function exportAs(kind) {
    setBusy(true);
    try {
      const { exportStatementPdf, exportStatementCsv } = await import('../../documents/statement-export.js');
      if (kind === 'pdf') await exportStatementPdf({ statement, firm: data.firm, language, rendered: sheetRef.current?.querySelector('.statement-document') });
      else await exportStatementCsv({ statement });
      notify(t('File ready to save or share.'));
    } catch (error) {
      if (!isShareCancelled(error)) notify(t('Export failed: {reason}', { reason: error.message || t('Unknown error') }), 'error');
    } finally {
      setBusy(false);
    }
  }

  if (!data.projects.length) {
    return (
      <section>
        <PageHeading title={t('Reports')} description={t('The full picture of a project: billing, money received, costs and earning.')} />
        <EmptyState
          title={t('Add a project first')}
          description={t('A report is made for a project. Add a project, then link its bills, advances, expenses and labour.')}
          action={<Button variant="contained" onClick={() => onNavigate(VIEWS.projects)}>{t('Go to Projects')}</Button>}
        />
      </section>
    );
  }

  return (
    <section>
      <PageHeading title={t('Reports')} description={t('The full picture of a project: billing, money received, costs and earning.')} />
      <Grid container spacing={1.5} sx={{ mb: 1.5 }}>
        <Grid size={{ xs: 12, sm: 6 }}>
          <SelectField label={t('Project')} value={projectId} options={data.projects.map((entry) => ({ value: entry.id, label: `${entry.name} · ${entry.client}` }))} onChange={setProjectId} />
        </Grid>
        <Grid size={{ xs: 12, sm: 6 }}>
          <SelectField label={t('Period')} value={periodKind} options={Object.entries(PERIOD_LABELS).map(([value, label]) => ({ value, label: t(label) }))} onChange={setPeriodKind} />
        </Grid>
        <Grid size={12}>
          <SelectField label={t('Bills included')} value={scope} options={Object.entries(REPORT_SCOPES).map(([value, label]) => ({ value, label: t(label) }))} onChange={setScope} helperText={scope === 'submitted' ? t('Only closed bills. Ready and draft bills are shown below but not counted.') : scope === 'ready' ? t('Includes bills waiting for payment. Drafts are shown below but not counted.') : t('Counts every bill, drafts included.')} />
        </Grid>
        {periodKind === 'custom' && (
          <>
            <Grid size={6}><TextField label={t('From date')} type="date" value={custom.from} max={custom.to || undefined} onChange={(from) => setCustom((current) => ({ ...current, from }))} /></Grid>
            <Grid size={6}><TextField label={t('To date')} type="date" value={custom.to} min={custom.from || undefined} onChange={(to) => setCustom((current) => ({ ...current, to }))} /></Grid>
          </>
        )}
      </Grid>

      {statement && (
        <>
          <Grid container spacing={1.5} sx={{ mb: 1.5 }}>
            <Grid size={6}><StatCard label={t('Billed')} value={formatCurrency(statement.billed)} /></Grid>
            <Grid size={6}><StatCard label={t('Total received')} value={formatCurrency(statement.received)} /></Grid>
            <Grid size={6}><StatCard label={statement.receivable < 0 ? t('Client paid ahead') : t('Client still owes')} value={formatCurrency(Math.abs(statement.receivable))} /></Grid>
            <Grid size={6}><StatCard label={t('Total costs')} value={formatCurrency(statement.costs)} /></Grid>
            <Grid size={6}><StatCard label={t('Earning')} value={formatCurrency(statement.earning)} /></Grid>
            <Grid size={6}><StatCard label={t('Cash in hand')} value={formatCurrency(statement.cash)} /></Grid>
          </Grid>
          {statement.unassignedLabour.cost > 0 && (
            <Notice tone="info">{t('Labour of {amount} was marked with no site, so it is not in this report. Choose the site in Labour › Attendance.', { amount: formatCurrency(statement.unassignedLabour.cost) })}</Notice>
          )}

          <Stack direction="row" spacing={1} sx={{ mb: 1.5 }}>
            <Button fullWidth variant="outlined" startIcon={<DownloadIcon />} onClick={() => exportAs('pdf')} disabled={busy}>PDF</Button>
            <Button fullWidth variant="outlined" startIcon={<TableViewIcon />} onClick={() => exportAs('csv')} disabled={busy}>{t('Excel (CSV)')}</Button>
          </Stack>
          <ToggleButtonGroup exclusive fullWidth size="small" value={view} onChange={(_event, next) => next && setView(next)} aria-label={t('Show report as')} sx={{ mb: 1.5 }}>
            <ToggleButton value="summary">{t('Details')}</ToggleButton>
            <ToggleButton value="pdf">{t('PDF preview')}</ToggleButton>
          </ToggleButtonGroup>

          {view === 'summary' ? (
            statementTables(statement, t, formatCurrency).map((table) => (
              <Card key={table.title} sx={{ mb: 1.5 }}>
                <Typography variant="subtitle2" sx={{ px: 1.75, pt: 1.25 }}>{table.title}</Typography>
                <Box sx={{ overflowX: 'auto' }}>
                  <Table size="small">
                    <TableHead>
                      <TableRow>{table.head.map((cell, index) => <TableCell key={index} align={index >= table.numericFrom ? 'right' : 'left'}>{cell}</TableCell>)}</TableRow>
                    </TableHead>
                    <TableBody>
                      {table.rows.map((entry, index) => (
                        <TableRow key={index}>
                          {entry.cells.map((cell, cellIndex) => (
                            <TableCell key={cellIndex} align={cellIndex >= table.numericFrom ? 'right' : 'left'} sx={{ fontWeight: entry.bold ? 700 : 400, whiteSpace: cellIndex >= table.numericFrom ? 'nowrap' : 'normal' }}>{cell}</TableCell>
                          ))}
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </Box>
              </Card>
            ))
          ) : (
            <Box ref={sheetRef} sx={{ border: 1, borderColor: 'divider', borderRadius: 1, overflow: 'hidden', bgcolor: '#fff', mb: 1 }}>
              <FitToWidth contentWidth={PORTRAIT_WIDTH_PX}>
                <ProjectStatementDocument statement={statement} firm={data.firm} t={docT} />
              </FitToWidth>
            </Box>
          )}

          {/* Off-screen copy used for Hindi PDFs when the preview is not showing. */}
          {view !== 'pdf' && (
            <Box ref={sheetRef} sx={{ display: 'none' }} aria-hidden>
              <ProjectStatementDocument statement={statement} firm={data.firm} t={docT} />
            </Box>
          )}
        </>
      )}
    </section>
  );
}

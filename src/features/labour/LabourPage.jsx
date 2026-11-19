import { useState } from 'react';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Button from '@mui/material/Button';
import HistoryIcon from '@mui/icons-material/History';
import { PageHeading, SelectField } from '../../components/ui';
import { useActiveProject } from '../../hooks/useActiveProject.js';
import { LabourSiteProvider } from './useLabour.js';
import { useBilling } from '../../state/BillingContext.jsx';
import { localToday, monthOf } from '../../domain/labour.js';
import { tr as t } from '../../i18n/translate.js';
import AttendanceTab from './AttendanceTab.jsx';
import ReportTab from './ReportTab.jsx';
import WorkersTab from './WorkersTab.jsx';
import SheetTab from './SheetTab.jsx';
import HistoryDialog from './HistoryDialog.jsx';

/** Labour: daily attendance (A / 0.5P / 1P / 1.5P / 2P), workers and monthly wages. */
export default function LabourPage({ focus = {} }) {
  const { data } = useBilling();
  const [tab, setTab] = useState(() => (focus.workerId || !data.labour.workers.length ? 'workers' : 'attendance'));
  const [month, setMonth] = useState(() => monthOf(localToday()));
  const [history, setHistory] = useState(null); // null, 'all' or a worker id
  const [siteId, setSite] = useActiveProject(data.projects, focus.projectId);

  return (
    <section className="print-page">
      <div className="no-print"><PageHeading
        title={t('Labour')}
        description={t('Daily attendance, advances and monthly wages.')}
        action={<Button size="small" startIcon={<HistoryIcon />} onClick={() => setHistory('all')}>{t('History')}</Button>}
      /></div>
      {data.projects.length > 0 && (
        <SelectField
          label={t('Project / site')}
          value={siteId}
          options={data.projects.filter((project) => project.status === 'running' || project.id === siteId).map((project) => ({ value: project.id, label: project.name }))}
          helperText={t('Every tab below shows this project only. Switch project to work on another.')}
          onChange={setSite}
          className="no-print"
          sx={{ mb: 1.5 }}
        />
      )}
      <Tabs value={tab} onChange={(_event, value) => setTab(value)} variant="fullWidth" className="no-print" sx={{ mb: 2, borderBottom: 1, borderColor: 'divider', '& .MuiTab-root': { minWidth: 0, px: 0.5 } }}>
        <Tab value="attendance" label={t('Attendance')} />
        <Tab value="report" label={t('Report')} />
        <Tab value="sheet" label={t('Sheet / PDF')} />
        <Tab value="workers" label={t('Workers')} />
      </Tabs>
      <LabourSiteProvider value={siteId}>
      {tab === 'attendance' && <AttendanceTab month={month} onMonthChange={setMonth} onAddWorkers={() => setTab('workers')} />}
      {tab === 'report' && <ReportTab month={month} onMonthChange={setMonth} onOpenSheet={() => setTab('sheet')} onOpenHistory={setHistory} />}
      {tab === 'sheet' && <SheetTab month={month} onMonthChange={setMonth} />}
      {tab === 'workers' && <WorkersTab />}
      </LabourSiteProvider>
      <HistoryDialog open={Boolean(history)} workerId={history === 'all' ? '' : history} onClose={() => setHistory(null)} />
    </section>
  );
}

import { useState } from 'react';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import { PageHeading } from '../../components/ui';
import { useBilling } from '../../state/BillingContext.jsx';
import { localToday, monthOf } from '../../domain/labour.js';
import { tr as t } from '../../i18n/translate.js';
import AttendanceTab from './AttendanceTab.jsx';
import ReportTab from './ReportTab.jsx';
import WorkersTab from './WorkersTab.jsx';
import SheetTab from './SheetTab.jsx';

/** Labour: daily attendance (A / 0.5P / 1P / 1.5P / 2P), workers and monthly wages. */
export default function LabourPage() {
  const { data } = useBilling();
  const [tab, setTab] = useState(() => (data.labour.workers.length ? 'attendance' : 'workers'));
  const [month, setMonth] = useState(() => monthOf(localToday()));

  return (
    <section className="print-page">
      <div className="no-print"><PageHeading title={t('Labour')} description={t('Daily attendance, advances and monthly wages.')} /></div>
      <Tabs value={tab} onChange={(_event, value) => setTab(value)} variant="fullWidth" className="no-print" sx={{ mb: 2, borderBottom: 1, borderColor: 'divider', '& .MuiTab-root': { minWidth: 0, px: 0.5 } }}>
        <Tab value="attendance" label={t('Attendance')} />
        <Tab value="report" label={t('Report')} />
        <Tab value="sheet" label={t('Sheet / PDF')} />
        <Tab value="workers" label={t('Workers')} />
      </Tabs>
      {tab === 'attendance' && <AttendanceTab month={month} onMonthChange={setMonth} onAddWorkers={() => setTab('workers')} />}
      {tab === 'report' && <ReportTab month={month} onMonthChange={setMonth} onOpenSheet={() => setTab('sheet')} />}
      {tab === 'sheet' && <SheetTab month={month} onMonthChange={setMonth} />}
      {tab === 'workers' && <WorkersTab />}
    </section>
  );
}

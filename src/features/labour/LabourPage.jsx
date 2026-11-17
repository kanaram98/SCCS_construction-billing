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

/** Labour: daily attendance (A / 0.5P / 1P / 1.5P / 2P), workers and monthly wages. */
export default function LabourPage() {
  const { data } = useBilling();
  const [tab, setTab] = useState(() => (data.labour.workers.length ? 'attendance' : 'workers'));
  const [date, setDate] = useState(localToday);
  const [month, setMonth] = useState(() => monthOf(localToday()));

  return (
    <section>
      <PageHeading title={t('Labour')} description={t('Daily attendance, advances and monthly wages.')} />
      <Tabs value={tab} onChange={(_event, value) => setTab(value)} variant="fullWidth" sx={{ mb: 2, borderBottom: 1, borderColor: 'divider' }}>
        <Tab value="attendance" label={t('Attendance')} />
        <Tab value="report" label={t('Monthly report')} />
        <Tab value="workers" label={t('Workers')} />
      </Tabs>
      {tab === 'attendance' && <AttendanceTab date={date} onDateChange={setDate} onAddWorkers={() => setTab('workers')} />}
      {tab === 'report' && <ReportTab month={month} onMonthChange={setMonth} />}
      {tab === 'workers' && <WorkersTab />}
    </section>
  );
}

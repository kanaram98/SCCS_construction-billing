import { useMemo, useState } from 'react';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import AddIcon from '@mui/icons-material/Add';
import HistoryIcon from '@mui/icons-material/History';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import { useBilling } from '../../state/BillingContext.jsx';
import { summarizeBill } from '../../domain/calculations.js';
import { billKind, billLabel, billsOfKind, isEstimate } from '../../domain/bill-kinds.js';
import { billStatus, isCancelled } from '../../domain/bill-guard.js';
import { EmptyState, PageHeading } from '../../components/ui';
import { VIEWS } from '../../config/app.js';
import { useBillFilters } from './useBillFilters.js';
import { useBillOperations } from './useBillOperations.jsx';
import BillFilters from './BillFilters.jsx';
import BillCard from './BillCard.jsx';
import HistoryDialog from '../history/HistoryDialog.jsx';
import NewBillDialog from './NewBillDialog.jsx';
import { tr as t } from '../../i18n/translate.js';

/** The bills being worked on (draft and ready), the submitted ones, and estimates; every action is in a bill's ⋮ menu. */
export default function BillsPage({ onNavigate, focus = {} }) {
  const { data, bill: activeBill, actions } = useBilling();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [creating, setCreating] = useState(Boolean(focus.newBill)); // opened from Home or the welcome with "New bill"
  const ops = useBillOperations({ onNavigate });
  const { rates } = data;
  /** 'bill' (draft and ready), 'submitted' (closed or cancelled) or 'estimate': which list is shown. */
  const [kind, setKind] = useState(() => focus.newBill || billKind(activeBill));
  const isEstimates = kind === 'estimate';
  /** What "New" creates: an estimate on the Estimates tab, otherwise a bill. */
  const createKind = isEstimates ? 'estimate' : 'bill';
  const isClosed = (bill) => !isEstimate(bill) && (billStatus(bill) === 'submitted' || isCancelled(bill));
  const bills = useMemo(() => {
    if (kind === 'estimate') return billsOfKind(data.bills, 'estimate');
    const real = billsOfKind(data.bills, 'bill');
    return kind === 'submitted' ? real.filter(isClosed) : real.filter((bill) => !isClosed(bill));
  }, [data.bills, kind]);
  const estimateCount = useMemo(() => billsOfKind(data.bills, 'estimate').length, [data.bills]);
  const submittedCount = useMemo(() => billsOfKind(data.bills, 'bill').filter(isClosed).length, [data.bills]);
  const billCount = useMemo(() => billsOfKind(data.bills, 'bill').length - submittedCount, [data.bills, submittedCount]);

  const summaries = useMemo(
    () => new Map(data.bills.map((bill) => [bill.id, summarizeBill(bill, rates)])),
    [data.bills, rates]
  );
  const { filters, sort, setSort, filteredBills, clientNames, setFilter, clearFilters } = useBillFilters(bills, summaries);

  /** Creates the bill under a chosen project (or none), then opens it. */
  function create({ project, newProject } = {}) {
    const target = newProject ? actions.projects.add(newProject) : project;
    actions.bills.create(createKind, { project: target });
    setCreating(false);
    onNavigate(VIEWS.entry);
  }

  const convertedLabel = (estimate) => {
    const bill = data.bills.find((entry) => entry.id === estimate.convertedBillId);
    return bill ? t('Converted to {bill}', { bill: billLabel(bill, t) }) : '';
  };

  return (
    <section>
      <PageHeading
        title={t('Bills')}
        description={t('Work on bills here. Tap a bill to open it; its ⋮ menu has everything else.')}
        action={(
          <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
            <IconButton aria-label={t('History')} onClick={() => setHistoryOpen(true)}><HistoryIcon /></IconButton>
            <Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreating(true)}>
              {isEstimates ? t('New estimate') : t('New bill')}
            </Button>
          </Stack>
        )}
      />

      <Paper variant="outlined" sx={{ mb: 1.5 }}>
        <Tabs value={kind} onChange={(_event, value) => setKind(value)} variant="fullWidth" aria-label={t('Bills and estimates')}>
          <Tab value="bill" label={`${t('Bills')} (${billCount})`} />
          <Tab value="submitted" label={`${t('Submitted')} (${submittedCount})`} />
          <Tab value="estimate" label={`${t('Estimates')} (${estimateCount})`} />
        </Tabs>
      </Paper>

      <BillFilters
        filters={filters}
        sort={sort}
        onSortChange={setSort}
        clientNames={clientNames}
        projects={data.projects}
        resultCount={filteredBills.length}
        totalCount={bills.length}
        onChange={setFilter}
        onClear={clearFilters}
      />

      {filteredBills.map((bill) => (
        <BillCard
          key={bill.id}
          bill={bill}
          summary={summaries.get(bill.id)}
          selected={bill.id === activeBill.id}
          note={convertedLabel(bill)}
          ops={ops.cardProps(bill)}
        />
      ))}

      {filteredBills.length === 0 && (
        bills.length ? (
          <EmptyState
            title={t('No matching bills')}
            description={t('Adjust or clear the search and filters to see more bills.')}
            action={<Button variant="outlined" onClick={clearFilters}>{t('Clear filters')}</Button>}
          />
        ) : kind === 'submitted' ? (
          <EmptyState
            icon={<ReceiptLongIcon />}
            title={t('No submitted bills yet')}
            description={t('When a ready bill is paid, press Submit. It then moves here for reference, and you can still make a running bill from it.')}
          />
        ) : isEstimates ? (
          <EmptyState
            icon={<ReceiptLongIcon />}
            title={t('No estimates yet')}
            description={t('Make an estimate (quotation) for a client, then convert it into a bill when the work is confirmed.')}
            action={<Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreating(true)}>{t('New estimate')}</Button>}
          />
        ) : (
          <EmptyState
            icon={<ReceiptLongIcon />}
            title={t('Start a bill')}
            description={t('Create your first bill to begin entering measurements.')}
            action={<Button variant="contained" startIcon={<AddIcon />} onClick={() => setCreating(true)}>{t('Create first bill')}</Button>}
          />
        )
      )}
      <HistoryDialog open={historyOpen} filter="bills" onClose={() => setHistoryOpen(false)} />
      {ops.dialogs}
      <NewBillDialog open={creating} kind={createKind} projects={data.projects} defaultProjectId={activeBill.projectId || ''} onCreate={create} onClose={() => setCreating(false)} />
    </section>
  );
}

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
import { billKind, billLabel, billsOfKind } from '../../domain/bill-kinds.js';
import { EmptyState, PageHeading, useConfirm, useNotify } from '../../components/ui';
import { useUndoable } from '../../hooks/useUndoable.js';
import { useWhatsAppReminder } from '../../hooks/useWhatsAppReminder.js';
import { VIEWS } from '../../config/app.js';
import { useBillFilters } from './useBillFilters.js';
import BillFilters from './BillFilters.jsx';
import BillCard from './BillCard.jsx';
import HistoryDialog from '../history/HistoryDialog.jsx';
import NewBillDialog from './NewBillDialog.jsx';
import { tr as t } from '../../i18n/translate.js';

/** List of all bills and estimates: search, filter, sort and per-bill actions. */
export default function BillsPage({ onNavigate }) {
  const { data, bill: activeBill, actions } = useBilling();
  const confirm = useConfirm();
  const notify = useNotify();
  const undoable = useUndoable();
  const [historyOpen, setHistoryOpen] = useState(false);
  const [creating, setCreating] = useState(false);
  /** The bill being linked to a project from the list, if any. */
  const [linking, setLinking] = useState(null);
  const reminder = useWhatsAppReminder();
  const { rates } = data;
  /** 'bill' or 'estimate': which list is shown, and what "New" creates. */
  const [kind, setKind] = useState(() => billKind(activeBill));
  const isEstimates = kind === 'estimate';
  const bills = useMemo(() => billsOfKind(data.bills, kind), [data.bills, kind]);
  const estimateCount = useMemo(() => billsOfKind(data.bills, 'estimate').length, [data.bills]);

  const summaries = useMemo(
    () => new Map(data.bills.map((bill) => [bill.id, summarizeBill(bill, rates)])),
    [data.bills, rates]
  );
  const { filters, sort, setSort, filteredBills, clientNames, setFilter, clearFilters } = useBillFilters(bills, summaries);

  const billCount = useMemo(() => billsOfKind(data.bills, 'bill').length, [data.bills]);

  /** Creates the bill under a chosen project (or none), then opens it. */
  function create({ project, newProject } = {}) {
    const target = newProject ? actions.projects.add(newProject) : project;
    actions.bills.create(kind, { project: target });
    setCreating(false);
    onNavigate(VIEWS.entry);
  }

  /** Links a bill from the list to a project (existing or new) without opening it. */
  function linkProject(bill, { project, newProject } = {}) {
    const target = newProject ? actions.projects.add(newProject) : project;
    if (!target) return;
    actions.bills.linkProject(bill.id, target);
    setLinking(null);
    notify(t('{bill} linked to {project}.', { bill: billLabel(bill, t), project: target.name }));
  }

  function openBill(billId) {
    actions.bills.open(billId);
    onNavigate(VIEWS.entry);
  }

  function duplicateBill(bill) {
    actions.bills.duplicate(bill);
    notify(t('{name} duplicated.', { name: billLabel(bill, t) }));
    onNavigate(VIEWS.entry);
  }

  function convertEstimate(estimate) {
    const bill = actions.bills.convertEstimate(estimate.id);
    if (!bill) return;
    notify(t('{estimate} converted to {bill}.', { estimate: billLabel(estimate, t), bill: billLabel(bill, t) }));
    onNavigate(VIEWS.entry);
  }

  function nextRunningBill(bill) {
    const next = actions.bills.nextRunningBill(bill.id);
    if (!next) return;
    notify(t('{bill} started for {project}.', { bill: billLabel(next, t), project: next.projectName || t('Untitled project') }));
    onNavigate(VIEWS.entry);
  }

  async function deleteBill(bill) {
    const label = billLabel(bill, t);
    const confirmed = await confirm({
      title: t('Delete {name}?', { name: label }),
      message: t('It moves to Recently deleted and can be restored for 30 days.'),
      confirmLabel: t('Delete'),
      danger: true
    });
    if (!confirmed) return;
    undoable(t('{name} deleted.', { name: label }), () => actions.bills.remove(bill.id));
  }

  const convertedLabel = (estimate) => {
    const bill = data.bills.find((entry) => entry.id === estimate.convertedBillId);
    return bill ? t('Converted to {bill}', { bill: billLabel(bill, t) }) : '';
  };

  return (
    <section>
      <PageHeading
        title={t('Bills')}
        description={t('All bills and estimates on this device.')}
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
          onOpen={() => openBill(bill.id)}
          onLinkProject={() => setLinking(bill)}
          onDuplicate={() => duplicateBill(bill)}
          onDelete={() => deleteBill(bill)}
          onRemind={() => reminder.remind(bill)}
          onConvert={() => convertEstimate(bill)}
          onNextRunningBill={() => nextRunningBill(bill)}
        />
      ))}

      {filteredBills.length === 0 && (
        bills.length ? (
          <EmptyState
            title={t('No matching bills')}
            description={t('Adjust or clear the search and filters to see more bills.')}
            action={<Button variant="outlined" onClick={clearFilters}>{t('Clear filters')}</Button>}
          />
        ) : isEstimates ? (
          <EmptyState
            icon={<ReceiptLongIcon />}
            title={t('No estimates yet')}
            description={t('Make an estimate (quotation) for a client, then convert it into a bill when the work is confirmed.')}
            action={<Button variant="contained" startIcon={<AddIcon />} onClick={create}>{t('New estimate')}</Button>}
          />
        ) : (
          <EmptyState
            icon={<ReceiptLongIcon />}
            title={t('Start a bill')}
            description={t('Create your first bill to begin entering measurements.')}
            action={<Button variant="contained" startIcon={<AddIcon />} onClick={create}>{t('Create first bill')}</Button>}
          />
        )
      )}
      <HistoryDialog open={historyOpen} filter="bills" onClose={() => setHistoryOpen(false)} />
      <NewBillDialog open={Boolean(linking)} kind={kind} projects={data.projects} linking={linking} onCreate={(choice) => linkProject(linking, choice)} onClose={() => setLinking(null)} />
      <NewBillDialog open={creating} kind={kind} projects={data.projects} defaultProjectId={activeBill.projectId || ''} onCreate={create} onClose={() => setCreating(false)} />
    </section>
  );
}

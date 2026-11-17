import { useMemo } from 'react';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import { useBilling } from '../../state/BillingContext.jsx';
import { summarizeBill } from '../../domain/calculations.js';
import { formatCurrency } from '../../domain/formatters.js';
import { EmptyState, PageHeading, StatCard, useConfirm, useNotify } from '../../components/ui';
import { useUndoable } from '../../hooks/useUndoable.js';
import { VIEWS } from '../../config/app.js';
import { useBillFilters } from './useBillFilters.js';
import BillFilters from './BillFilters.jsx';
import BillCard from './BillCard.jsx';
import BackupReminder from '../backup/BackupReminder.jsx';

export default function DashboardPage({ onNavigate }) {
  const { data, bill: activeBill, actions } = useBilling();
  const confirm = useConfirm();
  const notify = useNotify();
  const undoable = useUndoable();
  const { bills, rates } = data;

  const summaries = useMemo(
    () => new Map(bills.map((bill) => [bill.id, summarizeBill(bill, rates)])),
    [bills, rates]
  );
  const { filters, sort, setSort, filteredBills, clientNames, setFilter, clearFilters } = useBillFilters(bills, summaries);

  const stats = useMemo(() => {
    const all = [...summaries.values()];
    return {
      billed: all.reduce((sum, { totals }) => sum + totals.total, 0),
      outstanding: all.reduce((sum, { totals }) => sum + Math.max(0, totals.balance), 0)
    };
  }, [summaries]);

  function createBill() {
    actions.bills.create();
    onNavigate(VIEWS.entry);
  }

  function openBill(billId) {
    actions.bills.open(billId);
    onNavigate(VIEWS.entry);
  }

  function duplicateBill(bill) {
    actions.bills.duplicate(bill);
    notify(`Bill ${bill.number} duplicated.`);
    onNavigate(VIEWS.entry);
  }

  async function deleteBill(bill) {
    const confirmed = await confirm({
      title: `Delete bill ${bill.number}?`,
      message: 'This cannot be undone.',
      confirmLabel: 'Delete',
      danger: true
    });
    if (!confirmed) return;
    undoable(`Bill ${bill.number} deleted.`, () => actions.bills.remove(bill.id));
  }

  return (
    <section>
      <PageHeading
        title="Bills"
        description="Your construction bills on this device."
        action={<Button variant="contained" startIcon={<AddIcon />} onClick={createBill}>New bill</Button>}
      />

      <BackupReminder />

      <Grid container spacing={1.25} sx={{ mb: 2.5 }}>
        <Grid size={{ xs: 6, sm: 3 }}><StatCard label="Saved bills" value={bills.length} /></Grid>
        <Grid size={{ xs: 6, sm: 3 }}><StatCard label="Total billed" value={formatCurrency(stats.billed)} /></Grid>
        <Grid size={{ xs: 6, sm: 3 }}><StatCard label="Outstanding" value={formatCurrency(stats.outstanding)} /></Grid>
        <Grid size={{ xs: 6, sm: 3 }}><StatCard label="Current bill" value={formatCurrency(summaries.get(activeBill.id).totals.total)} /></Grid>
      </Grid>

      <Typography variant="h6" component="h2" sx={{ mb: 1 }}>Your bills</Typography>
      <BillFilters
        filters={filters}
        sort={sort}
        onSortChange={setSort}
        clientNames={clientNames}
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
          onOpen={() => openBill(bill.id)}
          onDuplicate={() => duplicateBill(bill)}
          onDelete={() => deleteBill(bill)}
        />
      ))}

      {filteredBills.length === 0 && (
        bills.length ? (
          <EmptyState
            title="No matching bills"
            description="Adjust or clear the search and filters to see more bills."
            action={<Button variant="outlined" onClick={clearFilters}>Clear filters</Button>}
          />
        ) : (
          <EmptyState
            icon={<ReceiptLongIcon />}
            title="Start a bill"
            description="Create your first bill to begin entering measurements."
            action={<Button variant="contained" startIcon={<AddIcon />} onClick={createBill}>Create first bill</Button>}
          />
        )
      )}
    </section>
  );
}

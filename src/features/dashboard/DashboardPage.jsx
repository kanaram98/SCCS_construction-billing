import { useMemo } from 'react';
import { useBilling } from '../../state/BillingContext.jsx';
import { summarizeBill } from '../../domain/calculations.js';
import { formatCurrency } from '../../domain/formatters.js';
import { Button, EmptyState, PageHeading, StatCard } from '../../components/ui';
import { VIEWS } from '../../config/app.js';
import { useBillFilters } from './useBillFilters.js';
import BillFilters from './BillFilters.jsx';
import BillCard from './BillCard.jsx';

export default function DashboardPage({ onNavigate }) {
  const { data, bill: activeBill, actions } = useBilling();
  const { bills, rates } = data;

  const summaries = useMemo(
    () => new Map(bills.map((bill) => [bill.id, summarizeBill(bill, rates)])),
    [bills, rates]
  );
  const { filters, filteredBills, clientNames, setFilter, clearFilters } = useBillFilters(bills, summaries);

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
    onNavigate(VIEWS.entry);
  }

  function deleteBill(bill) {
    if (window.confirm(`Delete bill ${bill.number}? This cannot be undone.`)) actions.bills.remove(bill.id);
  }

  return (
    <section>
      <PageHeading
        title="Billing workspace"
        description="Manage your construction bills on this device."
        action={<Button variant="primary" onClick={createBill}>+ New bill</Button>}
      />
      <div className="dashboard-stats">
        <StatCard label="Saved bills" value={bills.length} />
        <StatCard label="Total billed" value={formatCurrency(stats.billed)} />
        <StatCard label="Outstanding" value={formatCurrency(stats.outstanding)} />
        <StatCard label="Current bill" value={formatCurrency(summaries.get(activeBill.id).totals.total)} />
      </div>

      <div className="bill-list-heading"><h2>Your bills</h2></div>
      <BillFilters
        filters={filters}
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
            action={<Button variant="primary" onClick={clearFilters}>Clear filters</Button>}
          />
        ) : (
          <EmptyState
            title="Start a bill"
            description="Create your first bill to begin entering measurements."
            action={<Button variant="primary" onClick={createBill}>Create first bill</Button>}
          />
        )
      )}
    </section>
  );
}

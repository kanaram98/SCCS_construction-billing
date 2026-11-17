import { Button, SelectField, TextField } from '../../components/ui';
import { PAYMENT_STATUSES } from '../../domain/calculations.js';

export default function BillFilters({ filters, clientNames, resultCount, totalCount, onChange, onClear }) {
  return (
    <div className="card dashboard-filters">
      <div className="dashboard-filter-grid">
        <TextField
          label="Search bills"
          type="search"
          value={filters.search}
          placeholder="Bill no., project, or client"
          onChange={(value) => onChange('search', value)}
        />
        <SelectField
          label="Client"
          value={filters.client}
          placeholder="All clients"
          options={clientNames.map((name) => ({ value: name, label: name }))}
          onChange={(value) => onChange('client', value)}
        />
        <TextField
          label="From date"
          type="date"
          value={filters.dateFrom}
          max={filters.dateTo || undefined}
          onChange={(value) => onChange('dateFrom', value)}
        />
        <TextField
          label="To date"
          type="date"
          value={filters.dateTo}
          min={filters.dateFrom || undefined}
          onChange={(value) => onChange('dateTo', value)}
        />
        <SelectField
          label="Payment status"
          value={filters.payment}
          placeholder="All statuses"
          options={PAYMENT_STATUSES.map(({ id, label }) => ({ value: id, label }))}
          onChange={(value) => onChange('payment', value)}
        />
      </div>
      <div className="filter-results">
        <span>{resultCount} of {totalCount} bills · Status is derived from each bill's advance amount.</span>
        <Button variant="subtle" onClick={onClear}>Clear filters</Button>
      </div>
    </div>
  );
}

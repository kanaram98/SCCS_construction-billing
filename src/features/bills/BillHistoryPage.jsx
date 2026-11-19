import { useMemo } from 'react';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import { useBilling } from '../../state/BillingContext.jsx';
import { summarizeBill } from '../../domain/calculations.js';
import { billLabel } from '../../domain/bill-kinds.js';
import { billStage } from '../../domain/bill-filters.js';
import { EmptyState, PageHeading } from '../../components/ui';
import { useBillFilters } from './useBillFilters.js';
import { useBillOperations } from './useBillOperations.jsx';
import BillFilters from './BillFilters.jsx';
import BillCard from './BillCard.jsx';
import { tr as t } from '../../i18n/translate.js';

const STAGES = [
  ['', 'All'],
  ['draft', 'Draft'],
  ['ready', 'Ready'],
  ['submitted', 'Submitted'],
  ['cancelled', 'Cancelled'],
  ['estimate', 'Estimates']
];

/**
 * Find any bill: every bill and estimate of every stage in one list, searchable by number, name, client,
 * project or quotation. A bill found here has the same ⋮ menu as on the Bills page.
 */
export default function BillHistoryPage({ onNavigate }) {
  const { data, bill: activeBill } = useBilling();
  const ops = useBillOperations({ onNavigate });
  const summaries = useMemo(() => new Map(data.bills.map((bill) => [bill.id, summarizeBill(bill, data.rates)])), [data.bills, data.rates]);
  const { filters, sort, setSort, filteredBills, clientNames, setFilter, clearFilters } = useBillFilters(data.bills, summaries);
  const counts = useMemo(() => {
    const result = {};
    for (const bill of data.bills) result[billStage(bill)] = (result[billStage(bill)] || 0) + 1;
    return result;
  }, [data.bills]);

  const convertedLabel = (estimate) => {
    const bill = data.bills.find((entry) => entry.id === estimate.convertedBillId);
    return bill ? t('Converted to {bill}', { bill: billLabel(bill, t) }) : '';
  };

  return (
    <section>
      <PageHeading title={t('Find a bill')} description={t('Every bill and estimate, whatever its stage. Search by number, name, client, project or quotation.')} />

      <BillFilters
        filters={filters}
        sort={sort}
        onSortChange={setSort}
        clientNames={clientNames}
        projects={data.projects}
        resultCount={filteredBills.length}
        totalCount={data.bills.length}
        onChange={setFilter}
        onClear={clearFilters}
        placeholder={t('Search number, name, client, project or quotation')}
      />

      <Stack direction="row" useFlexGap role="group" aria-label={t('Stage')} sx={{ flexWrap: 'wrap', gap: 0.75, mb: 1.5 }}>
        {STAGES.map(([value, label]) => (
          <Chip
            key={value || 'all'}
            label={`${t(label)}${value ? ` (${counts[value] || 0})` : ` (${data.bills.length})`}`}
            color={filters.stage === value ? 'primary' : 'default'}
            variant={filters.stage === value ? 'filled' : 'outlined'}
            onClick={() => setFilter('stage', value)}
            aria-pressed={filters.stage === value}
          />
        ))}
      </Stack>

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
        <EmptyState
          title={t('No matching bills')}
          description={t('Adjust or clear the search and filters to see more bills.')}
          action={<Button variant="outlined" onClick={clearFilters}>{t('Clear filters')}</Button>}
        />
      )}
      {ops.dialogs}
    </section>
  );
}

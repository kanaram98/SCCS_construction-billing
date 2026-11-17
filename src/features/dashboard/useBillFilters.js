import { useMemo, useState } from 'react';
import { EMPTY_BILL_FILTERS, filterBills, getBillClientNames } from '../../domain/bill-filters.js';

/**
 * Dashboard filter state plus the filtered bill list.
 * @param {Map<string, { status: string }>} summaries per-bill summaries keyed by bill id
 */
export function useBillFilters(bills, summaries) {
  const [filters, setFilters] = useState(EMPTY_BILL_FILTERS);

  const filteredBills = useMemo(
    () => filterBills(bills, filters, (bill) => summaries.get(bill.id).status),
    [bills, filters, summaries]
  );
  const clientNames = useMemo(() => getBillClientNames(bills), [bills]);

  return {
    filters,
    filteredBills,
    clientNames,
    setFilter: (key, value) => setFilters((current) => ({ ...current, [key]: value })),
    clearFilters: () => setFilters(EMPTY_BILL_FILTERS)
  };
}

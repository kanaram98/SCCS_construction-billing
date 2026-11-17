import { useState } from 'react';
import Badge from '@mui/material/Badge';
import Button from '@mui/material/Button';
import Collapse from '@mui/material/Collapse';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import SearchIcon from '@mui/icons-material/Search';
import FilterListIcon from '@mui/icons-material/FilterList';
import SortIcon from '@mui/icons-material/Sort';
import { ChoiceMenu, SelectField, TextField } from '../../components/ui';
import { PAYMENT_STATUSES } from '../../domain/calculations.js';
import { BILL_SORTS } from '../../domain/bill-filters.js';

/** Search box with a collapsible panel for client, date and status filters. */
export default function BillFilters({ filters, sort, onSortChange, clientNames, resultCount, totalCount, onChange, onClear }) {
  const [expanded, setExpanded] = useState(false);
  const activeCount = ['client', 'dateFrom', 'dateTo', 'payment'].filter((key) => filters[key]).length;

  return (
    <>
      <Stack direction="row" spacing={1} sx={{ mb: 1, alignItems: 'center' }}>
        <TextField
          type="search"
          value={filters.search}
          placeholder="Search bill no., project or client"
          onChange={(value) => onChange('search', value)}
          slotProps={{
            input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> },
            htmlInput: { 'aria-label': 'Search bills' }
          }}
          sx={{ bgcolor: 'background.paper' }}
        />
        <IconButton
          aria-label={expanded ? 'Hide filters' : 'Show filters'}
          aria-expanded={expanded}
          onClick={() => setExpanded((open) => !open)}
          color={expanded || activeCount ? 'primary' : 'default'}
        >
          <Badge badgeContent={activeCount} color="secondary"><FilterListIcon /></Badge>
        </IconButton>
        <ChoiceMenu icon={<SortIcon />} label="Sort bills" title="Sort by" options={BILL_SORTS} value={sort} onChange={onSortChange} />
      </Stack>

      <Collapse in={expanded}>
        <Grid container spacing={1.5} sx={{ pt: 1, pb: 1 }}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <SelectField
              label="Client"
              value={filters.client}
              placeholder="All clients"
              options={clientNames.map((name) => ({ value: name, label: name }))}
              onChange={(value) => onChange('client', value)}
            />
          </Grid>
          <Grid size={{ xs: 12, sm: 6 }}>
            <SelectField
              label="Payment status"
              value={filters.payment}
              placeholder="All statuses"
              options={PAYMENT_STATUSES.map(({ id, label }) => ({ value: id, label }))}
              onChange={(value) => onChange('payment', value)}
            />
          </Grid>
          <Grid size={6}>
            <TextField label="From date" type="date" value={filters.dateFrom} max={filters.dateTo || undefined} onChange={(value) => onChange('dateFrom', value)} />
          </Grid>
          <Grid size={6}>
            <TextField label="To date" type="date" value={filters.dateTo} min={filters.dateFrom || undefined} onChange={(value) => onChange('dateTo', value)} />
          </Grid>
        </Grid>
      </Collapse>

      <Stack direction="row" sx={{ mb: 1.5, alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="caption" color="text.secondary">
          {resultCount} of {totalCount} bills · status is based on payments received
        </Typography>
        <Button size="small" onClick={onClear}>Clear</Button>
      </Stack>
    </>
  );
}

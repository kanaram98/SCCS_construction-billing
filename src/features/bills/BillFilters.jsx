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
import { tr as t } from '../../i18n/translate.js';

/** Search box with a collapsible panel for client, date and status filters. */
export default function BillFilters({ filters, sort, onSortChange, clientNames, projects = [], resultCount, totalCount, onChange, onClear, placeholder = t('Search bill no., project or client') }) {
  const [expanded, setExpanded] = useState(false);
  const activeCount = ['client', 'projectId', 'dateFrom', 'dateTo', 'payment'].filter((key) => filters[key]).length;

  return (
    <>
      <Stack direction="row" spacing={1} sx={{ mb: 1, alignItems: 'center' }}>
        <TextField
          type="search"
          value={filters.search}
          placeholder={placeholder}
          onChange={(value) => onChange('search', value)}
          slotProps={{
            input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> },
            htmlInput: { 'aria-label': t('Search bills') }
          }}
          sx={{ bgcolor: 'background.paper' }}
        />
        <IconButton
          aria-label={expanded ? t('Hide filters') : t('Show filters')}
          aria-expanded={expanded}
          onClick={() => setExpanded((open) => !open)}
          color={expanded || activeCount ? 'primary' : 'default'}
        >
          <Badge badgeContent={activeCount} color="secondary"><FilterListIcon /></Badge>
        </IconButton>
        <ChoiceMenu icon={<SortIcon />} label={t('Sort bills')} title={t('Sort by')} options={BILL_SORTS} value={sort} onChange={onSortChange} />
      </Stack>

      <Collapse in={expanded}>
        <Grid container spacing={1.5} sx={{ pt: 1, pb: 1 }}>
          <Grid size={{ xs: 12, sm: 6 }}>
            <SelectField
              label={t('Client')}
              value={filters.client}
              placeholder={t('All clients')}
              options={clientNames.map((name) => ({ value: name, label: name }))}
              onChange={(value) => onChange('client', value)}
            />
          </Grid>
          {projects.length > 0 && (
            <Grid size={{ xs: 12, sm: 6 }}>
              <SelectField
                label={t('Project')}
                value={filters.projectId}
                placeholder={t('All projects')}
                options={projects.map((project) => ({ value: project.id, label: project.name }))}
                onChange={(value) => onChange('projectId', value)}
              />
            </Grid>
          )}
          <Grid size={{ xs: 12, sm: 6 }}>
            <SelectField
              label={t('Payment status')}
              value={filters.payment}
              placeholder={t('All statuses')}
              options={PAYMENT_STATUSES.map(({ id, label }) => ({ value: id, label }))}
              onChange={(value) => onChange('payment', value)}
            />
          </Grid>
          <Grid size={6}>
            <TextField label={t('From date')} type="date" value={filters.dateFrom} max={filters.dateTo || undefined} onChange={(value) => onChange('dateFrom', value)} />
          </Grid>
          <Grid size={6}>
            <TextField label={t('To date')} type="date" value={filters.dateTo} min={filters.dateFrom || undefined} onChange={(value) => onChange('dateTo', value)} />
          </Grid>
        </Grid>
      </Collapse>

      <Stack direction="row" sx={{ mb: 1.5, alignItems: 'center', justifyContent: 'space-between' }}>
        <Typography variant="caption" color="text.secondary">
          {t('{shown} of {total} bills · status is based on payments received', { shown: resultCount, total: totalCount })}
        </Typography>
        <Button size="small" onClick={onClear}>{t('Clear')}</Button>
      </Stack>
    </>
  );
}

import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import MuiTextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { formatCurrency } from '../../domain/formatters.js';
import { measurementTypeLabel } from '../../domain/rates.js';
import { tr as t } from '../../i18n/translate.js';

/** Matches typed text against the work item's name, unit or measurement type. */
function filterRates(options, { inputValue }) {
  const query = inputValue.trim().toLowerCase();
  if (!query) return options;
  return options.filter((rate) =>
    `${rate.name} ${rate.unit} ${measurementTypeLabel(rate.type)}`.toLowerCase().includes(query));
}

/**
 * Type-to-search picker for work items.
 * `recentIds`: items used lately in this bill, listed first under "Recently used".
 * `compact`: one-line version for the entry sheet rows. `inputProps` go on the text input (e.g. data attributes).
 */
export default function WorkItemPicker({ rates, value, onChange, recentIds = [], compact = false, inputProps = {}, autoFocus = false }) {
  const selected = rates.find((rate) => rate.id === value) || null;
  const recent = new Set(recentIds);
  const options = recentIds.length
    ? [...recentIds.map((id) => rates.find((rate) => rate.id === id)).filter(Boolean), ...rates.filter((rate) => !recent.has(rate.id))]
    : rates;
  return (
    <Autocomplete
      options={options}
      value={selected}
      onChange={(_event, rate) => onChange(rate?.id || '')}
      getOptionLabel={(rate) => `${rate.name} · ${rate.unit}`}
      isOptionEqualToValue={(option, current) => option.id === current.id}
      filterOptions={filterRates}
      groupBy={recentIds.length ? (rate) => (recent.has(rate.id) ? t('Recently used') : t('All work items')) : undefined}
      disableClearable={Boolean(selected)}
      autoHighlight
      size={compact ? 'small' : 'medium'}
      noOptionsText={t('No matching work item. Add it in Rates.')}
      renderOption={({ key, ...props }, rate) => (
        <Box component="li" key={key} {...props} sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
          <span>
            <Typography variant="body2" component="span" sx={{ fontWeight: 600 }}>{rate.name}</Typography>
            <Typography variant="caption" color="text.secondary" component="div">{t(measurementTypeLabel(rate.type))}</Typography>
          </span>
          <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
            {formatCurrency(rate.rate)}/{rate.unit}
          </Typography>
        </Box>
      )}
      renderInput={(params) => (
        <MuiTextField
          {...params}
          label={t('Work item')}
          placeholder={t('Search work items')}
          autoFocus={autoFocus}
          helperText={compact ? undefined : selected ? t('Rate: {rate} / {unit}', { rate: formatCurrency(selected.rate), unit: selected.unit }) : t('Type to search')}
          slotProps={{ ...params.slotProps, inputLabel: { ...params.slotProps?.inputLabel, shrink: true }, htmlInput: { ...params.slotProps?.htmlInput, ...inputProps } }}
        />
      )}
    />
  );
}

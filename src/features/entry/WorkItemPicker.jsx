import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import MuiTextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { formatCurrency } from '../../domain/formatters.js';
import { measurementTypeLabel } from '../../domain/rates.js';

/** Matches typed text against the work item's name, unit or measurement type. */
function filterRates(options, { inputValue }) {
  const query = inputValue.trim().toLowerCase();
  if (!query) return options;
  return options.filter((rate) =>
    `${rate.name} ${rate.unit} ${measurementTypeLabel(rate.type)}`.toLowerCase().includes(query));
}

/** Type-to-search picker for work items. */
export default function WorkItemPicker({ rates, value, onChange }) {
  const selected = rates.find((rate) => rate.id === value) || null;
  return (
    <Autocomplete
      options={rates}
      value={selected}
      onChange={(_event, rate) => onChange(rate?.id || '')}
      getOptionLabel={(rate) => `${rate.name} · ${rate.unit}`}
      isOptionEqualToValue={(option, current) => option.id === current.id}
      filterOptions={filterRates}
      disableClearable={Boolean(selected)}
      autoHighlight
      noOptionsText="No matching work item. Add it in Rates."
      renderOption={({ key, ...props }, rate) => (
        <Box component="li" key={key} {...props} sx={{ display: 'flex', justifyContent: 'space-between', gap: 2 }}>
          <span>
            <Typography variant="body2" component="span" sx={{ fontWeight: 600 }}>{rate.name}</Typography>
            <Typography variant="caption" color="text.secondary" component="div">{measurementTypeLabel(rate.type)}</Typography>
          </span>
          <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'nowrap' }}>
            {formatCurrency(rate.rate)}/{rate.unit}
          </Typography>
        </Box>
      )}
      renderInput={(params) => (
        <MuiTextField
          {...params}
          label="Work item"
          placeholder="Search work items"
          helperText={selected ? `Rate: ${formatCurrency(selected.rate)} / ${selected.unit}` : 'Type to search'}
        />
      )}
    />
  );
}

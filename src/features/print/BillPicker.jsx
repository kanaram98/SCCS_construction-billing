import Autocomplete from '@mui/material/Autocomplete';
import Box from '@mui/material/Box';
import MuiTextField from '@mui/material/TextField';
import Typography from '@mui/material/Typography';
import { billLabel } from '../../domain/bill-kinds.js';
import { stageLabel } from '../bills/stageText.js';
import { tr as t } from '../../i18n/translate.js';

const optionText = (bill) => [billLabel(bill, t), bill.name, bill.projectName, bill.client, bill.date, t(stageLabel(bill))].filter(Boolean).join(' · ');

/**
 * Chooses which bill to preview, print or export: any bill or estimate, whatever its stage. Type to search
 * by number, name, client or project. Choosing one here does not change the bill that is open.
 */
export default function BillPicker({ bills, value, onChange }) {
  const sorted = [...bills].sort((a, b) => String(b.date).localeCompare(String(a.date)) || String(b.number).localeCompare(String(a.number), undefined, { numeric: true }));
  return (
    <Autocomplete
      options={sorted}
      value={value}
      disableClearable
      autoHighlight
      onChange={(_event, bill) => onChange(bill.id)}
      getOptionLabel={optionText}
      isOptionEqualToValue={(option, current) => option.id === current.id}
      renderOption={({ key, ...props }, bill) => (
        <Box component="li" key={key} {...props} sx={{ display: 'block !important' }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>{billLabel(bill, t)}{bill.name ? ` · ${bill.name}` : ''}</Typography>
          <Typography variant="caption" color="text.secondary">{[bill.projectName, bill.client, bill.date, t(stageLabel(bill))].filter(Boolean).join(' · ')}</Typography>
        </Box>
      )}
      renderInput={(params) => <MuiTextField {...params} label={t('Bill to print')} placeholder={t('Search number, name, client or project')} />}
      sx={{ bgcolor: 'background.paper', mb: 1.5 }}
    />
  );
}

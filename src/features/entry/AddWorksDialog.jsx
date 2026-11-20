import { useState } from 'react';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { ResponsiveDialog } from '../../components/ui';
import { tr as t, trn } from '../../i18n/translate.js';

/**
 * A small pop-up: choose every work item to do on the measurement of one entry (a door, a floor area ...).
 * Each chosen work gets its own entry that shares the numbers, so nothing is measured twice.
 */
export default function AddWorksDialog({ title, measurement, rates, onAdd, onClose }) {
  const [chosen, setChosen] = useState([]);
  const toggle = (id) => setChosen((current) => (current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]));
  return (
    <ResponsiveDialog
      open
      onClose={onClose}
      title={t('Add works on this measurement')}
      actions={<Button variant="contained" disabled={!chosen.length} onClick={() => onAdd(chosen)}>{chosen.length ? trn(chosen.length, 'Add {count} work', 'Add {count} works') : t('Choose works')}</Button>}
    >
      <Typography variant="body2" sx={{ fontWeight: 600 }}>{title}</Typography>
      <Typography variant="caption" color="text.secondary" component="div" sx={{ mb: 1.5 }}>{measurement}</Typography>
      <Stack direction="row" sx={{ gap: 0.75, flexWrap: 'wrap' }}>
        {rates.map((rate) => (
          <Chip key={rate.id} label={rate.name} color={chosen.includes(rate.id) ? 'primary' : 'default'} variant={chosen.includes(rate.id) ? 'filled' : 'outlined'} onClick={() => toggle(rate.id)} aria-pressed={chosen.includes(rate.id)} />
        ))}
      </Stack>
    </ResponsiveDialog>
  );
}

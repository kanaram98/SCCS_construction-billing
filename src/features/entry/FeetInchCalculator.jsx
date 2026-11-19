import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { ResponsiveDialog, TextField } from '../../components/ui';
import { calculateFeetInches } from '../../domain/measurements.js';
import { tr as t } from '../../i18n/translate.js';

const OPERATIONS = [
  { id: 'add', label: 'A + B' },
  { id: 'sub', label: 'A − B' },
  { id: 'area', label: 'A × B (area)' },
  { id: 'perimeter', label: 'Perimeter' },
  { id: 'convert', label: 'Convert' }
];

const CONVERSIONS = [
  { id: 'ft-m', label: 'ft.in → metres', hint: 'e.g. 15.4' },
  { id: 'm-ft', label: 'metres → ft.in', hint: 'e.g. 4.5' },
  { id: 'sqft-sqm', label: 'sqft → sqm', hint: 'e.g. 120' },
  { id: 'sqm-sqft', label: 'sqm → sqft', hint: 'e.g. 12' }
];

/**
 * A feet-and-inches calculator for the entry form. `targets` are the boxes of the entry that take a length
 * (Length, Width, Height); the result of a length calculation can be put straight into one of them.
 * `onUseQuantity` puts a plain number (an area) into the Quantity box of an entry that is typed as a quantity.
 */
export default function FeetInchCalculator({ open, targets = [], onUse, onUseQuantity, onClose }) {
  return (
    <ResponsiveDialog open={open} title={t('Feet and inch calculator')} onClose={onClose} maxWidth="xs">
      {open && <Body targets={targets} onUse={onUse} onUseQuantity={onUseQuantity} onClose={onClose} />}
    </ResponsiveDialog>
  );
}

function Body({ targets, onUse, onUseQuantity, onClose }) {
  const [operation, setOperation] = useState('add');
  const [conversion, setConversion] = useState('ft-m');
  const [a, setA] = useState('');
  const [b, setB] = useState('');
  const result = calculateFeetInches(operation, conversion, a, b);
  const converting = operation === 'convert';
  const hint = CONVERSIONS.find((entry) => entry.id === conversion)?.hint || '';

  return (
    <Box sx={{ pt: 0.5 }}>
      <Typography variant="caption" color="text.secondary" component="div" sx={{ mb: 1 }}>
        {t('Type lengths as feet.inches: 15.4 means 15 ft 4 in. Inches go from 0 to 11. A third part is a part of an inch: 10.10.5 is 10 ft 10½ in.')}
      </Typography>
      <Stack direction="row" sx={{ gap: 0.75, flexWrap: 'wrap', mb: 1.5 }}>
        {OPERATIONS.map((entry) => (
          <Chip key={entry.id} label={t(entry.label)} color={operation === entry.id ? 'primary' : 'default'} variant={operation === entry.id ? 'filled' : 'outlined'} onClick={() => setOperation(entry.id)} />
        ))}
      </Stack>
      {converting && (
        <Stack direction="row" sx={{ gap: 0.75, flexWrap: 'wrap', mb: 1.5 }}>
          {CONVERSIONS.map((entry) => (
            <Chip key={entry.id} size="small" label={t(entry.label)} color={conversion === entry.id ? 'primary' : 'default'} variant={conversion === entry.id ? 'filled' : 'outlined'} onClick={() => { setConversion(entry.id); setA(''); }} />
          ))}
        </Stack>
      )}
      <Stack direction="row" spacing={1}>
        <TextField label={converting ? t('Value') : operation === 'perimeter' ? t('Length') : 'A'} value={a} inputMode="decimal" placeholder={converting ? hint : '0.0'} onChange={setA} />
        {!converting && <TextField label={operation === 'perimeter' ? t('Width') : 'B'} value={b} inputMode="decimal" placeholder="0.0" onChange={setB} />}
      </Stack>
      <Box sx={{ mt: 1.5, p: 1.25, borderRadius: 1, bgcolor: 'action.hover', minHeight: 56 }} aria-live="polite">
        {result.error && <Typography variant="body2" color="error">{result.error}</Typography>}
        {!result.error && !result.lines?.length && <Typography variant="body2" color="text.secondary">{t('The result shows here.')}</Typography>}
        {(result.lines || []).map((line, index) => (
          <Typography key={line} variant={index ? 'body2' : 'subtitle1'} sx={{ fontWeight: index ? 400 : 700 }}>{line}</Typography>
        ))}
      </Box>
      {!result.error && (result.text !== undefined || result.area !== undefined) && (
        <Stack direction="row" sx={{ gap: 0.75, flexWrap: 'wrap', mt: 1.5 }}>
          {result.text !== undefined && targets.map((target) => (
            <Button key={target.key} size="small" variant="outlined" onClick={() => { onUse(target.key, result.text); onClose(); }}>{t('Use as {name}', { name: t(target.label) })}</Button>
          ))}
          {result.area !== undefined && onUseQuantity && (
            <Button size="small" variant="outlined" onClick={() => { onUseQuantity(String(result.area)); onClose(); }}>{t('Use as quantity')}</Button>
          )}
        </Stack>
      )}
    </Box>
  );
}

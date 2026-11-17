import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import { countedUnits, markLabel } from '../../domain/labour.js';

/** "A × 2  ½P × 1  1P × 20  2P × 3": how many times each mark was given. Absent is red. */
export default function MarkCounts({ counts, showZero = false, sx }) {
  const units = countedUnits(counts).filter((value) => showZero || counts[value]);
  if (!units.length) return null;
  return (
    <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 0.75, ...sx }}>
      {units.map((value) => (
        <Chip
          key={value}
          size="small"
          label={`${markLabel(value)} × ${counts[value] || 0}`}
          color={value === 0 ? 'error' : 'success'}
          variant={value === 0 ? 'filled' : 'outlined'}
          sx={{ fontWeight: 700 }}
        />
      ))}
    </Stack>
  );
}

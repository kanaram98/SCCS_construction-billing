import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { ResponsiveDialog } from '../../components/ui';
import { formatCurrency } from '../../domain/formatters.js';
import { tr as t } from '../../i18n/translate.js';

/**
 * A work item's price is changing and bills already use it. Entries on bills keep their price,
 * so the admin chooses: leave them, or also re-price the entries in draft bills.
 */
export default function PriceChangeDialog({ change, onChoose, onClose }) {
  return (
    <ResponsiveDialog open={Boolean(change)} title={t('Change the price?')} onClose={onClose} maxWidth="xs">
      {change && (
        <Stack spacing={1.5} sx={{ pt: 1 }}>
          <Typography variant="body2">
            {t('{name}: {from} → {to} per {unit}.', { name: change.values.name, from: formatCurrency(change.rate.rate), to: formatCurrency(change.values.rate), unit: change.values.unit })}
          </Typography>
          <Typography variant="body2" color="text.secondary">
            {t('It is used in {entries} entries of {bills} bills. Final and settled bills never change.', { entries: change.usage.entries, bills: change.usage.bills })}
          </Typography>
          <Button variant="contained" onClick={() => onChoose(false)}>{t('New entries only')}</Button>
          <Button variant="outlined" disabled={!change.usage.drafts} onClick={() => onChoose(true)}>
            {change.usage.drafts ? t('Also update {count} draft bills', { count: change.usage.drafts }) : t('No draft bills use it')}
          </Button>
          <Button onClick={onClose}>{t('Cancel')}</Button>
        </Stack>
      )}
    </ResponsiveDialog>
  );
}

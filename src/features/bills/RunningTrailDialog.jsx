import Box from '@mui/material/Box';
import Chip from '@mui/material/Chip';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { ResponsiveDialog } from '../../components/ui';
import { billLabel, getRunningAccount, getSeries } from '../../domain/bill-kinds.js';
import { getBillTotals } from '../../domain/calculations.js';
import { formatCurrency } from '../../domain/formatters.js';
import { stageLabel } from './stageText.js';
import { tr as t } from '../../i18n/translate.js';

/**
 * Every running bill of one piece of work (say, the first floor) in order, with what each came to and
 * what is still owed to date. Tap one to open it. Nobody has to remember bill numbers.
 */
export default function RunningTrailDialog({ open, bill, bills, rates, onOpen, onClose }) {
  const series = bill ? getSeries(bills.filter((entry) => !entry.deletedAt), bill) : [];
  const account = bill && series.length ? getRunningAccount(bills, series[series.length - 1], rates) : null;
  return (
    <ResponsiveDialog open={open} title={bill?.name ? t('{name}: running bills', { name: bill.name }) : t('Running bills of this work')} onClose={onClose} maxWidth="sm">
      {bill && (
        <>
          <List disablePadding>
            {series.map((entry) => {
              const totals = getBillTotals(entry, rates);
              return (
                <ListItemButton key={entry.id} divider onClick={() => onOpen(entry)} selected={entry.id === bill.id}>
                  <ListItemText
                    primary={(
                      <Stack direction="row" spacing={1} component="span" sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                        <span>{billLabel(entry, t)}</span>
                        <Chip size="small" component="span" variant={entry.cancelled ? 'filled' : 'outlined'} color={entry.cancelled ? 'error' : 'default'} label={t(stageLabel(entry))} />
                      </Stack>
                    )}
                    secondary={[entry.date, t('Bill amount {amount}', { amount: formatCurrency(totals.total) }), totals.paid ? t('Received {amount}', { amount: formatCurrency(totals.paid) }) : ''].filter(Boolean).join(' · ')}
                  />
                </ListItemButton>
              );
            })}
          </List>
          {account && (
            <Box sx={{ mt: 1.5, p: 1.25, borderRadius: 1, bgcolor: 'action.hover' }}>
              <Typography variant="body2">{t('Work to date {amount}', { amount: formatCurrency(account.totalToDate) })}</Typography>
              <Typography variant="body2">{t('Received to date {amount}', { amount: formatCurrency(account.receivedToDate) })}</Typography>
              <Typography variant="subtitle2">{t('Balance to date {amount}', { amount: formatCurrency(account.balanceToDate) })}</Typography>
            </Box>
          )}
        </>
      )}
    </ResponsiveDialog>
  );
}

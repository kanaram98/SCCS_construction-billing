import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { useBilling } from '../../state/BillingContext.jsx';
import { VIEWS } from '../../config/app.js';
import { isEstimate } from '../../domain/bill-kinds.js';
import { billStatus, isCancelled } from '../../domain/bill-guard.js';
import { stageLabel } from '../bills/stageText.js';
import { tr as t } from '../../i18n/translate.js';

export { stageLabel };

/**
 * The stage of the open bill, and what it means. It is only shown here: marking a bill ready, submitting it,
 * attaching a quotation and so on are done from the bill's ⋮ menu on the Bills page.
 */
export default function BillStatusBar({ onNavigate }) {
  const { bill } = useBilling();
  const status = billStatus(bill);
  const estimate = isEstimate(bill);
  const cancelled = isCancelled(bill);
  const chipColor = cancelled ? 'error' : status === 'submitted' ? 'success' : status === 'ready' ? 'warning' : 'default';
  return (
    <Paper variant="outlined" sx={{ p: 1.25, mb: 1.5 }}>
      <Stack direction="row" useFlexGap sx={{ alignItems: 'center', flexWrap: 'wrap', gap: 1 }}>
        <Chip label={t(stageLabel(bill))} color={chipColor} variant={status === 'draft' && !cancelled ? 'outlined' : 'filled'} sx={{ fontWeight: 700 }} />
        {bill.quotationLabel && <Chip size="small" variant="outlined" label={t('Quotation {label}', { label: bill.quotationLabel })} />}
        <Typography variant="body2" color="text.secondary" sx={{ flex: 1, minWidth: 160 }}>
          {cancelled && t('Cancelled: kept for the record, counted nowhere.')}
          {!cancelled && status === 'draft' && t('Being worked on. Prints with a DRAFT stamp.')}
          {!cancelled && status === 'ready' && (estimate ? t('Final. Prices are frozen; convert it into a bill from the Bills page.') : t('Given to the client. Record payments here, then submit it from the Bills page.'))}
          {!cancelled && status === 'submitted' && t('Closed and read-only. Only the admin can reopen it.')}
        </Typography>
        <Button variant="outlined" onClick={() => onNavigate?.(VIEWS.bills)}>{t('Manage in Bills')}</Button>
      </Stack>
    </Paper>
  );
}

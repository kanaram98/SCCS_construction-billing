import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteIcon from '@mui/icons-material/DeleteOutlined';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import PostAddIcon from '@mui/icons-material/PostAdd';
import { ActionMenu } from '../../components/ui';
import { formatCurrency } from '../../domain/formatters.js';
import { paymentStatusLabel } from '../../domain/calculations.js';
import { billLabel, isEstimate } from '../../domain/bill-kinds.js';
import { tr as t } from '../../i18n/translate.js';

const STATUS_COLORS = { paid: 'success', partial: 'warning', unpaid: 'default' };

/** Tap the card to open the bill or estimate; other actions live in the ⋮ menu. */
export default function BillCard({ bill, summary, selected, note, needsProject = false, onOpen, onDuplicate, onDelete, onRemind, onConvert, onNextRunningBill }) {
  const estimate = isEstimate(bill);
  return (
    <Card
      sx={{
        mb: 1.25,
        display: 'flex',
        alignItems: 'stretch',
        borderLeft: selected ? 4 : 1,
        borderLeftColor: selected ? 'secondary.main' : 'divider'
      }}
    >
      <CardActionArea onClick={onOpen} sx={{ p: 1.75, flex: 1, minWidth: 0 }}>
        <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle1" noWrap>{billLabel(bill, t)} · {bill.projectName || t('Untitled project')}</Typography>
            <Typography variant="body2" color="text.secondary" noWrap>{bill.client || t('No client')} · {bill.date}</Typography>
          </Box>
          <Typography variant="subtitle1" color="primary" sx={{ whiteSpace: 'nowrap' }}>
            {formatCurrency(summary.totals.total)}
          </Typography>
        </Stack>
        <Stack direction="row" spacing={0.75} sx={{ mt: 1, flexWrap: 'wrap', rowGap: 0.75 }}>
          {estimate ? (
            <Chip size="small" variant="outlined" color={note ? 'success' : 'info'} label={note || t('Estimate')} />
          ) : (
            <Chip
              size="small"
              label={t(paymentStatusLabel(summary.status))}
              color={STATUS_COLORS[summary.status]}
              variant={summary.status === 'unpaid' ? 'outlined' : 'filled'}
            />
          )}
          {needsProject && !bill.projectId && <Chip size="small" variant="outlined" color="warning" label={t('No project linked')} />}
        </Stack>
      </CardActionArea>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', pt: 0.5, pr: 0.5 }}>
        <ActionMenu
          label={t('Actions for bill {number}', { number: bill.number })}
          items={[
            { label: t('Convert to bill'), icon: <ReceiptLongIcon fontSize="small" />, onClick: onConvert, hidden: !estimate },
            { label: t('Next running bill'), icon: <PostAddIcon fontSize="small" />, onClick: onNextRunningBill, hidden: estimate },
            { label: t('Payment reminder'), icon: <WhatsAppIcon fontSize="small" />, onClick: onRemind, hidden: estimate || !(summary.totals.balance > 0) },
            { label: t('Duplicate'), icon: <ContentCopyIcon fontSize="small" />, onClick: onDuplicate },
            { label: t('Delete'), icon: <DeleteIcon fontSize="small" />, onClick: onDelete, danger: true }
          ]}
        />
      </Box>
    </Card>
  );
}

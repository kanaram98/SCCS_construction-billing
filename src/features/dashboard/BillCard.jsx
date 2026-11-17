import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteIcon from '@mui/icons-material/DeleteOutlined';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import { ActionMenu } from '../../components/ui';
import { formatCurrency } from '../../domain/formatters.js';
import { paymentStatusLabel } from '../../domain/calculations.js';
import { tr as t } from '../../i18n/translate.js';

const STATUS_COLORS = { paid: 'success', partial: 'warning', unpaid: 'default' };

/** Tap the card to open the bill; duplicate/delete live in the ⋮ menu. */
export default function BillCard({ bill, summary, selected, onOpen, onDuplicate, onDelete, onRemind }) {
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
            <Typography variant="subtitle1" noWrap>{t('Bill {number}', { number: bill.number })} · {bill.projectName || t('Untitled project')}</Typography>
            <Typography variant="body2" color="text.secondary" noWrap>{bill.client || t('No client')} · {bill.date}</Typography>
          </Box>
          <Typography variant="subtitle1" color="primary" sx={{ whiteSpace: 'nowrap' }}>
            {formatCurrency(summary.totals.total)}
          </Typography>
        </Stack>
        <Chip
          size="small"
          label={t(paymentStatusLabel(summary.status))}
          color={STATUS_COLORS[summary.status]}
          variant={summary.status === 'unpaid' ? 'outlined' : 'filled'}
          sx={{ mt: 1 }}
        />
      </CardActionArea>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', pt: 0.5, pr: 0.5 }}>
        <ActionMenu
          label={t('Actions for bill {number}', { number: bill.number })}
          items={[
            { label: t('Payment reminder'), icon: <WhatsAppIcon fontSize="small" />, onClick: onRemind, hidden: !(summary.totals.balance > 0) },
            { label: t('Duplicate'), icon: <ContentCopyIcon fontSize="small" />, onClick: onDuplicate },
            { label: t('Delete'), icon: <DeleteIcon fontSize="small" />, onClick: onDelete, danger: true }
          ]}
        />
      </Box>
    </Card>
  );
}

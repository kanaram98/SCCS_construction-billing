import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteIcon from '@mui/icons-material/DeleteOutlined';
import { ActionMenu } from '../../components/ui';
import { formatCurrency } from '../../domain/formatters.js';
import { paymentStatusLabel } from '../../domain/calculations.js';

const STATUS_COLORS = { paid: 'success', partial: 'warning', unpaid: 'default' };

/** Tap the card to open the bill; duplicate/delete live in the ⋮ menu. */
export default function BillCard({ bill, summary, selected, onOpen, onDuplicate, onDelete }) {
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
            <Typography variant="subtitle1" noWrap>Bill {bill.number} · {bill.projectName || 'Untitled project'}</Typography>
            <Typography variant="body2" color="text.secondary" noWrap>{bill.client || 'No client'} · {bill.date}</Typography>
          </Box>
          <Typography variant="subtitle1" color="primary" sx={{ whiteSpace: 'nowrap' }}>
            {formatCurrency(summary.totals.total)}
          </Typography>
        </Stack>
        <Chip
          size="small"
          label={paymentStatusLabel(summary.status)}
          color={STATUS_COLORS[summary.status]}
          variant={summary.status === 'unpaid' ? 'outlined' : 'filled'}
          sx={{ mt: 1 }}
        />
      </CardActionArea>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', pt: 0.5, pr: 0.5 }}>
        <ActionMenu
          label={`Actions for bill ${bill.number}`}
          items={[
            { label: 'Duplicate', icon: <ContentCopyIcon fontSize="small" />, onClick: onDuplicate },
            { label: 'Delete', icon: <DeleteIcon fontSize="small" />, onClick: onDelete, danger: true }
          ]}
        />
      </Box>
    </Card>
  );
}

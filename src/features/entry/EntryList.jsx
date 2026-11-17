import Box from '@mui/material/Box';
import CardActionArea from '@mui/material/CardActionArea';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import EditIcon from '@mui/icons-material/EditOutlined';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import DeleteIcon from '@mui/icons-material/DeleteOutlined';
import { ActionMenu } from '../../components/ui';
import { formatCurrency } from '../../domain/formatters.js';
import { getItemQuantity, getLineAmount } from '../../domain/calculations.js';
import { describeMeasurement, resolveRate } from '../../domain/rates.js';
import { tr as t } from '../../i18n/translate.js';

/** Entries in one area as tappable cards (tap to edit). */
export default function EntryList({ items, rates, canCopy, canMove = true, onEdit, onDelete, onCopy, onMove }) {
  return (
    <Stack spacing={1}>
      {items.map((item, index) => {
        const rate = resolveRate(item, rates);
        return (
          <Paper key={item.id} variant="outlined" sx={{ display: 'flex', alignItems: 'stretch' }}>
            <CardActionArea onClick={() => onEdit(item)} sx={{ p: 1.25, flex: 1, minWidth: 0, borderRadius: 3 }}>
              <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
                <Typography variant="subtitle2" noWrap>{rate.name}</Typography>
                <Typography variant="subtitle2" color="primary" sx={{ whiteSpace: 'nowrap' }}>
                  {formatCurrency(getLineAmount(item, rate))}
                </Typography>
              </Stack>
              {item.note && <Typography variant="caption" color="text.secondary" noWrap component="div">{item.note}</Typography>}
              <Box
                sx={{ mt: 0.75, display: 'inline-block', px: 1, py: 0.25, borderRadius: 1.5, bgcolor: 'action.hover', fontSize: 13, fontWeight: 600 }}
              >
                {describeMeasurement(item, rate)}
              </Box>
              <Typography variant="caption" color="text.secondary" component="div" sx={{ mt: 0.5 }}>
                {getItemQuantity(item, rate)} {rate.unit} × {formatCurrency(rate.rate)}
              </Typography>
            </CardActionArea>
            <Box sx={{ pt: 0.25 }}>
              <ActionMenu
                size="small"
                label={t('Actions for {name}', { name: rate.name })}
                items={[
                  { label: t('Edit'), icon: <EditIcon fontSize="small" />, onClick: () => onEdit(item) },
                  { label: t('Move up'), icon: <ArrowUpwardIcon fontSize="small" />, onClick: () => onMove(item.id, -1), disabled: index === 0, hidden: !canMove },
                  { label: t('Move down'), icon: <ArrowDownwardIcon fontSize="small" />, onClick: () => onMove(item.id, 1), disabled: index === items.length - 1, hidden: !canMove },
                  { label: t('Copy to section…'), icon: <ContentCopyIcon fontSize="small" />, onClick: () => onCopy(item.id), disabled: !canCopy },
                  { label: t('Delete'), icon: <DeleteIcon fontSize="small" />, onClick: () => onDelete(item), danger: true }
                ]}
              />
            </Box>
          </Paper>
        );
      })}
    </Stack>
  );
}

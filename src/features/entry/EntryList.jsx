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
import { formatCurrency, formatQuantity } from '../../domain/formatters.js';
import { getItemQuantity, getLineAmount } from '../../domain/calculations.js';
import { describeMeasurement, resolveRate } from '../../domain/rates.js';
import { tr as t } from '../../i18n/translate.js';

/** Entries in one area as tappable cards (tap to edit). */
export default function EntryList({ items, rates, canCopy, canMove = true, readOnly = false, onEdit, onDelete, onCopy, onMove }) {
  return (
    <Paper variant="outlined" sx={{ overflow: 'hidden' }}>
      {items.map((item, index) => {
        const rate = resolveRate(item, rates);
        return (
          <Box key={item.id} sx={{ display: 'flex', alignItems: 'center', borderTop: index ? 1 : 0, borderColor: 'divider' }}>
            <CardActionArea component={readOnly ? 'div' : 'button'} disableRipple={readOnly} onClick={readOnly ? undefined : () => onEdit(item)} sx={{ px: 1.25, py: 1, flex: 1, minWidth: 0, cursor: readOnly ? 'default' : 'pointer' }}>
              <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between', alignItems: 'baseline' }}>
                <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>{rate.name}{item.note ? <Typography component="span" variant="caption" color="text.secondary">{` · ${item.note}`}</Typography> : null}</Typography>
                <Typography variant="body2" color="primary" sx={{ whiteSpace: 'nowrap', fontWeight: 700 }}>
                  {formatCurrency(getLineAmount(item, rate))}
                </Typography>
              </Stack>
              <Typography variant="caption" color="text.secondary" component="div" noWrap>
                {describeMeasurement(item, rate)} · {formatQuantity(getItemQuantity(item, rate), rate.type)} {rate.unit} × {formatCurrency(rate.rate)}
              </Typography>
            </CardActionArea>
            {!readOnly && <Box sx={{ pr: 0.25 }}>
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
            </Box>}
          </Box>
        );
      })}
    </Paper>
  );
}

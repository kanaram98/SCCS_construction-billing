import Paper from '@mui/material/Paper';
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableHead from '@mui/material/TableHead';
import TableRow from '@mui/material/TableRow';
import Typography from '@mui/material/Typography';
import EditIcon from '@mui/icons-material/EditOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutlined';
import Chip from '@mui/material/Chip';
import RestoreIcon from '@mui/icons-material/Restore';
import ArchiveIcon from '@mui/icons-material/ArchiveOutlined';
import { ActionMenu } from '../../components/ui';
import { formatCurrency } from '../../domain/formatters.js';
import { measurementTypeLabel } from '../../domain/rates.js';
import { tr as t } from '../../i18n/translate.js';

/** Read-only list of work items; tap a row to edit it. */
export default function RatesTable({ rates, onEdit, onRemove, onRestore, usage = () => 0 }) {
  const readOnly = !onEdit; // the contractor can add rates but not change them
  return (
    <TableContainer component={Paper} variant="outlined">
      <Table size="small" aria-label={t('Work item rates')}>
        <TableHead>
          <TableRow sx={{ '& th': { fontWeight: 700, color: 'text.secondary', bgcolor: 'action.hover' } }}>
            <TableCell>{t('Work item')}</TableCell>
            <TableCell>{t('Unit')}</TableCell>
            <TableCell align="right">{t('Rate')}</TableCell>
            <TableCell padding="none" sx={{ width: 40 }} aria-label={t('Actions')} />
          </TableRow>
        </TableHead>
        <TableBody>
          {rates.map((rate) => (
            <TableRow key={rate.id} hover={!readOnly} onClick={readOnly ? undefined : () => onEdit(rate)} sx={{ cursor: readOnly ? 'default' : 'pointer', '&:last-child td': { border: 0 } }}>
              <TableCell sx={{ py: 1.25 }}>
                <Typography variant="body2" sx={{ fontWeight: 600, opacity: rate.archived ? 0.6 : 1 }}>{rate.name || t('Untitled')} {rate.archived && <Chip size="small" variant="outlined" label={t('Retired')} />}</Typography>
                <Typography variant="caption" color="text.secondary">{t(measurementTypeLabel(rate.type))}</Typography>
              </TableCell>
              <TableCell>{rate.unit}</TableCell>
              <TableCell align="right" sx={{ whiteSpace: 'nowrap', fontWeight: 600 }}>{formatCurrency(rate.rate)}</TableCell>
              <TableCell padding="none" onClick={(event) => event.stopPropagation()}>
                {!readOnly && <ActionMenu
                  size="small"
                  label={t('Actions for {name}', { name: rate.name })}
                  items={[
                    { label: t('Edit'), icon: <EditIcon fontSize="small" />, onClick: () => onEdit(rate) },
                    { label: t('Bring back'), icon: <RestoreIcon fontSize="small" />, onClick: () => onRestore(rate), hidden: !rate.archived },
                    { label: usage(rate) ? t('Retire') : t('Delete'), icon: usage(rate) ? <ArchiveIcon fontSize="small" /> : <DeleteIcon fontSize="small" />, onClick: () => onRemove(rate), danger: true, hidden: Boolean(rate.archived), disabled: rates.filter((entry) => !entry.archived).length < 2 }
                  ]}
                />}
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

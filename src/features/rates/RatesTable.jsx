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
import { ActionMenu } from '../../components/ui';
import { formatCurrency } from '../../domain/formatters.js';
import { measurementTypeLabel } from '../../domain/rates.js';

/** Read-only list of work items; tap a row to edit it. */
export default function RatesTable({ rates, onEdit, onRemove }) {
  return (
    <TableContainer component={Paper} variant="outlined">
      <Table size="small" aria-label="Work item rates">
        <TableHead>
          <TableRow sx={{ '& th': { fontWeight: 700, color: 'text.secondary', bgcolor: 'action.hover' } }}>
            <TableCell>Work item</TableCell>
            <TableCell>Unit</TableCell>
            <TableCell align="right">Rate</TableCell>
            <TableCell padding="none" sx={{ width: 40 }} aria-label="Actions" />
          </TableRow>
        </TableHead>
        <TableBody>
          {rates.map((rate) => (
            <TableRow key={rate.id} hover onClick={() => onEdit(rate)} sx={{ cursor: 'pointer', '&:last-child td': { border: 0 } }}>
              <TableCell sx={{ py: 1.25 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>{rate.name || 'Untitled'}</Typography>
                <Typography variant="caption" color="text.secondary">{measurementTypeLabel(rate.type)}</Typography>
              </TableCell>
              <TableCell>{rate.unit}</TableCell>
              <TableCell align="right" sx={{ whiteSpace: 'nowrap', fontWeight: 600 }}>{formatCurrency(rate.rate)}</TableCell>
              <TableCell padding="none" onClick={(event) => event.stopPropagation()}>
                <ActionMenu
                  size="small"
                  label={`Actions for ${rate.name}`}
                  items={[
                    { label: 'Edit', icon: <EditIcon fontSize="small" />, onClick: () => onEdit(rate) },
                    { label: 'Delete', icon: <DeleteIcon fontSize="small" />, onClick: () => onRemove(rate), danger: true, disabled: rates.length < 2 }
                  ]}
                />
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

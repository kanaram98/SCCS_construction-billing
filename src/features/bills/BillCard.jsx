import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import EditIcon from '@mui/icons-material/EditOutlined';
import DeleteIcon from '@mui/icons-material/DeleteOutlined';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import ReceiptLongIcon from '@mui/icons-material/ReceiptLong';
import PostAddIcon from '@mui/icons-material/PostAdd';
import LinkIcon from '@mui/icons-material/AddLinkOutlined';
import CancelIcon from '@mui/icons-material/CancelOutlined';
import RouteIcon from '@mui/icons-material/AltRoute';
import TuneIcon from '@mui/icons-material/Tune';
import RequestQuoteIcon from '@mui/icons-material/RequestQuoteOutlined';
import CheckIcon from '@mui/icons-material/CheckCircleOutlined';
import UndoIcon from '@mui/icons-material/Undo';
import SendIcon from '@mui/icons-material/SendOutlined';
import LockOpenIcon from '@mui/icons-material/LockOpen';
import RestoreIcon from '@mui/icons-material/Restore';
import PrintIcon from '@mui/icons-material/Print';
import Button from '@mui/material/Button';
import { ActionMenu } from '../../components/ui';
import { stageLabel } from './stageText.js';
import { formatCurrency } from '../../domain/formatters.js';
import { paymentStatusLabel } from '../../domain/calculations.js';
import { billLabel, isEstimate } from '../../domain/bill-kinds.js';
import { billStatus, deleteBlocker, lockState } from '../../domain/bill-guard.js';
import { tr as t } from '../../i18n/translate.js';

const STATUS_COLORS = { paid: 'success', partial: 'warning', unpaid: 'default' };

/**
 * One bill or estimate in a list. Tap the card to open it; everything else (details, quotation, stage
 * changes, cancel, print…) is in its ⋮ menu. `ops` comes from useBillOperations().cardProps(bill).
 */
export default function BillCard({ bill, summary, selected, note, ops }) {
  const state = lockState(bill);
  const status = billStatus(bill);
  const removable = ops.canDelete ?? !deleteBlocker(bill);
  const estimate = isEstimate(bill);
  const unlinked = !bill.projectId && !bill.isSample;
  const cancelled = state === 'cancelled';
  return (
    <Card
      sx={{
        mb: 1.25,
        display: 'flex',
        flexWrap: 'wrap',
        alignItems: 'stretch',
        borderLeft: selected ? 4 : 1,
        borderLeftColor: selected ? 'secondary.main' : 'divider'
      }}
    >
      <CardActionArea onClick={ops.onOpen} sx={{ p: 1.75, flex: 1, minWidth: 0 }}>
        <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="subtitle1" noWrap sx={cancelled ? { textDecoration: 'line-through', opacity: 0.7 } : undefined}>{billLabel(bill, t)} · {bill.projectName || t('Untitled project')}</Typography>
            {bill.name && <Typography variant="body2" noWrap sx={{ fontWeight: 600 }}>{bill.name}</Typography>}
            <Typography variant="body2" color="text.secondary" noWrap>{bill.client || t('No client')} · {bill.date}</Typography>
          </Box>
          <Typography variant="subtitle1" color="primary" sx={{ whiteSpace: 'nowrap' }}>
            {formatCurrency(summary.totals.total)}
          </Typography>
        </Stack>
        <Stack direction="row" spacing={0.75} sx={{ mt: 1, flexWrap: 'wrap', rowGap: 0.75 }}>
          <Chip size="small" color={cancelled ? 'error' : state === 'submitted' ? 'success' : state === 'ready' ? 'warning' : 'default'} variant={state ? 'filled' : 'outlined'} label={t(stageLabel(bill))} />
          {bill.quotationLabel && <Chip size="small" variant="outlined" label={bill.quotationLabel} />}
          {estimate ? (
            note && <Chip size="small" variant="outlined" color="success" label={note} />
          ) : state === '' ? null : (
            <Chip
              size="small"
              label={t(paymentStatusLabel(summary.status))}
              color={STATUS_COLORS[summary.status]}
              variant={summary.status === 'unpaid' ? 'outlined' : 'filled'}
            />
          )}
          {unlinked && <Chip size="small" variant="outlined" color="warning" label={t('No project linked')} />}
        </Stack>
      </CardActionArea>
      <Box sx={{ display: 'flex', alignItems: 'flex-start', pt: 0.5, pr: 0.5 }}>
        <ActionMenu
          label={t('Actions for bill {number}', { number: bill.number })}
          items={[
            { label: t('Edit details'), icon: <TuneIcon fontSize="small" />, onClick: ops.onDetails },
            { label: t('Link to a project'), icon: <LinkIcon fontSize="small" />, onClick: ops.onLinkProject, hidden: !unlinked },
            { label: t('Attach quotation'), icon: <RequestQuoteIcon fontSize="small" />, onClick: ops.onAttachQuotation, hidden: status !== 'draft' || cancelled },
            { label: estimate ? t('Mark final') : t('Mark ready'), icon: <CheckIcon fontSize="small" />, onClick: ops.onMarkReady, hidden: status !== 'draft' || cancelled },
            { label: t('Submit'), icon: <SendIcon fontSize="small" />, onClick: ops.onSubmit, hidden: estimate || status !== 'ready' || cancelled },
            { label: t('Back to draft'), icon: <UndoIcon fontSize="small" />, onClick: ops.onBackToDraft, hidden: status !== 'ready' || cancelled || !ops.canDraft },
            { label: t('Reopen'), icon: <LockOpenIcon fontSize="small" />, onClick: ops.onReopen, hidden: status !== 'submitted' || cancelled || !ops.admin },
            { label: t('Restore bill'), icon: <RestoreIcon fontSize="small" />, onClick: ops.onRestore, hidden: !cancelled || !ops.canCancel },
            { label: t('Convert to bill'), icon: <ReceiptLongIcon fontSize="small" />, onClick: ops.onConvert, hidden: !estimate || status !== 'ready' },
            { label: t('Next running bill'), icon: <PostAddIcon fontSize="small" />, onClick: ops.onNextRunningBill, hidden: !ops.canNextRunning },
            { label: t('Make a running bill of…'), icon: <RouteIcon fontSize="small" />, onClick: ops.onMove, hidden: estimate || !ops.canMove || !bill.projectId || Boolean(bill.raSeriesId) },
            { label: t('Payment reminder'), icon: <WhatsAppIcon fontSize="small" />, onClick: ops.onRemind, hidden: estimate || status !== 'ready' || !(summary.totals.balance > 0) },
            { label: t('Running bills of this work'), icon: <RouteIcon fontSize="small" />, onClick: ops.onTrail, hidden: !bill.raSeriesId },
            { label: t('Print / PDF'), icon: <PrintIcon fontSize="small" />, onClick: ops.onPrint },
            { label: t('Rename'), icon: <EditIcon fontSize="small" />, onClick: ops.onRename, hidden: state === 'submitted' || cancelled },
            { label: t('Duplicate'), icon: <ContentCopyIcon fontSize="small" />, onClick: ops.onDuplicate },
            { label: t('Delete'), icon: <DeleteIcon fontSize="small" />, onClick: ops.onDelete, danger: true, hidden: !removable },
            { label: t('Cancel bill'), icon: <CancelIcon fontSize="small" />, onClick: ops.onCancel, danger: true, hidden: removable || !ops.canCancel || cancelled }
          ]}
        />
      </Box>
      {unlinked && (
        <Box sx={{ width: '100%', px: 1, pb: 0.75 }}>
          <Button size="small" color="warning" startIcon={<LinkIcon />} onClick={ops.onLinkProject}>{t('Link to a project')}</Button>
        </Box>
      )}
    </Card>
  );
}

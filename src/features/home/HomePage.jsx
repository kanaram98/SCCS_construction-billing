import { useMemo } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Chip from '@mui/material/Chip';
import Grid from '@mui/material/Grid';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import RequestQuoteIcon from '@mui/icons-material/RequestQuoteOutlined';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import WarningIcon from '@mui/icons-material/WarningAmber';
import { useBilling } from '../../state/BillingContext.jsx';
import { useWhatsAppReminder } from '../../hooks/useWhatsAppReminder.js';
import { getDashboardSummary, OVERDUE_DAYS } from '../../domain/dashboard.js';
import { billLabel, isEstimate } from '../../domain/bill-kinds.js';
import { getBillTotals } from '../../domain/calculations.js';
import { formatCurrency, todayIso } from '../../domain/formatters.js';
import { VIEWS } from '../../config/app.js';
import { tr as t, trn } from '../../i18n/translate.js';
import BackupReminder from '../backup/BackupReminder.jsx';
import RemindersCard from './RemindersCard.jsx';

/** A KPI tile: label, big value, optional small note. */
function Kpi({ label, value, note, color = 'primary' }) {
  return (
    <Card sx={{ height: '100%' }}>
      <CardContent sx={{ p: 1.75, '&:last-child': { pb: 1.75 } }}>
        <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>{label}</Typography>
        <Typography variant="h6" color={color} noWrap sx={{ mt: 0.25 }}>{value}</Typography>
        {note && <Typography variant="caption" color="text.secondary" component="div" noWrap>{note}</Typography>}
      </CardContent>
    </Card>
  );
}

/** Card with a heading and a short list. */
function ListCard({ title, icon, children }) {
  return (
    <Card sx={{ mb: 2 }}>
      <CardContent sx={{ pb: 1, '&:last-child': { pb: 1 } }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.5 }}>
          {icon}
          <Typography variant="subtitle1">{title}</Typography>
        </Stack>
        {children}
      </CardContent>
    </Card>
  );
}

export default function HomePage({ onNavigate }) {
  const { data, actions } = useBilling();
  const reminder = useWhatsAppReminder();
  const summary = useMemo(() => getDashboardSummary(data.bills, data.rates), [data.bills, data.rates]);
  const firmName = String(data.firm.name || '').trim();

  function openBill(billId) {
    actions.bills.open(billId);
    onNavigate(VIEWS.entry);
  }

  function create(kind) {
    onNavigate(VIEWS.bills, { newBill: kind }); // the project is chosen first
  }

  return (
    <section>
      <Box sx={{ mb: 2 }}>
        <Typography variant="h5" component="h1">{firmName ? t('Namaste, {name}', { name: firmName }) : t('Namaste')}</Typography>
        <Typography variant="body2" color="text.secondary">{new Date(`${todayIso()}T00:00:00`).toLocaleDateString(undefined, { weekday: 'long', day: 'numeric', month: 'long' })}</Typography>
      </Box>

      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
        <Button fullWidth size="large" variant="contained" startIcon={<AddIcon />} onClick={() => create('bill')}>{t('New bill')}</Button>
        <Button fullWidth size="large" variant="outlined" startIcon={<RequestQuoteIcon />} onClick={() => create('estimate')}>{t('New estimate')}</Button>
      </Stack>

      <BackupReminder />
      <RemindersCard onNavigate={onNavigate} />

      <Grid container spacing={1.25} sx={{ mb: 1.5 }}>
        <Grid size={6}><Kpi label={t('Outstanding')} value={formatCurrency(summary.outstanding)} color="warning.dark" note={trn(summary.unpaidCount + summary.partialCount, '{count} bill to collect', '{count} bills to collect')} /></Grid>
        <Grid size={6}><Kpi label={t('Received')} value={formatCurrency(summary.totalReceived)} color="success.main" note={t('This month: {amount}', { amount: formatCurrency(summary.receivedThisMonth) })} /></Grid>
        <Grid size={6}><Kpi label={t('Total billed')} value={formatCurrency(summary.totalBilled)} note={trn(summary.billCount, '{count} bill', '{count} bills')} /></Grid>
        <Grid size={6}><Kpi label={t('Billed this month')} value={formatCurrency(summary.billedThisMonth)} /></Grid>
        <Grid size={12}><Kpi label={t('Open estimates')} value={formatCurrency(summary.openEstimateValue)} note={trn(summary.openEstimateCount, '{count} estimate not yet converted', '{count} estimates not yet converted')} color="info.main" /></Grid>
      </Grid>

      <Stack direction="row" spacing={1} sx={{ mb: 2, flexWrap: 'wrap', rowGap: 1 }}>
        <Chip variant="outlined" label={`${t('Unpaid')}: ${summary.unpaidCount}`} />
        <Chip color="warning" label={`${t('Partially paid')}: ${summary.partialCount}`} />
        <Chip color="success" label={`${t('Paid')}: ${summary.paidCount}`} />
      </Stack>

      {summary.overdue.length > 0 && (
        <ListCard title={t('Overdue payments')} icon={<WarningIcon color="warning" fontSize="small" />}>
          <Typography variant="caption" color="text.secondary">{t('Balance still due more than {days} days after the bill date.', { days: OVERDUE_DAYS })}</Typography>
          <List dense disablePadding>
            {summary.overdue.slice(0, 5).map(({ bill, balance, days }) => (
              <ListItem
                key={bill.id}
                disablePadding
                secondaryAction={(
                  <IconButton aria-label={t('Remind on WhatsApp')} onClick={() => reminder.remind(bill)} sx={{ color: '#128C7E' }}>
                    <WhatsAppIcon />
                  </IconButton>
                )}
              >
                <ListItemButton onClick={() => openBill(bill.id)} sx={{ pr: 7 }}>
                  <ListItemText
                    primary={`${bill.client || t('No client')} · ${formatCurrency(balance)}`}
                    secondary={`${billLabel(bill, t)} · ${trn(days, '{count} day ago', '{count} days ago')}`}
                  />
                </ListItemButton>
              </ListItem>
            ))}
          </List>
        </ListCard>
      )}

      {summary.topClients.length > 0 && (
        <ListCard title={t('Clients with dues')}>
          <List dense disablePadding>
            {summary.topClients.map((client) => (
              <ListItem key={client.client} disableGutters>
                <ListItemText primary={client.client} secondary={trn(client.bills, '{count} bill', '{count} bills')} />
                <Typography variant="subtitle2" color="warning.dark">{formatCurrency(client.balance)}</Typography>
              </ListItem>
            ))}
          </List>
        </ListCard>
      )}

      <ListCard title={t('Recent')}>
        {summary.recent.length ? (
          <List dense disablePadding>
            {summary.recent.map((bill) => (
              <ListItemButton key={bill.id} onClick={() => openBill(bill.id)} sx={{ px: 1 }}>
                <ListItemText
                  primary={`${billLabel(bill, t)} · ${bill.projectName || t('Untitled project')}`}
                  secondary={`${bill.client || t('No client')} · ${bill.date}`}
                />
                <Typography variant="subtitle2" color={isEstimate(bill) ? 'info.main' : 'primary'} sx={{ whiteSpace: 'nowrap', ml: 1 }}>
                  {formatCurrency(getBillTotals(bill, data.rates).total)}
                </Typography>
              </ListItemButton>
            ))}
          </List>
        ) : <Typography variant="body2" color="text.secondary">{t('No bills yet.')}</Typography>}
        <Button fullWidth onClick={() => onNavigate(VIEWS.bills)} sx={{ mt: 0.5 }}>{t('See all bills')}</Button>
      </ListCard>
    </section>
  );
}

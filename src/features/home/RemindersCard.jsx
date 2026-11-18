import { useMemo, useState } from 'react';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardContent from '@mui/material/CardContent';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import NotificationsIcon from '@mui/icons-material/NotificationsActiveOutlined';
import { useBilling } from '../../state/BillingContext.jsx';
import { VIEWS } from '../../config/app.js';
import { buildReminders } from '../../domain/reminders.js';
import { localToday, monthLabel } from '../../domain/labour.js';
import { getLanguage, tr as t, trn } from '../../i18n/translate.js';

const KEY = 'reminders_snoozed';

function readSnoozed(today) {
  try {
    const saved = JSON.parse(window.localStorage.getItem(KEY) || '{}');
    return saved.day === today ? saved.ids || [] : [];
  } catch { return []; }
}

/** "To do today": attendance not filled, bills with no project, last month not closed. "Later" hides one for today. */
export default function RemindersCard({ onNavigate }) {
  const { data } = useBilling();
  const today = localToday();
  const [snoozed, setSnoozed] = useState(() => readSnoozed(today));
  const reminders = useMemo(() => buildReminders({ bills: data.bills, labour: data.labour }, today).filter((item) => !snoozed.includes(item.id)), [data.bills, data.labour, today, snoozed]);
  if (!reminders.length) return null;

  function later(id) {
    const next = [...snoozed, id];
    setSnoozed(next);
    try { window.localStorage.setItem(KEY, JSON.stringify({ day: today, ids: next })); } catch { /* snoozing is optional */ }
  }

  const describe = {
    attendance: (item) => ({
      text: t('Attendance is not marked today for {missing} of {total} workers.', { missing: item.count, total: item.of }),
      action: t('Mark attendance'), go: () => onNavigate(VIEWS.labour)
    }),
    unlinked: (item) => ({
      text: trn(item.count, '{count} bill is not linked to a project, so reports leave it out.', '{count} bills are not linked to a project, so reports leave them out.'),
      action: t('Open Bills'), go: () => onNavigate(VIEWS.bills)
    }),
    monthOpen: (item) => ({
      text: t('{month} is not closed yet. Check the wages, then close it.', { month: monthLabel(item.month, getLanguage()) }),
      action: t('Open Labour'), go: () => onNavigate(VIEWS.labour)
    })
  };

  return (
    <Card sx={{ mb: 2, borderColor: 'warning.main' }} variant="outlined">
      <CardContent sx={{ pb: 1, '&:last-child': { pb: 1 } }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 0.5 }}>
          <NotificationsIcon color="warning" />
          <Typography variant="subtitle1">{t('To do today')}</Typography>
        </Stack>
        {reminders.map((item) => {
          const view = describe[item.id](item);
          return (
            <Stack key={item.id} direction="row" spacing={1} sx={{ alignItems: 'center', py: 0.75, borderTop: 1, borderColor: 'divider' }}>
              <Typography variant="body2" sx={{ flex: 1 }}>{view.text}</Typography>
              <Button size="small" variant="outlined" onClick={view.go}>{view.action}</Button>
              <Button size="small" color="inherit" onClick={() => later(item.id)} aria-label={t('Later: {text}', { text: view.text })}>{t('Later')}</Button>
            </Stack>
          );
        })}
      </CardContent>
    </Card>
  );
}

import Box from '@mui/material/Box';
import Card from '@mui/material/Card';
import ButtonBase from '@mui/material/ButtonBase';
import Stack from '@mui/material/Stack';
import IconButton from '@mui/material/IconButton';
import Typography from '@mui/material/Typography';
import DeleteIcon from '@mui/icons-material/DeleteOutlined';
import { EmptyState } from '../../components/ui';
import { dayLabel } from '../../domain/labour.js';
import { formatCurrency } from '../../domain/formatters.js';
import { EXPENSE_CATEGORIES, projectName } from '../../domain/projects.js';
import { getLanguage, tr as t } from '../../i18n/translate.js';

/**
 * Expenses as a daily table, newest day first: each day with its total. `onOpen(expense)` makes rows tappable.
 * `onDelete(expense)` / `onDeleteDay(day)` add a bin icon to each row / each day (shown where `canDelete(expense)` is true).
 */
export default function ExpenseDays({ days, projects, showProject = false, onOpen, onDelete, onDeleteDay, canDelete = () => true }) {
  if (!days.length) {
    return <EmptyState title={t('No expenses')} description={t('Food, travel and other site spending you add will be listed here day by day.')} compact />;
  }
  return (
    <>
      {[...days].reverse().map((day) => (
        <Card key={day.date} sx={{ mb: 1.5 }}>
          <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'baseline', px: 1.75, py: 1, bgcolor: 'action.hover' }}>
            <Typography variant="subtitle2">{dayLabel(day.date, getLanguage())}</Typography>
            <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center' }}>
              <Typography variant="subtitle2" color="primary">{formatCurrency(day.total)}</Typography>
              {onDeleteDay && day.items.every(canDelete) && (
                <IconButton size="small" color="error" onClick={() => onDeleteDay(day)} aria-label={t('Delete all expenses of {date}', { date: dayLabel(day.date, getLanguage()) })}><DeleteIcon fontSize="small" /></IconButton>
              )}
            </Stack>
          </Stack>
          {day.items.map((expense) => (
            <Stack key={expense.id} direction="row" sx={{ alignItems: 'center', borderTop: 1, borderColor: 'divider' }}>
            <ButtonBase
              component="div"
              disabled={!onOpen}
              onClick={onOpen ? () => onOpen(expense) : undefined}
              aria-label={onOpen ? t('Open expense {amount}', { amount: formatCurrency(expense.amount) }) : undefined}
              sx={{ display: 'flex', width: '100%', justifyContent: 'space-between', alignItems: 'flex-start', textAlign: 'left', px: 1.75, py: 1, gap: 1, flex: 1, minWidth: 0 }}
            >
              <Box sx={{ minWidth: 0 }}>
                <Typography variant="body2" sx={{ fontWeight: 600 }}>{t(EXPENSE_CATEGORIES[expense.category] || expense.category)}</Typography>
                {(expense.note || showProject) && (
                  <Typography variant="caption" color="text.secondary" component="div" sx={{ wordBreak: 'break-word' }}>
                    {[showProject && projectName(projects, expense.projectId), expense.note].filter(Boolean).join(' · ')}
                  </Typography>
                )}
              </Box>
              <Typography variant="body2" sx={{ fontWeight: 600, whiteSpace: 'nowrap' }}>{formatCurrency(expense.amount)}</Typography>
            </ButtonBase>
            {onDelete && canDelete(expense) && (
              <IconButton size="small" color="error" onClick={() => onDelete(expense)} aria-label={t('Delete expense {amount}', { amount: formatCurrency(expense.amount) })} sx={{ mr: 0.75 }}><DeleteIcon fontSize="small" /></IconButton>
            )}
            </Stack>
          ))}
        </Card>
      ))}
    </>
  );
}

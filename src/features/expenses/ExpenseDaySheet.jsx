import Button from '@mui/material/Button';
import { ResponsiveDialog } from '../../components/ui';
import { dayLabel } from '../../domain/labour.js';
import { getLanguage, tr as t } from '../../i18n/translate.js';
import ExpenseDays from './ExpenseDays.jsx';

/** One day's expenses: tap one to edit, or add another for that day. */
export default function ExpenseDaySheet({ day, projects, showProject, onOpen, onAdd, onClose }) {
  return (
    <ResponsiveDialog open={Boolean(day)} title={day ? dayLabel(day.date, getLanguage()) : ''} onClose={onClose} maxWidth="xs">
      {day && (
        <>
          <ExpenseDays days={[day]} projects={projects} showProject={showProject} onOpen={onOpen} />
          <Button fullWidth variant="outlined" onClick={() => onAdd(day.date)} sx={{ mb: 1 }}>{t('Add expense')}</Button>
          <Button fullWidth variant="contained" onClick={onClose}>{t('Done')}</Button>
        </>
      )}
    </ResponsiveDialog>
  );
}

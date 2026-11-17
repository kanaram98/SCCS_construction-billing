import { useMemo, useRef } from 'react';
import { useBilling } from '../../state/BillingContext.jsx';
import { useConfirm } from '../../components/ui';
import { dayLabel, isMonthClosed, liveLabour, localToday, monthLabel, shiftDate } from '../../domain/labour.js';
import { getLanguage, tr as t } from '../../i18n/translate.js';

/** Attendance older than this many days asks for confirmation before changing. */
export const OLD_ATTENDANCE_DAYS = 7;

/**
 * Labour data for screens: `labour` without deleted items, `raw` with them
 * (history, recycle bin), and the labour actions.
 */
export function useLabour() {
  const { data, actions } = useBilling();
  const labour = useMemo(() => liveLabour(data.labour), [data.labour]);
  return { labour, raw: data.labour, firm: data.firm, actions: actions.labour };
}

/**
 * Asks once per date before changing attendance older than OLD_ATTENDANCE_DAYS.
 * `allow(date)` resolves true when the change may go ahead.
 */
export function useOldDateGuard() {
  const confirm = useConfirm();
  const confirmed = useRef(new Set());
  return async function allow(date) {
    if (date >= shiftDate(localToday(), -OLD_ATTENDANCE_DAYS) || confirmed.current.has(date)) return true;
    const ok = await confirm({
      title: t('Change old attendance?'),
      message: t('{date} is more than {days} days ago. Wages for that day may already be paid. Change it anyway?', { date: dayLabel(date, getLanguage()), days: OLD_ATTENDANCE_DAYS }),
      confirmLabel: t('Change')
    });
    if (ok) confirmed.current.add(date);
    return ok;
  };
}

/** Close / unlock a month, with confirmation. */
export function useMonthLock() {
  const { raw, actions } = useLabour();
  const confirm = useConfirm();
  return {
    isClosed: (month) => isMonthClosed(raw, month),
    async close(month) {
      const ok = await confirm({
        title: t('Close {month}?', { month: monthLabel(month, getLanguage()) }),
        message: t('Do this after paying the month’s wages. Attendance and payments of this month will be locked so they can’t be changed by mistake. You can unlock it later.'),
        confirmLabel: t('Close month')
      });
      if (ok) actions.closeMonth(month);
      return ok;
    },
    async unlock(month) {
      const ok = await confirm({
        title: t('Unlock {month}?', { month: monthLabel(month, getLanguage()) }),
        message: t('Changes after unlocking may not match sheets already shared with workers. Every change is kept in History.'),
        confirmLabel: t('Unlock'),
        danger: true
      });
      if (ok) actions.unlockMonth(month);
      return ok;
    }
  };
}

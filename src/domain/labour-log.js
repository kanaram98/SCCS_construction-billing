/**
 * Turns activity-log entries into readable lines for the History screen,
 * e.g. "Attendance · Tue, 4 Nov" / "Ramesh: 1P → A".
 */
import { formatCurrency } from './formatters.js';
import { PAYMENT_MODES } from './payments.js';
import { dayLabel, markLabel, monthLabel } from './labour.js';

export const LOG_TITLES = {
  'worker.create': 'Worker added',
  'worker.update': 'Worker details changed',
  'worker.delete': 'Worker deleted',
  'worker.restore': 'Worker restored',
  'worker.purge': 'Worker deleted forever',
  'payment.create': 'Payment added',
  'payment.update': 'Payment changed',
  'payment.delete': 'Payment deleted',
  'payment.restore': 'Payment restored',
  'payment.purge': 'Payment deleted forever',
  'payment.conflict': 'Changed on another device',
  'worker.conflict': 'Changed on another device',
  'month.close': 'Month closed',
  'month.unlock': 'Month unlocked'
};

const mark = (value, t) => (value ? markLabel(value.units) : t('not marked'));
const mode = (value, t) => t(PAYMENT_MODES[value] || 'Cash');

function paymentLine(payment, t) {
  return [formatCurrency(payment.amount), mode(payment.mode, t), payment.date, payment.note].filter(Boolean).join(' · ');
}

/** "₹2,000 → ₹1,500", "Cash → UPI" … for the fields that changed. */
function paymentChanges(before, after, t) {
  const lines = [];
  if (before.amount !== after.amount) lines.push(`${formatCurrency(before.amount)} → ${formatCurrency(after.amount)}`);
  if (before.date !== after.date) lines.push(`${t('Date')}: ${before.date} → ${after.date}`);
  if (before.mode !== after.mode) lines.push(`${mode(before.mode, t)} → ${mode(after.mode, t)}`);
  if (before.note !== after.note) lines.push(`${t('Description')}: ${before.note || '—'} → ${after.note || '—'}`);
  return lines;
}

function workerChanges(before, after, t) {
  const lines = [];
  if (before.name !== after.name) lines.push(`${before.name} → ${after.name}`);
  if (before.dailyWage !== after.dailyWage) lines.push(`${t('Daily wage')}: ${formatCurrency(before.dailyWage)} → ${formatCurrency(after.dailyWage)}`);
  if (before.role !== after.role) lines.push(`${t('Work')}: ${before.role || '—'} → ${after.role || '—'}`);
  if (before.phone !== after.phone) lines.push(`${t('Mobile')}: ${before.phone || '—'} → ${after.phone || '—'}`);
  if (before.active !== after.active) lines.push(after.active ? t('Marked as working') : t('Marked as left'));
  return lines;
}

/**
 * @returns {{ title: string, lines: string[], workerIds: string[] }}
 */
export function describeEntry(entry, { names, t, language = 'en' }) {
  const name = (id) => names.get(id) || t('Deleted worker');
  if (entry.entity === 'attendance') {
    const changes = entry.changes || [];
    return {
      title: t('Attendance · {date}', { date: dayLabel(entry.date, language) }),
      lines: changes.map((change) => `${name(change.workerId)}: ${mark(change.before, t)} → ${mark(change.after, t)}`),
      workerIds: changes.map((change) => change.workerId)
    };
  }
  const title = t(LOG_TITLES[`${entry.entity}.${entry.action}`] || 'Change');
  if (entry.entity === 'month') return { title: `${title}: ${monthLabel(entry.month, language)}`, lines: [], workerIds: [] };
  if (entry.entity === 'payment') {
    const lines = entry.action === 'update'
      ? paymentChanges(entry.before, entry.after, t)
      : [paymentLine(entry.after || entry.before, t)];
    if (entry.action === 'conflict') lines.push(t('The newer version was kept. Undo brings back the version from this device.'));
    return { title, lines: [name(entry.workerId), ...lines], workerIds: [entry.workerId] };
  }
  const lines = entry.action === 'update' ? workerChanges(entry.before, entry.after, t) : [];
  const worker = entry.after || entry.before || {};
  return {
    title,
    lines: [`${worker.name || name(entry.workerId)}${worker.dailyWage !== undefined && entry.action !== 'update' ? ` · ${formatCurrency(worker.dailyWage)}/day` : ''}`, ...lines],
    workerIds: [entry.workerId]
  };
}

/** Whether an entry involves a worker (for the per-worker history). */
export function entryInvolves(entry, workerId) {
  if (entry.entity === 'attendance') return (entry.changes || []).some((change) => change.workerId === workerId);
  return entry.workerId === workerId;
}

/** "17 Nov, 10:42 am". */
export function formatLogTime(at, language = 'en') {
  return new Date(at).toLocaleString(language === 'hi' ? 'hi-IN' : 'en-IN', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' });
}

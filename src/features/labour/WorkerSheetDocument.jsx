import { formatCurrency, todayIso } from '../../domain/formatters.js';
import { PAYMENT_MODES } from '../../domain/payments.js';
import { calendarWeeks, countedUnits, markLabel, monthLabel, registerCell, weekdayNames } from '../../domain/labour.js';
import Letterhead from '../print/preview/Letterhead.jsx';

/** Payments / advances table shared by the worker sheet and the full register. */
export function PaymentsTable({ payments, t, showName = false }) {
  if (!payments.length) return <p className="labour-legend">{t('No advances or payments this month.')}</p>;
  const total = payments.reduce((sum, payment) => sum + (Number(payment.amount) || 0), 0);
  return (
    <table className="labour-payments">
      <thead>
        <tr>
          <th>#</th><th>{t('Date')}</th>{showName && <th>{t('Name')}</th>}
          <th>{t('Description')}</th><th>{t('Paid by')}</th><th>{t('Amount')}</th>
        </tr>
      </thead>
      <tbody>
        {payments.map((payment, index) => (
          <tr key={payment.id}>
            <td>{index + 1}</td><td>{payment.date}</td>{showName && <td>{payment.workerName}</td>}
            <td>{payment.note || '—'}</td><td>{t(PAYMENT_MODES[payment.mode] || 'Cash')}</td><td>{formatCurrency(payment.amount)}</td>
          </tr>
        ))}
        <tr className="labour-total">
          <td colSpan={showName ? 5 : 4}>{t('Total')}</td><td>{formatCurrency(total)}</td>
        </tr>
      </tbody>
    </table>
  );
}

/**
 * One worker's attendance sheet for a month: calendar, mark counts, wages,
 * every advance / payment with date, mode and description, and signatures.
 * Made to be shared with that worker.
 */
export default function WorkerSheetDocument({ row, firm, t, language }) {
  const { worker } = row;
  const units = countedUnits(row.counts);
  const marksByDate = Object.fromEntries(row.marks.map((mark, index) => [`${row.month}-${String(index + 1).padStart(2, '0')}`, mark]));
  const balanceLabel = row.balance < 0 ? t('Advance to adjust') : t('Balance due');

  return (
    <article className="paper print-document worker-sheet" data-worker={worker.id} style={{ '--print-font-size': '9pt' }}>
      <header className="paper-header">
        <div className="paper-header-content">
          <Letterhead
            firm={firm}
            t={t}
            title={t('Attendance sheet')}
            meta={[monthLabel(row.month, language), t('Date: {date}', { date: todayIso() })]}
            billTo={{
              label: t('Worker'),
              lines: [
                worker.name,
                [worker.role, t('{amount}/day', { amount: formatCurrency(worker.dailyWage) })].filter(Boolean).join(' · '),
                worker.phone && `☎ ${worker.phone}`
              ]
            }}
          />
        </div>
      </header>

      <table className="worker-calendar">
        <thead>
          <tr>{weekdayNames(language).map((name, index) => <th key={index}>{name}</th>)}</tr>
        </thead>
        <tbody>
          {calendarWeeks(row.month).map((week, index) => (
            <tr key={index}>
              {week.map((date, cellIndex) => {
                if (!date) return <td key={cellIndex} className="cell-blank" />;
                const cell = registerCell(marksByDate[date]);
                return (
                  <td key={date} className={cell === 'A' ? 'cell-absent' : undefined}>
                    <span className="day">{Number(date.slice(8))}</span>
                    <span className="mark">{cell === 'A' || !cell ? cell : `${cell}P`}</span>
                  </td>
                );
              })}
            </tr>
          ))}
        </tbody>
      </table>

      <table className="labour-summary">
        <thead>
          <tr>
            {units.map((value) => <th key={value} className={value === 0 ? 'cell-absent' : undefined}>{markLabel(value)}</th>)}
            <th>{t('Days present')}</th><th>{t('Total P')}</th>
          </tr>
        </thead>
        <tbody>
          <tr>
            {units.map((value) => <td key={value}>{row.counts[value] || 0}</td>)}
            <td>{row.days}</td><td><strong>{row.units}</strong></td>
          </tr>
        </tbody>
      </table>

      <table className="worker-amounts">
        <tbody>
          <tr><td>{t('Wages this month ({units})', { units: `${row.units}P` })}</td><td>{formatCurrency(row.earned)}</td></tr>
          <tr><td>{t('Previous balance')}</td><td>{formatCurrency(row.opening)}</td></tr>
          <tr><td>{t('Advances / payments this month')}</td><td>− {formatCurrency(row.paid)}</td></tr>
          <tr className="labour-total"><td>{balanceLabel}</td><td>{formatCurrency(Math.abs(row.balance))}</td></tr>
        </tbody>
      </table>

      <h3 className="labour-heading">{t('Advances and payments')}</h3>
      <PaymentsTable payments={row.payments} t={t} />

      <footer className="labour-sign">
        <span className="labour-sign-box"><span>{t('Worker’s signature')}</span></span>
        <span className="labour-sign-box">
          {firm.signature && <img src={firm.signature} alt="" />}
          <span>{t('Contractor’s signature')}</span>
        </span>
      </footer>
    </article>
  );
}

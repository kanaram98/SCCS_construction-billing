import { formatCurrency, todayIso } from '../../domain/formatters.js';
import { daysOfMonth, monthLabel, registerCell } from '../../domain/labour.js';
import Letterhead from '../print/preview/Letterhead.jsx';

/**
 * Printable monthly labour register (muster roll) and wage summary.
 * Used for Hindi PDFs, which are made from this rendered page.
 */
export default function LabourReportDocument({ report, firm, t, language }) {
  const days = daysOfMonth(report.month);
  return (
    <article className="paper print-document labour-document" style={{ '--print-font-size': '8pt' }}>
      <header className="paper-header">
        <div className="paper-header-content">
          <Letterhead
            firm={firm}
            t={t}
            title={t('Labour attendance register')}
            meta={[monthLabel(report.month, language), t('Date: {date}', { date: todayIso() })]}
          />
        </div>
      </header>

      <table className="labour-register">
        <thead>
          <tr>
            <th>{t('Name')}</th>
            {days.map((date) => <th key={date}>{Number(date.slice(8))}</th>)}
            <th>P</th>
          </tr>
        </thead>
        <tbody>
          {report.rows.map((row) => (
            <tr key={row.workerId}>
              <td>{row.worker.name}</td>
              {row.marks.map((mark, index) => <td key={index}>{registerCell(mark)}</td>)}
              <td><strong>{row.units}</strong></td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3 className="labour-heading">{t('Wages')}</h3>
      <table>
        <thead>
          <tr>
            <th>{t('Name')}</th><th>{t('Days')}</th><th>P</th><th>{t('Wages')}</th>
            <th>{t('Previous')}</th><th>{t('Amount paid')}</th><th>{t('Balance')}</th>
          </tr>
        </thead>
        <tbody>
          {report.rows.map((row) => (
            <tr key={row.workerId}>
              <td>{row.worker.name}</td><td>{row.days}</td><td>{row.units}</td><td>{formatCurrency(row.earned)}</td>
              <td>{formatCurrency(row.opening)}</td><td>{formatCurrency(row.paid)}</td><td><strong>{formatCurrency(row.balance)}</strong></td>
            </tr>
          ))}
          <tr>
            <td colSpan={2}><strong>{t('Total')}</strong></td><td><strong>{report.totals.units}</strong></td>
            <td><strong>{formatCurrency(report.totals.earned)}</strong></td><td />
            <td><strong>{formatCurrency(report.totals.paid)}</strong></td><td><strong>{formatCurrency(report.totals.balance)}</strong></td>
          </tr>
        </tbody>
      </table>
      <p className="labour-legend">{t('A = absent, 1 = full day, 0.5 = half day, 2 = double')}</p>
    </article>
  );
}

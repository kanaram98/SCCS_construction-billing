import { formatCurrency, todayIso } from '../../domain/formatters.js';
import { countedUnits, daysOfMonth, markLabel, monthLabel, registerCell } from '../../domain/labour.js';
import Letterhead from '../print/preview/Letterhead.jsx';

/**
 * Printable monthly labour attendance sheet (muster roll) with the firm
 * letterhead, mark counts and wage summary. Shown as the Sheet preview, used
 * for browser printing and for Hindi PDFs.
 */
export default function LabourReportDocument({ report, firm, t, language }) {
  const days = daysOfMonth(report.month);
  const units = countedUnits(report.totals.counts);
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
              {row.marks.map((mark, index) => {
                const cell = registerCell(mark);
                return <td key={index} className={cell === 'A' ? 'cell-absent' : undefined}>{cell}</td>;
              })}
              <td><strong>{row.units}</strong></td>
            </tr>
          ))}
        </tbody>
      </table>

      <h3 className="labour-heading">{t('Attendance summary and wages')}</h3>
      <table className="labour-summary">
        <thead>
          <tr>
            <th>{t('Name')}</th>
            {units.map((value) => <th key={value} className={value === 0 ? 'cell-absent' : undefined}>{markLabel(value)}</th>)}
            <th>{t('Total P')}</th><th>{t('Wages')}</th><th>{t('Previous')}</th><th>{t('Amount paid')}</th><th>{t('Balance')}</th>
          </tr>
        </thead>
        <tbody>
          {report.rows.map((row) => (
            <tr key={row.workerId}>
              <td>{row.worker.name}</td>
              {units.map((value) => <td key={value}>{row.counts[value] || ''}</td>)}
              <td><strong>{row.units}</strong></td><td>{formatCurrency(row.earned)}</td>
              <td>{formatCurrency(row.opening)}</td><td>{formatCurrency(row.paid)}</td><td><strong>{formatCurrency(row.balance)}</strong></td>
            </tr>
          ))}
          <tr className="labour-total">
            <td>{t('Total')}</td>
            {units.map((value) => <td key={value}>{report.totals.counts[value] || ''}</td>)}
            <td>{report.totals.units}</td><td>{formatCurrency(report.totals.earned)}</td><td />
            <td>{formatCurrency(report.totals.paid)}</td><td>{formatCurrency(report.totals.balance)}</td>
          </tr>
        </tbody>
      </table>
      <p className="labour-legend">{t('A = absent, 1 = full day, 0.5 = half day, 2 = double')}</p>

      <footer className="labour-sign">
        <span>{t('Date: {date}', { date: '______________' })}</span>
        <span className="labour-sign-box">
          {firm.signature && <img src={firm.signature} alt="" />}
          <span>{t('Signature')}</span>
        </span>
      </footer>
    </article>
  );
}

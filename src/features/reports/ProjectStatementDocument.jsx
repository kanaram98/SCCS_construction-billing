import { formatCurrency, todayIso } from '../../domain/formatters.js';
import { periodText, statementTables } from '../../documents/statement-tables.js';
import Letterhead from '../print/preview/Letterhead.jsx';

/** Printable project statement with the firm letterhead (also rendered off screen for Hindi PDFs). */
export default function ProjectStatementDocument({ statement, firm, t }) {
  const tables = statementTables(statement, t, formatCurrency);
  const { project } = statement;
  return (
    <article className="paper print-document statement-document" style={{ '--print-font-size': '9pt' }}>
      <header className="paper-header">
        <div className="paper-header-content">
          <Letterhead
            firm={firm}
            t={t}
            title={t('Project statement')}
            meta={[project.name, periodText(statement.period, t), t('Date: {date}', { date: todayIso() })]}
            billTo={{ label: t('Client'), lines: [project.client, project.clientPhone, project.clientAddress, project.address && t('Site: {address}', { address: project.address })] }}
          />
        </div>
      </header>
      {tables.map((table) => (
        <section key={table.title} className="statement-section">
          <h4>{table.title}</h4>
          <table className="statement-table">
            <thead>
              <tr>{table.head.map((cell, index) => <th key={index} className={index >= table.numericFrom ? 'num' : undefined}>{cell}</th>)}</tr>
            </thead>
            <tbody>
              {table.rows.map((entry, index) => (
                <tr key={index} className={entry.bold ? 'statement-bold' : undefined}>
                  {entry.cells.map((cell, cellIndex) => <td key={cellIndex} className={cellIndex >= table.numericFrom ? 'num' : undefined}>{cell}</td>)}
                </tr>
              ))}
            </tbody>
          </table>
        </section>
      ))}
    </article>
  );
}

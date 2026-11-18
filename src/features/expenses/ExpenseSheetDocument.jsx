import { formatCurrency, todayIso } from '../../domain/formatters.js';
import { monthLabel } from '../../domain/labour.js';
import { EXPENSE_CATEGORIES, projectName, totalAmount } from '../../domain/projects.js';
import Letterhead from '../print/preview/Letterhead.jsx';

/**
 * Printable daily expense sheet with the firm letterhead. Rendered off screen and
 * used for Hindi PDFs (which are made from the rendered page).
 */
export default function ExpenseSheetDocument({ days, projects, projectLabel, showProject, month, firm, t, language }) {
  const total = totalAmount(days.flatMap((day) => day.items));
  return (
    <article className="paper print-document expense-document" style={{ '--print-font-size': '9pt' }}>
      <header className="paper-header">
        <div className="paper-header-content">
          <Letterhead
            firm={firm}
            t={t}
            title={t('Daily site expenses')}
            meta={[projectLabel, monthLabel(month, language), t('Date: {date}', { date: todayIso() })]}
          />
        </div>
      </header>
      <table className="expense-table">
        <thead>
          <tr>
            <th>{t('Date')}</th>
            {showProject && <th>{t('Project')}</th>}
            <th>{t('Category')}</th>
            <th>{t('Note')}</th>
            <th>{t('Amount')}</th>
          </tr>
        </thead>
        <tbody>
          {days.map((day) => (
            <DayRows key={day.date} day={day} projects={projects} showProject={showProject} t={t} />
          ))}
          <tr className="expense-grand">
            <td colSpan={showProject ? 4 : 3}>{t('Total')}</td>
            <td>{formatCurrency(total)}</td>
          </tr>
        </tbody>
      </table>
    </article>
  );
}

function DayRows({ day, projects, showProject, t }) {
  return (
    <>
      {day.items.map((expense, index) => (
        <tr key={expense.id}>
          <td>{index === 0 ? day.date : ''}</td>
          {showProject && <td>{projectName(projects, expense.projectId)}</td>}
          <td>{t(EXPENSE_CATEGORIES[expense.category] || expense.category)}</td>
          <td>{expense.note}</td>
          <td>{formatCurrency(expense.amount)}</td>
        </tr>
      ))}
      <tr className="expense-day-total">
        <td colSpan={showProject ? 4 : 3}>{t('Day total')}</td>
        <td>{formatCurrency(day.total)}</td>
      </tr>
    </>
  );
}

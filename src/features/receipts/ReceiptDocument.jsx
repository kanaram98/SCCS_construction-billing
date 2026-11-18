import { formatCurrency } from '../../domain/formatters.js';
import { receiptLines } from '../../domain/receipt.js';
import Letterhead from '../print/preview/Letterhead.jsx';

/** Printable payment receipt with the firm letterhead (also rendered for Hindi PDFs). */
export default function ReceiptDocument({ receipt, firm, t, language }) {
  return (
    <article className="paper print-document receipt-document" style={{ '--print-font-size': '10pt' }}>
      <header className="paper-header">
        <div className="paper-header-content">
          <Letterhead firm={firm} t={t} title={t('Payment receipt')} meta={[receipt.number, receipt.date]} />
        </div>
      </header>
      <table className="statement-table receipt-table">
        <tbody>
          {receiptLines(receipt, t, language, formatCurrency).map(([label, value]) => (
            <tr key={label}><th scope="row">{label}</th><td>{value}</td></tr>
          ))}
        </tbody>
      </table>
      <p className="receipt-thanks">{t('Thank you.')}</p>
      <div className="labour-sign">
        <span />
        <div className="labour-sign-box">
          {firm.signature && <img src={firm.signature} alt="" />}
          <span>{t('Authorised signatory')}</span>
        </div>
      </div>
    </article>
  );
}

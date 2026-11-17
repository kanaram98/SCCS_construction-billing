import { formatCurrency, todayIso } from '../../domain/formatters.js';
import { QUOTATION_COLUMNS, quotationRows, splitLines, validUntil } from '../../domain/quotation.js';

/**
 * Printable rate quotation (A4-style paper). `t` uses the bill language.
 * Rendered on screen as a preview and used for printing and Hindi PDFs.
 */
export default function QuotationDocument({ quotation, rates, firm, t, className = '' }) {
  const today = todayIso();
  const until = validUntil(quotation, today);
  const terms = splitLines(quotation.terms);
  const contact = [firm.phone, firm.gstRegistered && firm.gstin && t('GSTIN: {gstin}', { gstin: firm.gstin })].filter(Boolean).join(' · ');

  return (
    <article className={`paper print-document quotation-document ${className}`} style={{ '--print-font-size': '10pt' }}>
      <header className="paper-header">
        <div className="paper-header-content">
          <div className="paper-branding">
            <div>
              <h2>{firm.name || t('Firm name')}</h2>
              {firm.address && <div>{firm.address}</div>}
              {contact && <div>{contact}</div>}
            </div>
            {firm.logo && <img className="paper-logo" src={firm.logo} alt="" />}
          </div>
          <h3>{t(quotation.title || 'Rate quotation')}</h3>
          <div>
            {[
              quotation.clientName && t('To: {client}', { client: quotation.clientName }),
              t('Date: {date}', { date: today }),
              until && t('Valid until: {date}', { date: until })
            ].filter(Boolean).join(' · ')}
          </div>
        </div>
      </header>

      <table>
        <thead>
          <tr>{QUOTATION_COLUMNS.map((column) => <th key={column}>{t(column)}</th>)}</tr>
        </thead>
        <tbody>
          {quotationRows(rates, { t, money: formatCurrency }).map((cells, index) => (
            <tr key={index}>{cells.map((cell, cellIndex) => <td key={cellIndex}>{cell}</td>)}</tr>
          ))}
        </tbody>
      </table>

      {terms.length > 0 && (
        <div className="quotation-section">
          <strong>{t('Terms & conditions')}</strong>
          <ol>{terms.map((term) => <li key={term}>{term}</li>)}</ol>
        </div>
      )}
      {quotation.disclaimer?.trim() && (
        <div className="quotation-section">
          <strong>{t('Disclaimer')}</strong>
          <p>{quotation.disclaimer.trim()}</p>
        </div>
      )}

      <div className="signature-row">
        <span>{t('Date: ______________')}</span>
        <div className="paper-signature-area">
          {firm.signature && <img className="signature-static-image" src={firm.signature} alt="" style={{ left: `${firm.signatureLayout?.x ?? 30}mm`, top: `${firm.signatureLayout?.y ?? 0}mm`, width: `${firm.signatureLayout?.width ?? 35}mm`, height: `${firm.signatureLayout?.height ?? 14}mm` }} />}
          <span className="paper-signature-caption">{t('Signature')}</span>
        </div>
      </div>
    </article>
  );
}

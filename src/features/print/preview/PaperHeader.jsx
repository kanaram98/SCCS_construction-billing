import { getPrintDocument } from '../../../domain/print-settings.js';
import { hasGst } from '../../../domain/calculations.js';

/** Firm branding and bill details printed at the top of each document. `t` uses the bill's language. */
export default function PaperHeader({ bill, firm, documentType, t }) {
  const contact = [firm.phone, firm.gstRegistered && firm.gstin && t('GSTIN: {gstin}', { gstin: firm.gstin })].filter(Boolean).join(' · ');
  return (
    <div className="paper-header-content">
      <div className="paper-branding">
        <div>
          <h2>{firm.name || t('Firm name')}</h2>
          {firm.address && <div>{firm.address}</div>}
          <div>{contact}</div>
        </div>
        {firm.logo && <img className="paper-logo" src={firm.logo} alt="" />}
      </div>
      <h3>{t(getPrintDocument(documentType)?.label || '')} · {t('Bill {number}', { number: bill.number })}</h3>
      <div>
        {[
          t('Project: {project}', { project: bill.projectName || '—' }),
          t('Client: {client}', { client: bill.client || '—' }),
          t('Date: {date}', { date: bill.date })
        ].join(' · ')}
      </div>
      {bill.clientPhone && <div>{t('Client phone: {phone}', { phone: bill.clientPhone })}</div>}
      {bill.clientAddress && <div>{bill.clientAddress}</div>}
      {hasGst(bill) && bill.clientGstin && <div>{t('Client GSTIN: {gstin}', { gstin: bill.clientGstin })}</div>}
    </div>
  );
}

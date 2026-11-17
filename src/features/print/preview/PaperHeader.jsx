import { getPrintDocument } from '../../../domain/print-settings.js';

/** Firm branding and bill details printed at the top of each document. */
export default function PaperHeader({ bill, firm, documentType }) {
  const contact = [firm.phone, firm.gstin && `GSTIN: ${firm.gstin}`].filter(Boolean).join(' · ');
  return (
    <div className="paper-header-content">
      <div className="paper-branding">
        <div>
          <h2>{firm.name || 'Firm name'}</h2>
          {firm.address && <div>{firm.address}</div>}
          <div>{contact}</div>
        </div>
        {firm.logo && <img className="paper-logo" src={firm.logo} alt="Firm logo" />}
      </div>
      <h3>{getPrintDocument(documentType)?.label} · Bill {bill.number}</h3>
      <div>Project: {bill.projectName || '—'} · Client: {bill.client || '—'} · Date: {bill.date}</div>
      {bill.clientPhone && <div>Client phone: {bill.clientPhone}</div>}
      {bill.clientAddress && <div>{bill.clientAddress}</div>}
      {bill.clientGstin && <div>Client GSTIN: {bill.clientGstin}</div>}
    </div>
  );
}

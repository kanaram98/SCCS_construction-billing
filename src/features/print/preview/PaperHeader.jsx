import { hasGst } from '../../../domain/calculations.js';
import { billLabel, documentTitle } from '../../../domain/bill-kinds.js';
import Letterhead from './Letterhead.jsx';

/** Letterhead for a bill or estimate document. `t` uses the bill's language. */
export default function PaperHeader({ bill, firm, documentType, t }) {
  return (
    <div className="paper-header-content">
      <Letterhead
        firm={firm}
        t={t}
        title={t(documentTitle(documentType, bill) || '')}
        meta={[billLabel(bill, t), t('Date: {date}', { date: bill.date })]}
        billTo={{
          label: t('Bill to'),
          lines: [
            bill.client,
            bill.clientAddress,
            bill.clientPhone && t('Client phone: {phone}', { phone: bill.clientPhone }),
            hasGst(bill) && bill.clientGstin && t('Client GSTIN: {gstin}', { gstin: bill.clientGstin }),
            bill.projectName && t('Project: {project}', { project: bill.projectName })
          ]
        }}
      />
    </div>
  );
}

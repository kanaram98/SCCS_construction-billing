import { useState } from 'react';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { ResponsiveDialog, SelectField } from '../../components/ui';
import { isEstimate } from '../../domain/bill-kinds.js';
import { isQuotationFinal, quotationLabel, quotationsOfProject } from '../../domain/quotations.js';
import { tr as t } from '../../i18n/translate.js';

const STANDARD = 'standard';

/** Picks the quotation a draft bill or estimate is priced from; its entries take that quotation's prices. */
export default function AttachQuotationDialog({ open, bill, quotations, onAttach, onClose }) {
  return (
    <ResponsiveDialog open={open} title={t('Attach quotation')} onClose={onClose} maxWidth="xs">
      {open && bill && <Body bill={bill} quotations={quotationsOfProject(quotations, bill.projectId)} onAttach={onAttach} onClose={onClose} />}
    </ResponsiveDialog>
  );
}

function Body({ bill, quotations, onAttach, onClose }) {
  const [choice, setChoice] = useState(bill.quotationId || STANDARD);
  return (
    <div style={{ paddingTop: 8 }}>
      {!bill.projectId ? (
        <Typography variant="body2" color="text.secondary">{t('Link this bill to a project first. A quotation belongs to a project.')}</Typography>
      ) : (
        <>
          <Typography variant="body2" sx={{ mb: 2 }}>
            {isEstimate(bill)
              ? t('An estimate needs a final quotation before it can be marked final. Its entries take the quotation’s prices.')
              : t('The bill’s entries take the quotation’s prices. A bill can be marked ready once its quotation is final.')}
          </Typography>
          <SelectField
            label={t('Quotation')}
            value={choice}
            options={[
              { value: STANDARD, label: t('Standard rates (no quotation)') },
              ...quotations.map((entry) => ({ value: entry.id, label: `${quotationLabel(entry)} · ${entry.name}${isQuotationFinal(entry) ? '' : ` (${t('draft')})`}` }))
            ]}
            onChange={setChoice}
            helperText={quotations.length ? undefined : t('No quotation for this project yet. Make one in the Quotation tab.')}
          />
        </>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
        <Button onClick={onClose}>{t('Cancel')}</Button>
        <Button variant="contained" disabled={!bill.projectId} onClick={() => { onAttach(choice === STANDARD ? undefined : choice); onClose(); }}>{t('Attach')}</Button>
      </div>
    </div>
  );
}

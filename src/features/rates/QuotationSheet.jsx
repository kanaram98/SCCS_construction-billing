import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import { useBilling } from '../../state/BillingContext.jsx';
import { Card, CollapsibleCard, TextAreaField, TextField } from '../../components/ui';
import { DEFAULT_DISCLAIMER, DEFAULT_TERMS } from '../../domain/quotation.js';
import { tr as t } from '../../i18n/translate.js';
import FitToWidth from '../print/preview/FitToWidth.jsx';
import QuotationDocument from './QuotationDocument.jsx';

const PAPER_WIDTH_PX = 794; // A4 at 96 dpi

/**
 * The printable part of a rate list: the title, terms and disclaimer, the on-screen preview and the copy used
 * for browser printing. Render it inside the page's `print-page` section.
 */
export default function QuotationSheet({ quotation, rates, exporter, draft = false, showClient = true }) {
  const { actions } = useBilling();
  const update = actions.quotation.update;
  return (
    <>
      <div className="no-print">
        <Card title={t('Quotation details')}>
          <Grid container spacing={2}>
            <Grid size={12}>
              <TextField label={t('Title')} value={quotation.title} onChange={(title) => update({ title })} />
            </Grid>
            {showClient && (
              <Grid size={{ xs: 8, sm: 9 }}>
                <TextField label={t('Quotation for (optional)')} value={quotation.clientName} placeholder={t('Client name')} onChange={(clientName) => update({ clientName })} />
              </Grid>
            )}
            <Grid size={showClient ? { xs: 4, sm: 3 } : 12}>
              <TextField label={t('Valid (days)')} type="number" min="0" step="1" value={quotation.validDays} onChange={(validDays) => update({ validDays: Math.max(0, Math.round(Number(validDays) || 0)) })} />
            </Grid>
            <Grid size={12}>
              <TextAreaField label={t('Terms & conditions (one per line)')} rows={4} value={quotation.terms} onChange={(terms) => update({ terms })} />
            </Grid>
            <Grid size={12}>
              <TextAreaField label={t('Disclaimer')} rows={2} value={quotation.disclaimer} onChange={(disclaimer) => update({ disclaimer })} />
            </Grid>
            <Grid size={12}>
              <Button size="small" onClick={() => update({ terms: DEFAULT_TERMS, disclaimer: DEFAULT_DISCLAIMER })}>{t('Restore default terms')}</Button>
            </Grid>
          </Grid>
        </Card>

        <CollapsibleCard title={t('Preview')} defaultOpen>
          <div ref={exporter.previewRef}>
            <FitToWidth contentWidth={PAPER_WIDTH_PX}>
              <QuotationDocument quotation={quotation} rates={rates} firm={exporter.firm} t={exporter.docT} draft={draft} />
            </FitToWidth>
          </div>
        </CollapsibleCard>
      </div>

      {/* Copy used only for browser printing. */}
      <div className="print-batch">
        <QuotationDocument quotation={quotation} rates={rates} firm={exporter.firm} t={exporter.docT} draft={draft} />
      </div>
    </>
  );
}

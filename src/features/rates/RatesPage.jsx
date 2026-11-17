import { useMemo, useRef, useState } from 'react';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import DownloadIcon from '@mui/icons-material/Download';
import PrintIcon from '@mui/icons-material/Print';
import WhatsAppIcon from '@mui/icons-material/WhatsApp';
import { useBilling } from '../../state/BillingContext.jsx';
import { Card, CollapsibleCard, PageHeading, TextAreaField, TextField, useNotify } from '../../components/ui';
import { useUndoable } from '../../hooks/useUndoable.js';
import { resolveBillLanguage } from '../../domain/print-settings.js';
import { DEFAULT_DISCLAIMER, DEFAULT_TERMS } from '../../domain/quotation.js';
import { canSharePdfFiles, isShareCancelled } from '../../services/files.js';
import { whatsappUrl } from '../../domain/whatsapp.js';
import { getLanguage, makeTranslator, tr as t } from '../../i18n/translate.js';
import FitToWidth from '../print/preview/FitToWidth.jsx';
import RatesTable from './RatesTable.jsx';
import RateFormDialog from './RateFormDialog.jsx';
import { useCloud } from '../account/CloudProvider.jsx';
import QuotationDocument from './QuotationDocument.jsx';

const PAPER_WIDTH_PX = 794; // A4 at 96 dpi

/**
 * Work-item rates, shared as a printable rate quotation with terms and a
 * disclaimer. The rates are also what measurement entries are priced from.
 */
export default function RatesPage() {
  const { data, actions } = useBilling();
  const { rates, firm, quotation } = data;
  const undoable = useUndoable();
  const notify = useNotify();
  const previewRef = useRef(null);
  /** null = closed, 'new' = adding, otherwise the rate being edited. */
  const [editing, setEditing] = useState(null);
  const canEditRates = useCloud().can('editRate');
  const language = resolveBillLanguage(data.printSettings, getLanguage());
  const docT = useMemo(() => makeTranslator(language), [language]);
  const update = actions.quotation.update;

  function save(values) {
    if (editing === 'new') {
      actions.rates.add(values);
      notify(t('{name} added.', { name: values.name }));
    } else {
      actions.rates.update(editing.id, values);
      notify(t('{name} updated.', { name: values.name }));
    }
    setEditing(null);
  }

  /** Entries that use a deleted rate keep their saved copy of it. */
  function removeRate(rate) {
    undoable(t('{name} deleted.', { name: rate.name || t('Work item') }), () => actions.rates.remove(rate.id));
  }

  async function exportPdf(shareText) {
    try {
      notify(t('Preparing PDF…'), 'info');
      const { exportQuotationPdf } = await import('../../documents/quotation-pdf.js');
      await exportQuotationPdf({ quotation, rates, firm, language, rendered: previewRef.current?.querySelector('.quotation-document'), shareText });
      if (!shareText) notify(t('PDF ready to save or share.'));
    } catch (error) {
      if (isShareCancelled(error)) return;
      console.error('Could not export quotation.', error);
      notify(t('PDF export failed: {reason}', { reason: error.message || t('Unknown error') }), 'error');
    }
  }

  function shareOnWhatsApp() {
    const message = [
      docT(quotation.title || 'Rate quotation') + (firm.name ? ` — ${firm.name}` : ''),
      ...rates.map((rate) => `• ${rate.name}: ₹${Number(rate.rate) || 0}/${rate.unit}`),
      firm.phone ? `📞 ${firm.phone}` : ''
    ].filter(Boolean).join('\n');
    if (canSharePdfFiles()) {
      notify(t('Choose WhatsApp in the share menu, then the client.'), 'info');
      exportPdf(message);
    } else {
      window.open(whatsappUrl('', message), '_blank', 'noopener');
    }
  }

  return (
    <section className="print-page">
      <div className="no-print">
        <PageHeading
          title={t('Rates')}
          description={t('Your rate list. Share it as a quotation any time.')}
          action={<Button variant="contained" startIcon={<AddIcon />} onClick={() => setEditing('new')}>{t('Add item')}</Button>}
        />

        <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
          <Button fullWidth variant="outlined" startIcon={<DownloadIcon />} onClick={() => exportPdf()} disabled={!rates.length}>PDF</Button>
          <Button fullWidth variant="outlined" startIcon={<PrintIcon />} onClick={() => window.print()} disabled={!rates.length}>{t('Print')}</Button>
          <Button
            fullWidth
            variant="contained"
            startIcon={<WhatsAppIcon />}
            onClick={shareOnWhatsApp}
            disabled={!rates.length}
            sx={{ bgcolor: '#25D366', color: '#0b3d1f', '&:hover': { bgcolor: '#1ebe5a' } }}
          >
            WhatsApp
          </Button>
        </Stack>

        <RatesTable rates={rates} onEdit={canEditRates ? setEditing : undefined} onRemove={removeRate} />
        <Typography variant="caption" color="text.secondary" component="p" sx={{ mt: 1, mb: 2 }}>
          {canEditRates
            ? t('Tap a row to edit. Changing a rate updates the amounts of entries that use it.')
            : t('You can add rates. Only the admin can change or delete them.')}
        </Typography>

        <Card title={t('Quotation details')}>
          <Grid container spacing={2}>
            <Grid size={12}>
              <TextField label={t('Title')} value={quotation.title} onChange={(title) => update({ title })} />
            </Grid>
            <Grid size={{ xs: 8, sm: 9 }}>
              <TextField label={t('Quotation for (optional)')} value={quotation.clientName} placeholder={t('Client name')} onChange={(clientName) => update({ clientName })} />
            </Grid>
            <Grid size={{ xs: 4, sm: 3 }}>
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
          <div ref={previewRef}>
            <FitToWidth contentWidth={PAPER_WIDTH_PX}>
              <QuotationDocument quotation={quotation} rates={rates} firm={firm} t={docT} />
            </FitToWidth>
          </div>
        </CollapsibleCard>
      </div>

      {/* Copy used only for browser printing. */}
      <div className="print-batch">
        <QuotationDocument quotation={quotation} rates={rates} firm={firm} t={docT} />
      </div>

      <RateFormDialog open={Boolean(editing)} rate={editing === 'new' ? null : editing} onSave={save} onClose={() => setEditing(null)} />
    </section>
  );
}

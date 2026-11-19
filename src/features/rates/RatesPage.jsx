import { useState } from 'react';
import Paper from '@mui/material/Paper';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import { PageHeading } from '../../components/ui';
import { tr as t } from '../../i18n/translate.js';
import QuotationDetail from './QuotationDetail.jsx';
import QuotationList from './QuotationList.jsx';
import StandardRates from './StandardRates.jsx';

const TABS = { quotations: 'quotations', standard: 'standard' };

/**
 * Quotations: a numbered price list for each project (draft until made final), and the standard rates they
 * start from. Entries on bills are priced from the quotation attached to the bill, or from the standard rates.
 */
export default function RatesPage() {
  const [tab, setTab] = useState(TABS.quotations);
  const [openId, setOpenId] = useState(null); // the quotation being viewed, if any

  return (
    <div>
      <div className="no-print">
        <PageHeading title={t('Quotations')} description={t('Price lists for your clients. Share any of them as a printed quotation.')} />
        {!openId && (
          <Paper variant="outlined" sx={{ mb: 1.5 }}>
            <Tabs value={tab} onChange={(_event, value) => setTab(value)} variant="fullWidth" aria-label={t('Quotations and standard rates')}>
              <Tab value={TABS.quotations} label={t('Quotations')} />
              <Tab value={TABS.standard} label={t('Standard rates')} />
            </Tabs>
          </Paper>
        )}
      </div>
      {tab === TABS.standard && !openId && <StandardRates />}
      {tab === TABS.quotations && !openId && <QuotationList onOpen={setOpenId} />}
      {openId && <QuotationDetail key={openId} quotationId={openId} onBack={(nextId) => setOpenId(typeof nextId === 'string' ? nextId : null)} />}
    </div>
  );
}

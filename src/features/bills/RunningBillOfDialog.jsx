import { useState } from 'react';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { ResponsiveDialog, SelectField } from '../../components/ui';
import { billLabel } from '../../domain/bill-kinds.js';
import { seriesBlocker } from '../../domain/bill-guard.js';
import { tr as t } from '../../i18n/translate.js';

/**
 * Admin: a bill made as a new bill that really is the next running bill of another bill
 * of the same project. It joins that bill's series as the next RA bill.
 */
export default function RunningBillOfDialog({ open, bill, bills, onConfirm, onClose }) {
  return (
    <ResponsiveDialog open={open} title={t('Make a running bill')} onClose={onClose} maxWidth="xs">
      {open && bill && <Body bill={bill} bills={bills} onConfirm={onConfirm} onClose={onClose} />}
    </ResponsiveDialog>
  );
}

function Body({ bill, bills, onConfirm, onClose }) {
  const choices = bills.filter((entry) => !seriesBlocker(bill, entry));
  const [sourceId, setSourceId] = useState('');
  return (
    <div style={{ paddingTop: 8 }}>
      <Typography variant="body2" sx={{ mb: 2 }}>
        {t('{bill} becomes the next running bill after the bill you choose. Only bills of the same project are listed. Its entries and number stay as they are.', { bill: billLabel(bill, t) })}
      </Typography>
      {choices.length ? (
        <SelectField
          label={t('Running bill of')}
          value={sourceId}
          placeholder={t('Choose a bill')}
          options={choices.map((entry) => ({ value: entry.id, label: `${billLabel(entry, t)}${entry.name ? ` · ${entry.name}` : ''}` }))}
          onChange={setSourceId}
        />
      ) : (
        <Typography variant="body2" color="text.secondary">{t('There is no other bill in this project to follow.')}</Typography>
      )}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
        <Button onClick={onClose}>{t('Cancel')}</Button>
        <Button variant="contained" disabled={!sourceId} onClick={() => { onConfirm(sourceId); onClose(); }}>{t('Make running bill')}</Button>
      </div>
    </div>
  );
}

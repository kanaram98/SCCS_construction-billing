import Grid from '@mui/material/Grid';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { useBilling } from '../../state/BillingContext.jsx';
import { isCancelled, isEntryLocked, isNumberLocked, isSubmitted } from '../../domain/bill-guard.js';
import { quotationLabel } from '../../domain/quotations.js';
import { Card, Notice, SelectField, TextField } from '../../components/ui';
import { getRequiredDetailErrors, isBillNumberTaken } from '../../domain/validation.js';
import { text } from '../../domain/formatters.js';
import { billFieldsFromProject } from '../../domain/projects.js';
import { hasGst } from '../../domain/calculations.js';
import { tr as t } from '../../i18n/translate.js';

const AUDIT_LABELS = {
  ready: 'Marked ready',
  'back-to-draft': 'Moved back to draft',
  submitted: 'Submitted',
  'submitted-unpaid': 'Submitted with a balance',
  reopened: 'Reopened',
  cancelled: 'Cancelled',
  restored: 'Cancellation undone',
  'running-bill': 'Made a running bill'
};

/** Which project (and so which client) this bill is for, its quotation, number, date and level names. */
export default function BillDetailsCard({ onNavigate }) {
  const { data, bill, actions } = useBilling();
  const update = actions.bills.update;
  const project = data.projects.find((entry) => entry.id === bill.projectId);
  const required = getRequiredDetailErrors(bill, data.firm);
  const numberError = !text(bill.number)
    ? t('Bill number is required.')
    : isBillNumberTaken(data.bills, bill) ? t('This bill number is already in use.') : '';
  const locked = isEntryLocked(bill);
  const closed = isSubmitted(bill) || isCancelled(bill);
  const audit = Array.isArray(bill.audit) ? bill.audit : [];
  const attached = data.quotations.find((entry) => entry.id === bill.quotationId);

  const clientLines = [bill.client, bill.clientPhone, hasGst(bill) ? bill.clientGstin : '', bill.clientAddress].filter(Boolean);

  return (
    <Card title={t('About this bill')}>
      <Grid container spacing={2}>
        {bill.projectId ? (
          <Grid size={12}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>{t('Project')}</Typography>
            <Typography variant="body1">{bill.projectName || project?.name}</Typography>
            <Typography variant="caption" color="text.secondary">{t('Fixed when the bill is made. To use another project, make a new bill.')}</Typography>
          </Grid>
        ) : (
        <Grid size={12}>
          <SelectField
            label={t('Project')}
            required
            value={bill.projectId || ''}
            placeholder={t('Choose a project')}
            options={data.projects.map((entry) => ({ value: entry.id, label: entry.name }))}
            error={!project ? required.projectName : ''}
            helperText={t('The project brings the client details. Change them in Projects.')}
            onChange={(projectId) => {
              const chosen = data.projects.find((entry) => entry.id === projectId);
              if (chosen) update(billFieldsFromProject(chosen));
            }}
          />
        </Grid>
        )}
        {project ? (
          <Grid size={12}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>{t('Client')}</Typography>
            {clientLines.map((line) => <Typography key={line} variant="body2" color="text.secondary">{line}</Typography>)}
            <Button size="small" sx={{ mt: 0.5 }} onClick={() => onNavigate?.('projects')}>{t('Edit in Projects')}</Button>
          </Grid>
        ) : (
          <Grid size={12}>
            <Notice tone="info">{t('This bill is not linked to a project. Choose one above, or add the project in Projects first.')}</Notice>
          </Grid>
        )}
        {(bill.quotationId || bill.quotationLabel) && (
          <Grid size={12}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>{t('Quotation')}</Typography>
            <Typography variant="body2" color="text.secondary">{attached ? `${quotationLabel(attached)} · ${attached.name}` : bill.quotationLabel}</Typography>
            <Typography variant="caption" color="text.secondary">{t('Change it from the bill’s ⋮ menu: Attach quotation.')}</Typography>
          </Grid>
        )}
        <Grid size={12}>
          <TextField label={t('Bill name')} disabled={closed} helperText={t('Optional, e.g. Ground floor marble work. Shown in the Bills list.')} value={bill.name || ''} onChange={(name) => update({ name: name.trim() ? name : undefined })} />
        </Grid>
        <Grid size={6}>
          <TextField label={t('Bill number')} required value={bill.number} error={numberError} disabled={isNumberLocked(bill)} helperText={isNumberLocked(bill) ? t('Fixed once the bill is ready or has payments.') : undefined} onChange={(number) => update({ number })} />
        </Grid>
        <Grid size={6}>
          <TextField label={t('Date')} type="date" value={bill.date} disabled helperText={t('Fixed when the bill is made.')} onChange={() => {}} />
        </Grid>
        <Grid size={6}>
          <TextField label={t('First level name')} disabled={locked} helperText={t('e.g. Floor')} value={bill.firstLevelName} onChange={(firstLevelName) => update({ firstLevelName })} />
        </Grid>
        <Grid size={6}>
          <TextField label={t('Second level name')} disabled={locked} helperText={t('e.g. Room')} value={bill.secondLevelName} onChange={(secondLevelName) => update({ secondLevelName })} />
        </Grid>
        {audit.length > 0 && (
          <Grid size={12}>
            <Typography variant="body2" sx={{ fontWeight: 600 }}>{t('Stage history')}</Typography>
            {audit.slice().reverse().map((entry, index) => (
              <Typography key={index} variant="caption" color="text.secondary" component="div">
                {entry.at.slice(0, 10)} · {t(AUDIT_LABELS[entry.action] || entry.action)}{entry.reason ? ` — ${entry.reason}` : ''}
              </Typography>
            ))}
          </Grid>
        )}
      </Grid>
    </Card>
  );
}

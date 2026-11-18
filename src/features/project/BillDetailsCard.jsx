import Grid from '@mui/material/Grid';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import { useBilling } from '../../state/BillingContext.jsx';
import { Card, Notice, SelectField, TextField } from '../../components/ui';
import { getRequiredDetailErrors, isBillNumberTaken } from '../../domain/validation.js';
import { text } from '../../domain/formatters.js';
import { billFieldsFromProject } from '../../domain/projects.js';
import { hasGst } from '../../domain/calculations.js';
import { futureDateWarning } from '../../domain/warnings.js';
import { tr as t } from '../../i18n/translate.js';

/** Which project (and so which client) this bill is for, its number, date and level names. */
export default function BillDetailsCard({ onNavigate }) {
  const { data, bill, actions } = useBilling();
  const update = actions.bills.update;
  const project = data.projects.find((entry) => entry.id === bill.projectId);
  const required = getRequiredDetailErrors(bill, data.firm);
  const numberError = !text(bill.number)
    ? t('Bill number is required.')
    : isBillNumberTaken(data.bills, bill) ? t('This bill number is already in use.') : '';
  const clientLines = [bill.client, bill.clientPhone, hasGst(bill) ? bill.clientGstin : '', bill.clientAddress].filter(Boolean);

  return (
    <Card title={t('About this bill')}>
      <Grid container spacing={2}>
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
        <Grid size={6}>
          <TextField label={t('Bill number')} required value={bill.number} error={numberError} onChange={(number) => update({ number })} />
        </Grid>
        <Grid size={6}>
          <TextField label={t('Date')} type="date" value={bill.date} warning={futureDateWarning(bill.date)} onChange={(date) => update({ date })} />
        </Grid>
        <Grid size={6}>
          <TextField label={t('First level name')} helperText={t('e.g. Floor')} value={bill.firstLevelName} onChange={(firstLevelName) => update({ firstLevelName })} />
        </Grid>
        <Grid size={6}>
          <TextField label={t('Second level name')} helperText={t('e.g. Room')} value={bill.secondLevelName} onChange={(secondLevelName) => update({ secondLevelName })} />
        </Grid>
      </Grid>
    </Card>
  );
}

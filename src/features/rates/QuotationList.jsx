import { useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Card from '@mui/material/Card';
import CardActionArea from '@mui/material/CardActionArea';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import RequestQuoteIcon from '@mui/icons-material/RequestQuoteOutlined';
import { EmptyState, ResponsiveDialog, SelectField, TextField } from '../../components/ui';
import { useBilling } from '../../state/BillingContext.jsx';
import { isQuotationFinal, quotationLabel, quotationUsage } from '../../domain/quotations.js';
import { tr as t, trn } from '../../i18n/translate.js';

function NewQuotationForm({ projects, onCreate, onClose }) {
  const [projectId, setProjectId] = useState(projects.length === 1 ? projects[0].id : '');
  const [name, setName] = useState('Quotation');
  function submit(event) {
    event.preventDefault();
    if (!projectId || !name.trim()) return;
    onCreate(projectId, name.trim());
    onClose();
  }
  return (
    <form onSubmit={submit} style={{ paddingTop: 8 }}>
      <Typography variant="body2" sx={{ mb: 2 }}>{t('A quotation starts as a copy of today’s standard rates, as a draft. Change the prices for this client, then make it final.')}</Typography>
      <Stack spacing={2}>
        <SelectField label={t('Project')} value={projectId} placeholder={t('Choose a project')} options={projects.map((project) => ({ value: project.id, label: `${project.name}${project.client ? ` · ${project.client}` : ''}` }))} onChange={setProjectId} />
        <TextField label={t('Quotation name')} value={name} onChange={setName} />
      </Stack>
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
        <Button onClick={onClose}>{t('Cancel')}</Button>
        <Button type="submit" variant="contained" disabled={!projectId || !name.trim()}>{t('Create quotation')}</Button>
      </div>
    </form>
  );
}

/** All quotations, one card each; tap to open. Making a new one is at the bottom of the list. */
export default function QuotationList({ onOpen }) {
  const { data, actions } = useBilling();
  const [creating, setCreating] = useState(false);
  const sorted = [...data.quotations].sort((a, b) => String(b.number).localeCompare(String(a.number)) || b.rev - a.rev);
  const newButton = (
    <Button fullWidth variant="contained" startIcon={<AddIcon />} disabled={!data.projects.length} onClick={() => setCreating(true)} sx={{ mt: 1 }}>
      {t('New quotation')}
    </Button>
  );

  return (
    <div>
      {sorted.length === 0 ? (
        <EmptyState
          icon={<RequestQuoteIcon />}
          title={t('No quotations yet')}
          description={data.projects.length ? t('Make a quotation for a project to give that client their own prices.') : t('Add a project first (Projects tab). A quotation belongs to a project.')}
          action={data.projects.length ? newButton : undefined}
        />
      ) : (
        <>
          {sorted.map((quotation) => {
            const project = data.projects.find((entry) => entry.id === quotation.projectId);
            const used = quotationUsage(quotation.id, data.bills);
            const final = isQuotationFinal(quotation);
            return (
              <Card key={quotation.id} sx={{ mb: 1.25 }}>
                <CardActionArea onClick={() => onOpen(quotation.id)} sx={{ p: 1.75 }}>
                  <Stack direction="row" spacing={1} sx={{ justifyContent: 'space-between', alignItems: 'flex-start' }}>
                    <Box sx={{ minWidth: 0 }}>
                      <Typography variant="subtitle1" noWrap>{quotationLabel(quotation)} · {quotation.name}</Typography>
                      <Typography variant="body2" color="text.secondary" noWrap>{[project?.name, project?.client].filter(Boolean).join(' · ') || t('Project')}</Typography>
                    </Box>
                    <Chip size="small" color={final ? 'success' : 'default'} variant={final ? 'filled' : 'outlined'} label={final ? t('Final') : t('Draft')} />
                  </Stack>
                  <Stack direction="row" spacing={0.75} sx={{ mt: 1, flexWrap: 'wrap', rowGap: 0.75 }}>
                    <Chip size="small" variant="outlined" label={trn(quotation.lines.length, '{count} item', '{count} items')} />
                    {used > 0 && <Chip size="small" variant="outlined" label={used === 1 ? t('Used by 1 bill') : t('Used by {count} bills', { count: used })} />}
                  </Stack>
                </CardActionArea>
              </Card>
            );
          })}
          {newButton}
        </>
      )}
      <ResponsiveDialog open={creating} title={t('New quotation')} onClose={() => setCreating(false)} maxWidth="xs">
        {creating && (
          <NewQuotationForm
            projects={data.projects}
            onCreate={(projectId, name) => { const created = actions.quotations.add(projectId, name); onOpen(created.id); }}
            onClose={() => setCreating(false)}
          />
        )}
      </ResponsiveDialog>
    </div>
  );
}

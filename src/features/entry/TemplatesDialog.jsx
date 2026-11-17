import { useState } from 'react';
import Button from '@mui/material/Button';
import Divider from '@mui/material/Divider';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import DeleteIcon from '@mui/icons-material/DeleteOutlined';
import SaveIcon from '@mui/icons-material/SaveOutlined';
import { useBilling } from '../../state/BillingContext.jsx';
import { EmptyState, ResponsiveDialog, SelectField, TextField, useConfirm, useNotify } from '../../components/ui';
import { createTemplateContent } from '../../domain/bill-tree.js';
import { getTemplateSources, parseTemplateSource } from '../../domain/templates.js';

/** Save sections/areas as reusable templates and add saved templates to the bill. */
export default function TemplatesDialog({ open, onClose, onApplied }) {
  const { data, bill, actions } = useBilling();
  const notify = useNotify();
  const confirm = useConfirm();
  const { templates } = data;
  const sections = bill.sections;
  const [source, setSource] = useState('');
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');
  const [targetSectionId, setTargetSectionId] = useState('');
  const target = sections.find((section) => section.id === targetSectionId) || sections[0];

  function saveTemplate(event) {
    event.preventDefault();
    const { type, sectionId, areaId } = parseTemplateSource(source);
    const content = createTemplateContent(bill, type, sectionId, areaId);
    if (!content) {
      setMessage('Choose a section or area to save as a template.');
      return;
    }
    if (!actions.templates.save({ type, name, content })) {
      setMessage('Enter a unique template name before saving.');
      return;
    }
    notify(`Saved “${name.trim()}” for reuse on this device.`);
    setMessage('');
    setName('');
    setSource('');
  }

  function applyTemplate(template) {
    const result = actions.templates.apply(template.id, target?.id);
    if (!result) {
      setMessage('Add a section before adding an area template.');
      return;
    }
    onClose();
    onApplied(result);
  }

  async function removeTemplate(template) {
    if (await confirm({ title: `Remove template “${template.name}”?`, confirmLabel: 'Remove', danger: true })) {
      actions.templates.remove(template.id);
    }
  }

  return (
    <ResponsiveDialog open={open} title="Reusable templates" onClose={onClose}>
      <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
        Save a section or area with its entries, then reuse it in any bill.
      </Typography>

      <Stack component="form" spacing={1.5} onSubmit={saveTemplate}>
        <SelectField
          label="Save from"
          value={source}
          placeholder="Choose a section or area"
          options={getTemplateSources(sections)}
          onChange={setSource}
        />
        <TextField label="Template name" value={name} placeholder="e.g. Standard bathroom" onChange={setName} />
        <Button type="submit" variant="contained" startIcon={<SaveIcon />} disabled={!source || !name.trim()}>
          Save template
        </Button>
        {message && <Typography variant="body2" color="error">{message}</Typography>}
      </Stack>

      <Divider sx={{ my: 2.5 }} />
      <Typography variant="subtitle1" sx={{ mb: 1 }}>Saved templates ({templates.length})</Typography>

      {templates.some((template) => template.type === 'area') && sections.length > 1 && (
        <SelectField
          label="Add area templates to"
          value={target?.id || ''}
          options={sections.map((section) => ({ value: section.id, label: section.name }))}
          onChange={setTargetSectionId}
          sx={{ mb: 1 }}
        />
      )}

      {templates.length ? (
        <List disablePadding>
          {templates.map((template) => (
            <ListItem
              key={template.id}
              disableGutters
              secondaryAction={(
                <Stack direction="row" spacing={0.5}>
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<AddIcon />}
                    disabled={template.type === 'area' && !target}
                    onClick={() => applyTemplate(template)}
                  >
                    Add
                  </Button>
                  <IconButton aria-label={`Remove ${template.name}`} color="error" onClick={() => removeTemplate(template)}>
                    <DeleteIcon />
                  </IconButton>
                </Stack>
              )}
              sx={{ pr: 16 }}
            >
              <ListItemText
                primary={template.name}
                secondary={template.type === 'section'
                  ? 'Section · adds a new section'
                  : `Area · adds to ${target?.name || 'a section'}`}
              />
            </ListItem>
          ))}
        </List>
      ) : <EmptyState compact description="No templates yet. Save a section or area above." />}
    </ResponsiveDialog>
  );
}

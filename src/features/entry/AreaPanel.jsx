import { useState } from 'react';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import DeleteIcon from '@mui/icons-material/DeleteOutlined';
import { useBilling } from '../../state/BillingContext.jsx';
import { ActionMenu, TextField, useConfirm, useNotify } from '../../components/ui';
import { getAreaTotal } from '../../domain/calculations.js';
import { pluralize } from '../../domain/formatters.js';
import { useEntryForm } from './useEntryForm.js';
import GroupSummary from './GroupSummary.jsx';
import EntryList from './EntryList.jsx';
import EntryDialog from './EntryDialog.jsx';
import SectionPickerDialog from './SectionPickerDialog.jsx';

/** One area: its entries, the add/edit dialog, and copy/delete actions. */
export default function AreaPanel({ section, area, sections, open, onToggle, onCopied }) {
  const { data, actions } = useBilling();
  const { entry } = actions;
  const confirm = useConfirm();
  const notify = useNotify();
  const [editorOpen, setEditorOpen] = useState(false);
  /** null, `{ type: 'area' }` or `{ type: 'item', itemId }` while choosing a copy target. */
  const [copyRequest, setCopyRequest] = useState(null);

  const form = useEntryForm({
    rates: data.rates,
    items: area.items,
    onAdd: (rateId, values) => entry.addItem(section.id, area.id, rateId, values),
    onUpdate: (itemId, values) => entry.updateItem(section.id, area.id, itemId, values)
  });

  function openNewEntry() {
    form.reset();
    setEditorOpen(true);
  }

  function editEntry(item) {
    form.startEditing(item);
    setEditorOpen(true);
  }

  function deleteEntry(item) {
    entry.removeItem(section.id, area.id, item.id);
    form.handleItemRemoved(item.id);
    notify(`${item.name || 'Entry'} deleted.`, 'info');
  }

  async function deleteArea() {
    if (area.items.length) {
      const confirmed = await confirm({
        title: `Delete ${area.name}?`,
        message: `Its ${area.items.length} ${pluralize(area.items.length, 'entry', 'entries')} will be removed.`,
        confirmLabel: 'Delete',
        danger: true
      });
      if (!confirmed) return;
    }
    entry.removeArea(section.id, area.id);
  }

  function copyTo(targetSectionId) {
    const result = copyRequest.type === 'area'
      ? entry.copyArea(section.id, area.id, targetSectionId)
      : entry.copyItem(section.id, area.id, copyRequest.itemId, targetSectionId);
    setCopyRequest(null);
    if (result) onCopied(result);
  }

  return (
    <Accordion expanded={open} onChange={onToggle} sx={{ bgcolor: '#fbfcfe' }}>
      <AccordionSummary expandIcon={<ExpandMoreIcon />}>
        <GroupSummary
          variant="area"
          name={area.name}
          meta={`${area.items.length} ${pluralize(area.items.length, 'entry', 'entries')}`}
          total={getAreaTotal(area, data.rates)}
        />
      </AccordionSummary>
      <AccordionDetails sx={{ pt: 0 }}>
        <Stack direction="row" spacing={0.5} sx={{ mb: 1.5, alignItems: 'center' }}>
          <TextField label="Area name" value={area.name} onChange={(name) => entry.updateArea(section.id, area.id, { name })} />
          <ActionMenu
            label={`Actions for ${area.name}`}
            items={[
              { label: 'Copy area to section…', icon: <ContentCopyIcon fontSize="small" />, onClick: () => setCopyRequest({ type: 'area' }), disabled: sections.length < 2 },
              { label: 'Delete area', icon: <DeleteIcon fontSize="small" />, onClick: deleteArea, danger: true }
            ]}
          />
        </Stack>

        {area.items.length > 0 ? (
          <EntryList
            items={area.items}
            rates={data.rates}
            canCopy={sections.length > 1}
            onEdit={editEntry}
            onDelete={deleteEntry}
            onCopy={(itemId) => setCopyRequest({ type: 'item', itemId })}
          />
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>No entries yet.</Typography>
        )}

        <Button fullWidth variant="outlined" startIcon={<AddIcon />} onClick={openNewEntry} sx={{ mt: 1.5, py: 1 }}>
          Add entry
        </Button>
      </AccordionDetails>

      <EntryDialog open={editorOpen} areaName={area.name} form={form} onClose={() => setEditorOpen(false)} />
      <SectionPickerDialog
        open={Boolean(copyRequest)}
        title={copyRequest?.type === 'area' ? `Copy ${area.name} to…` : 'Copy entry to…'}
        description="Entries go into an area with the same name, or a new one is created."
        sections={sections}
        currentSectionId={section.id}
        onPick={copyTo}
        onClose={() => setCopyRequest(null)}
      />
    </Accordion>
  );
}

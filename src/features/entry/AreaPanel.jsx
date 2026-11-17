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
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import DeleteIcon from '@mui/icons-material/DeleteOutlined';
import { useBilling } from '../../state/BillingContext.jsx';
import { ActionMenu, TextField, useConfirm } from '../../components/ui';
import { getAreaTotal } from '../../domain/calculations.js';
import { pluralize } from '../../domain/formatters.js';
import { useUndoable } from '../../hooks/useUndoable.js';
import { useEntryForm } from './useEntryForm.js';
import GroupSummary from './GroupSummary.jsx';
import EntryList from './EntryList.jsx';
import EntryDialog from './EntryDialog.jsx';
import SectionPickerDialog from './SectionPickerDialog.jsx';

/** One area: its entries, the add/edit dialog, and copy/delete actions. */
/** @param {object[] | null} visibleItems search results to show instead of every entry */
export default function AreaPanel({ section, area, index, sections, open, visibleItems = null, onToggle, onCopied }) {
  const searching = Boolean(visibleItems);
  const shownItems = visibleItems || area.items;
  const { data, actions } = useBilling();
  const { entry } = actions;
  const confirm = useConfirm();
  const undoable = useUndoable();
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
    undoable(`${item.name || 'Entry'} deleted.`, () => entry.removeItem(section.id, area.id, item.id));
    form.handleItemRemoved(item.id);
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
    undoable(`${area.name} deleted.`, () => entry.removeArea(section.id, area.id));
  }

  function copyTo(targetSectionId) {
    const result = copyRequest.type === 'area'
      ? entry.copyArea(section.id, area.id, targetSectionId)
      : entry.copyItem(section.id, area.id, copyRequest.itemId, targetSectionId);
    setCopyRequest(null);
    if (result) onCopied(result);
  }

  return (
    <Accordion expanded={open} onChange={onToggle} sx={{ bgcolor: 'background.default' }}>
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
              { label: 'Move up', icon: <ArrowUpwardIcon fontSize="small" />, onClick: () => entry.moveArea(section.id, area.id, -1), disabled: index === 0 },
              { label: 'Move down', icon: <ArrowDownwardIcon fontSize="small" />, onClick: () => entry.moveArea(section.id, area.id, 1), disabled: index === section.areas.length - 1 },
              { label: 'Copy area to section…', icon: <ContentCopyIcon fontSize="small" />, onClick: () => setCopyRequest({ type: 'area' }), disabled: sections.length < 2 },
              { label: 'Delete area', icon: <DeleteIcon fontSize="small" />, onClick: deleteArea, danger: true }
            ]}
          />
        </Stack>

        {shownItems.length > 0 ? (
          <EntryList
            items={shownItems}
            canMove={!searching}
            rates={data.rates}
            canCopy={sections.length > 1}
            onEdit={editEntry}
            onDelete={deleteEntry}
            onCopy={(itemId) => setCopyRequest({ type: 'item', itemId })}
            onMove={(itemId, direction) => entry.moveItem(section.id, area.id, itemId, direction)}
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

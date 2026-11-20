import { useEffect, useState } from 'react';
import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Button from '@mui/material/Button';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import LibraryAddIcon from '@mui/icons-material/LibraryAddOutlined';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import DeleteIcon from '@mui/icons-material/DeleteOutlined';
import { useBilling } from '../../state/BillingContext.jsx';
import Box from '@mui/material/Box';
import EditIcon from '@mui/icons-material/EditOutlined';
import { ActionMenu, useConfirm } from '../../components/ui';
import RenameDialog from '../../components/ui/RenameDialog.jsx';
import { billStyleOf, getAreaTotal } from '../../domain/calculations.js';
import { isEntryLocked, lockState } from '../../domain/bill-guard.js';
import { useUndoable } from '../../hooks/useUndoable.js';
import GroupSummary from './GroupSummary.jsx';
import EntryList from './EntryList.jsx';
import EntrySheet from './EntrySheet.jsx';
import SectionPickerDialog from './SectionPickerDialog.jsx';
import { tr as t, trn } from '../../i18n/translate.js';

/** One area: its entries, the add/edit dialog, and copy/delete actions. */
/** @param {object[] | null} visibleItems search results to show instead of every entry */
export default function AreaPanel({ section, area, index, sections, open, visibleItems = null, autoRename = false, onToggle, onCopied, onDuplicated, onRenameShown }) {
  const searching = Boolean(visibleItems);
  const shownItems = visibleItems || area.items;
  const { data, bill, actions } = useBilling();
  const { entry } = actions;
  const readOnly = isEntryLocked(bill); // ready, submitted or cancelled: nothing to add or change here
  const confirm = useConfirm();
  const undoable = useUndoable();
  const [editorOpen, setEditorOpen] = useState(false);
  const [renaming, setRenaming] = useState(autoRename); // a fresh copy opens its rename box at once
  useEffect(() => { if (autoRename) onRenameShown?.(); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  /** null, `{ type: 'area' }` or `{ type: 'item', itemId }` while choosing a copy target. */
  const [copyRequest, setCopyRequest] = useState(null);

  const [editFocus, setEditFocus] = useState(''); // the entry tapped to open the sheet on

  /** Opens the entry sheet (a final bill's measurements are locked). */
  function openSheet(itemId = '') {
    if (isEntryLocked(bill)) {
      window.dispatchEvent(new CustomEvent('bill-locked'));
      return;
    }
    setEditFocus(itemId);
    setEditorOpen(true);
  }

  function deleteEntry(item) {
    undoable(t('{name} deleted.', { name: item.name || t('Entry') }), () => entry.removeItem(section.id, area.id, item.id));
  }

  async function deleteArea() {
    if (area.items.length) {
      const confirmed = await confirm({
        title: t('Delete {name}?', { name: area.name }),
        message: trn(area.items.length, 'Its {count} entry will be removed.', 'Its {count} entries will be removed.'),
        confirmLabel: t('Delete'),
        danger: true
      });
      if (!confirmed) return;
    }
    undoable(t('{name} deleted.', { name: area.name }), () => entry.removeArea(section.id, area.id));
  }

  /** A copy of this room right after it, opened for renaming. */
  function duplicateArea() {
    if (isEntryLocked(bill)) {
      window.dispatchEvent(new CustomEvent('bill-locked'));
      return;
    }
    const result = entry.duplicateArea(section.id, area.id);
    if (result) onDuplicated?.(result);
  }

  function copyTo(targetSectionId) {
    const result = copyRequest.type === 'area'
      ? entry.copyArea(section.id, area.id, targetSectionId)
      : entry.copyItem(section.id, area.id, copyRequest.itemId, targetSectionId);
    setCopyRequest(null);
    if (result) onCopied(result);
  }

  return (
    <Accordion id={`area-${area.id}`} expanded={open} onChange={onToggle} sx={{ scrollMarginTop: 72 }}>
      {/* A div (role=button), not a <button>: the actions menu inside is a button itself. */}
      <AccordionSummary component="div" expandIcon={<ExpandMoreIcon />} sx={{ px: 1.5 }}>
        <GroupSummary
          variant="area"
          name={area.name}
          meta={trn(area.items.length, '{count} entry', '{count} entries')}
          total={getAreaTotal(area, data.rates, billStyleOf(bill))}
        />
        {!readOnly && <Box onClick={(event) => event.stopPropagation()} onFocus={(event) => event.stopPropagation()} sx={{ display: 'flex', alignItems: 'center' }}>
          <ActionMenu
            label={t('Actions for {name}', { name: area.name })}
            items={[
              { label: t('Rename'), icon: <EditIcon fontSize="small" />, onClick: () => setRenaming(true) },
              { label: t('Move up'), icon: <ArrowUpwardIcon fontSize="small" />, onClick: () => entry.moveArea(section.id, area.id, -1), disabled: index === 0 },
              { label: t('Move down'), icon: <ArrowDownwardIcon fontSize="small" />, onClick: () => entry.moveArea(section.id, area.id, 1), disabled: index === section.areas.length - 1 },
              { label: t('Duplicate in this section'), icon: <LibraryAddIcon fontSize="small" />, onClick: duplicateArea },
              { label: t('Copy area to section…'), icon: <ContentCopyIcon fontSize="small" />, onClick: () => setCopyRequest({ type: 'area' }), disabled: sections.length < 2 },
              { label: t('Delete area'), icon: <DeleteIcon fontSize="small" />, onClick: deleteArea, danger: true }
            ]}
          />
        </Box>}
      </AccordionSummary>
      <AccordionDetails sx={{ pt: 0, px: 1.5 }}>

        {shownItems.length > 0 ? (
          <EntryList
            items={shownItems}
            canMove={!searching}
            rates={data.rates}
            canCopy={sections.length > 1}
            readOnly={readOnly}
            onEdit={(item) => openSheet(item.id)}
            onDelete={deleteEntry}
            onCopy={(itemId) => setCopyRequest({ type: 'item', itemId })}
            onMove={(itemId, direction) => entry.moveItem(section.id, area.id, itemId, direction)}
          />
        ) : (
          <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>{t('No entries yet.')}</Typography>
        )}

        {!readOnly && (
          <Button fullWidth variant="outlined" startIcon={<AddIcon />} onClick={() => openSheet()} sx={{ mt: 1.5, py: 1.25 }}>
            {area.items.length ? t('Add or edit entries') : t('Add entry')}
          </Button>
        )}
      </AccordionDetails>

      <RenameDialog
        open={renaming}
        title={t('Rename {name}', { name: area.name })}
        label={t('Area name')}
        value={area.name}
        onSave={(name) => entry.updateArea(section.id, area.id, { name })}
        onClose={() => setRenaming(false)}
      />
      <EntrySheet open={editorOpen} section={section} area={area} focusItemId={editFocus} onClose={() => setEditorOpen(false)} />
      <SectionPickerDialog
        open={Boolean(copyRequest)}
        title={copyRequest?.type === 'area' ? t('Copy {name} to…', { name: area.name }) : t('Copy entry to…')}
        description={t('Entries go into an area with the same name, or a new one is created.')}
        sections={sections}
        currentSectionId={section.id}
        onPick={copyTo}
        onClose={() => setCopyRequest(null)}
      />
    </Accordion>
  );
}

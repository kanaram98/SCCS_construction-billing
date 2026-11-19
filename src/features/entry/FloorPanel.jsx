import { useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import DeleteIcon from '@mui/icons-material/DeleteOutlined';
import ContentCopyIcon from '@mui/icons-material/ContentCopy';
import EditIcon from '@mui/icons-material/EditOutlined';
import LibraryAddIcon from '@mui/icons-material/LibraryAddOutlined';
import { useBilling } from '../../state/BillingContext.jsx';
import { useUndoable } from '../../hooks/useUndoable.js';
import { ActionMenu, useConfirm } from '../../components/ui';
import RenameDialog from '../../components/ui/RenameDialog.jsx';
import { countSectionItems, getSectionTotal } from '../../domain/calculations.js';
import { formatCurrency } from '../../domain/formatters.js';
import { tr as t, trn } from '../../i18n/translate.js';
import { isEntryLocked, lockState } from '../../domain/bill-guard.js';
import AreaPanel from './AreaPanel.jsx';
import CopyAreasDialog from './CopyAreasDialog.jsx';

/** The usual rooms, one tap to add. */
const QUICK_ROOMS = ['Hall', 'Kitchen', 'Bedroom', 'Bathroom', 'Balcony'];

/** One floor (section): summary, its rooms, and "Add room". */
export default function FloorPanel({ section, sections, disclosure, levelName, sublevelName, onAddArea, onCopied, onDeleted }) {
  const { data, bill, actions } = useBilling();
  const [copyingAreas, setCopyingAreas] = useState(false);
  const { entry } = actions;
  const readOnly = isEntryLocked(bill); // ready, submitted or cancelled: no adding or changing floors and rooms
  const confirm = useConfirm();
  const undoable = useUndoable();
  const [renaming, setRenaming] = useState(disclosure.renameId === section.id); // a fresh copy opens its rename box at once
  useEffect(() => { if (disclosure.renameId === section.id) disclosure.askToRename(''); }, []); // eslint-disable-line react-hooks/exhaustive-deps
  const index = sections.indexOf(section);

  function locked() {
    if (!isEntryLocked(bill)) return false;
    window.dispatchEvent(new CustomEvent('bill-locked'));
    return true;
  }

  /** A copy of the whole floor right after it; it opens for renaming. */
  function duplicateSection() {
    if (locked()) return;
    const result = entry.duplicateSection(section.id);
    if (!result) return;
    disclosure.askToRename(result.sectionId);
    disclosure.selectSection(result.sectionId);
    onCopied(result);
  }

  function copyAreas(areaIds, targetIds) {
    if (locked()) return;
    const result = entry.copyAreas(section.id, areaIds, targetIds);
    setCopyingAreas(false);
    if (result) onCopied(result);
  }
  const itemCount = countSectionItems(section);

  async function deleteSection() {
    if (section.areas.length) {
      const confirmed = await confirm({
        title: t('Delete {name}?', { name: section.name }),
        message: t('This removes {areas} and {entries}.', { areas: trn(section.areas.length, '{count} area', '{count} areas'), entries: trn(itemCount, '{count} entry', '{count} entries') }),
        confirmLabel: t('Delete'),
        danger: true
      });
      if (!confirmed) return;
    }
    undoable(t('{name} deleted.', { name: section.name }), () => entry.removeSection(section.id));
    onDeleted?.();
  }

  return (
    <Box>
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="subtitle1" noWrap>{section.name}</Typography>
          <Typography variant="caption" color="text.secondary">
            {trn(section.areas.length, '{count} area', '{count} areas')} · {trn(itemCount, '{count} entry', '{count} entries')}
          </Typography>
        </Box>
        <Typography variant="subtitle1" color="primary" sx={{ whiteSpace: 'nowrap' }}>{formatCurrency(getSectionTotal(section, data.rates))}</Typography>
        {!readOnly && <ActionMenu
          label={t('Actions for {name}', { name: section.name })}
          items={[
            { label: t('Rename'), icon: <EditIcon fontSize="small" />, onClick: () => setRenaming(true) },
            { label: t('Move left'), icon: <ArrowBackIcon fontSize="small" />, onClick: () => entry.moveSection(section.id, -1), disabled: index === 0 },
            { label: t('Move right'), icon: <ArrowForwardIcon fontSize="small" />, onClick: () => entry.moveSection(section.id, 1), disabled: index === sections.length - 1 },
            { label: t('Duplicate section'), icon: <LibraryAddIcon fontSize="small" />, onClick: duplicateSection },
            { label: t('Copy several areas to other sections…'), icon: <ContentCopyIcon fontSize="small" />, onClick: () => setCopyingAreas(true), disabled: sections.length < 2 || !section.areas.length },
            { label: t('Delete section'), icon: <DeleteIcon fontSize="small" />, onClick: deleteSection, danger: true }
          ]}
        />}
      </Stack>

      <Stack spacing={1}>
        {section.areas.map((area, areaIndex) => {
          const open = disclosure.isAreaOpen(area.id, areaIndex);
          return (
            <AreaPanel
              key={area.id}
              section={section}
              area={area}
              index={areaIndex}
              sections={sections}
              open={open}
              autoRename={disclosure.renameId === area.id}
              onRenameShown={() => disclosure.askToRename('')}
              onDuplicated={(result) => { disclosure.askToRename(result.areaId); disclosure.reveal(section.id, result.areaIds); onCopied(result); }}
              onToggle={() => disclosure.setAreaOpen(area.id, !open)}
              onCopied={onCopied}
            />
          );
        })}
      </Stack>
      {section.areas.length === 0 && (
        <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>{readOnly ? t('No areas.') : t('No areas yet. Add one to start measuring.')}</Typography>
      )}

      {!readOnly && <Stack direction="row" sx={{ mt: 1.5, flexWrap: 'wrap', gap: 0.75 }}>
        {QUICK_ROOMS.map((name) => (
          <Chip key={name} size="medium" variant="outlined" icon={<AddIcon />} label={t(name)} onClick={() => onAddArea(section.id, t(name))} aria-label={t('Add {name}', { name: t(name) })} />
        ))}
      </Stack>}
      {!readOnly && <Button fullWidth variant="outlined" startIcon={<AddIcon />} onClick={() => onAddArea(section.id)} sx={{ mt: 1.5 }}>
        {t('Add {level}', { level: sublevelName })}
      </Button>}

      <CopyAreasDialog open={copyingAreas} section={section} sections={sections} levelName={levelName} sublevelName={sublevelName} onCopy={copyAreas} onClose={() => setCopyingAreas(false)} />
      <RenameDialog
        open={renaming}
        title={t('Rename {name}', { name: section.name })}
        label={t('{level} name', { level: levelName })}
        value={section.name}
        onSave={(name) => entry.updateSection(section.id, { name })}
        onClose={() => setRenaming(false)}
      />
    </Box>
  );
}

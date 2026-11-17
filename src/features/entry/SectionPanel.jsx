import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import DeleteIcon from '@mui/icons-material/DeleteOutlined';
import { useBilling } from '../../state/BillingContext.jsx';
import { ActionMenu, TextField, useConfirm } from '../../components/ui';
import { countSectionItems, getSectionTotal } from '../../domain/calculations.js';
import { pluralize } from '../../domain/formatters.js';
import { useUndoable } from '../../hooks/useUndoable.js';
import { sectionAnchorId } from './useEntryDisclosure.js';
import GroupSummary from './GroupSummary.jsx';
import AreaPanel from './AreaPanel.jsx';
import { tr as t, trn } from '../../i18n/translate.js';

/**
 * @param {Array<{ area, items }> | null} visibleAreas search results to show instead of every area
 */
export default function SectionPanel({ section, sections, index, open, disclosure, levelName, visibleAreas = null, onAddArea, onCopied }) {
  const searching = Boolean(visibleAreas);
  const shownAreas = visibleAreas || section.areas.map((area) => ({ area, items: null }));
  const { data, actions } = useBilling();
  const { entry } = actions;
  const confirm = useConfirm();
  const undoable = useUndoable();
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
  }

  return (
    <Accordion
      id={sectionAnchorId(section.id)}
      expanded={open}
      onChange={() => disclosure.setSectionOpen(section.id, !open)}
      sx={{ scrollMarginTop: 72 }}
    >
      <AccordionSummary expandIcon={<ExpandMoreIcon />} sx={{ borderLeft: 4, borderColor: 'primary.main' }}>
        <GroupSummary
          name={section.name}
          meta={`${trn(section.areas.length, '{count} area', '{count} areas')} · ${trn(itemCount, '{count} entry', '{count} entries')}`}
          total={getSectionTotal(section, data.rates)}
        />
      </AccordionSummary>
      <AccordionDetails sx={{ px: { xs: 1, sm: 2 } }}>
        <Stack direction="row" spacing={0.5} sx={{ mb: 1.5, alignItems: 'center' }}>
          <TextField label={t('Section name')} value={section.name} onChange={(name) => entry.updateSection(section.id, { name })} />
          <ActionMenu
            label={t('Actions for {name}', { name: section.name })}
            items={[
              { label: t('Move up'), icon: <ArrowUpwardIcon fontSize="small" />, onClick: () => entry.moveSection(section.id, -1), disabled: index === 0 },
              { label: t('Move down'), icon: <ArrowDownwardIcon fontSize="small" />, onClick: () => entry.moveSection(section.id, 1), disabled: index === sections.length - 1 },
              { label: t('Delete section'), icon: <DeleteIcon fontSize="small" />, onClick: deleteSection, danger: true }
            ]}
          />
        </Stack>

        <Stack spacing={1}>
          {shownAreas.map(({ area, items }) => {
            const areaIndex = section.areas.indexOf(area);
            const areaOpen = searching || disclosure.isAreaOpen(area.id, areaIndex);
            return (
              <AreaPanel
                key={area.id}
                section={section}
                area={area}
                index={areaIndex}
                sections={sections}
                open={areaOpen}
                visibleItems={items}
                onToggle={() => disclosure.setAreaOpen(area.id, !areaOpen)}
                onCopied={onCopied}
              />
            );
          })}
        </Stack>
        {!searching && section.areas.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>{t('No areas yet. Add one to start measuring.')}</Typography>
        )}

        <Button fullWidth startIcon={<AddIcon />} onClick={() => onAddArea(section.id)} sx={{ mt: 1.5 }}>
          {t('Add {level}', { level: t(levelName || 'Area').toLowerCase() })}
        </Button>
      </AccordionDetails>
    </Accordion>
  );
}

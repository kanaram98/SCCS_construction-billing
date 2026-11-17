import Accordion from '@mui/material/Accordion';
import AccordionDetails from '@mui/material/AccordionDetails';
import AccordionSummary from '@mui/material/AccordionSummary';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import DeleteIcon from '@mui/icons-material/DeleteOutlined';
import { useBilling } from '../../state/BillingContext.jsx';
import { ActionMenu, TextField, useConfirm } from '../../components/ui';
import { countSectionItems, getSectionTotal } from '../../domain/calculations.js';
import { pluralize } from '../../domain/formatters.js';
import { sectionAnchorId } from './useEntryDisclosure.js';
import GroupSummary from './GroupSummary.jsx';
import AreaPanel from './AreaPanel.jsx';

export default function SectionPanel({ section, sections, open, disclosure, levelName, onAddArea, onCopied }) {
  const { data, actions } = useBilling();
  const { entry } = actions;
  const confirm = useConfirm();
  const itemCount = countSectionItems(section);

  async function deleteSection() {
    if (section.areas.length) {
      const confirmed = await confirm({
        title: `Delete ${section.name}?`,
        message: `This removes ${section.areas.length} ${pluralize(section.areas.length, 'area')} and ${itemCount} ${pluralize(itemCount, 'entry', 'entries')}.`,
        confirmLabel: 'Delete',
        danger: true
      });
      if (!confirmed) return;
    }
    entry.removeSection(section.id);
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
          meta={`${section.areas.length} ${pluralize(section.areas.length, 'area')} · ${itemCount} ${pluralize(itemCount, 'entry', 'entries')}`}
          total={getSectionTotal(section, data.rates)}
        />
      </AccordionSummary>
      <AccordionDetails sx={{ px: { xs: 1, sm: 2 } }}>
        <Stack direction="row" spacing={0.5} sx={{ mb: 1.5, alignItems: 'center' }}>
          <TextField label="Section name" value={section.name} onChange={(name) => entry.updateSection(section.id, { name })} />
          <ActionMenu
            label={`Actions for ${section.name}`}
            items={[{ label: 'Delete section', icon: <DeleteIcon fontSize="small" />, onClick: deleteSection, danger: true }]}
          />
        </Stack>

        <Stack spacing={1}>
          {section.areas.map((area, areaIndex) => {
            const areaOpen = disclosure.isAreaOpen(area.id, areaIndex);
            return (
              <AreaPanel
                key={area.id}
                section={section}
                area={area}
                sections={sections}
                open={areaOpen}
                onToggle={() => disclosure.setAreaOpen(area.id, !areaOpen)}
                onCopied={onCopied}
              />
            );
          })}
        </Stack>
        {section.areas.length === 0 && (
          <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>No areas yet. Add one to start measuring.</Typography>
        )}

        <Button fullWidth startIcon={<AddIcon />} onClick={() => onAddArea(section.id)} sx={{ mt: 1.5 }}>
          Add {levelName || 'area'}
        </Button>
      </AccordionDetails>
    </Accordion>
  );
}

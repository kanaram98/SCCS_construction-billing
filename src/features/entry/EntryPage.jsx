import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import BookmarksIcon from '@mui/icons-material/BookmarksOutlined';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdfOutlined';
import StraightenIcon from '@mui/icons-material/Straighten';
import UnfoldLessIcon from '@mui/icons-material/UnfoldLess';
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore';
import { useBilling } from '../../state/BillingContext.jsx';
import { BottomActionBar, EmptyState, IssuesAlert, PageHeading, SelectField, useNotify } from '../../components/ui';
import { countBillContents, getBillTotals } from '../../domain/calculations.js';
import { getBillValidation } from '../../domain/validation.js';
import { formatCurrency, pluralize } from '../../domain/formatters.js';
import { VIEWS } from '../../config/app.js';
import { useEntryDisclosure } from './useEntryDisclosure.js';
import SectionPanel from './SectionPanel.jsx';
import TemplatesDialog from './TemplatesDialog.jsx';

export default function EntryPage({ onNavigate }) {
  const { data, bill, actions } = useBilling();
  const notify = useNotify();
  const sections = bill.sections || [];
  const disclosure = useEntryDisclosure(sections);
  const [templatesOpen, setTemplatesOpen] = useState(false);

  const totals = useMemo(() => getBillTotals(bill, data.rates), [bill, data.rates]);
  const errors = useMemo(() => getBillValidation(bill, data.rates), [bill, data.rates]);
  const counts = countBillContents(bill);
  const sectionLabel = bill.firstLevelName || 'Section';

  /** Shows the result of a copy or template action and expands what it created. */
  function showResult(result) {
    disclosure.reveal(result.sectionId, result.areaIds);
    notify(result.message);
  }

  function addSection() {
    const section = actions.entry.addSection();
    disclosure.reveal(section.id);
  }

  function addArea(sectionId) {
    const area = actions.entry.addArea(sectionId);
    if (area) disclosure.reveal(sectionId, [area.id]);
  }

  return (
    <section>
      <PageHeading
        eyebrow={`Bill ${bill.number || '—'}${bill.projectName ? ` · ${bill.projectName}` : ''}`}
        title="Measurements"
        action={<Chip color="primary" variant="outlined" label={formatCurrency(totals.total)} sx={{ fontWeight: 700 }} />}
      />

      <Stack direction="row" spacing={1} sx={{ mb: 1.5, alignItems: 'center' }}>
        <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
          {counts.sections} {pluralize(counts.sections, 'section')} · {counts.areas} {pluralize(counts.areas, 'area')} · {counts.items} {pluralize(counts.items, 'entry', 'entries')}
        </Typography>
        <Tooltip title="Templates">
          <IconButton aria-label="Templates" onClick={() => setTemplatesOpen(true)}><BookmarksIcon /></IconButton>
        </Tooltip>
        {sections.length > 0 && (
          <Tooltip title={disclosure.anySectionOpen ? 'Collapse all' : 'Expand all'}>
            <IconButton aria-label={disclosure.anySectionOpen ? 'Collapse all' : 'Expand all'} onClick={disclosure.toggleAllSections}>
              {disclosure.anySectionOpen ? <UnfoldLessIcon /> : <UnfoldMoreIcon />}
            </IconButton>
          </Tooltip>
        )}
        <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={addSection}>{sectionLabel}</Button>
      </Stack>

      {sections.length > 1 && (
        <SelectField
          label={`Go to ${sectionLabel.toLowerCase()}`}
          value=""
          placeholder={`Jump to a ${sectionLabel.toLowerCase()}…`}
          options={sections.map((section) => ({ value: section.id, label: section.name }))}
          onChange={(sectionId) => sectionId && disclosure.reveal(sectionId)}
          sx={{ mb: 1.5, bgcolor: 'background.paper' }}
        />
      )}

      {counts.items > 0 && <IssuesAlert issues={errors} suffix="to fix before export" />}

      {sections.length === 0 && (
        <EmptyState
          icon={<StraightenIcon />}
          title={`Start with a ${sectionLabel.toLowerCase()}`}
          description={`Add a ${sectionLabel.toLowerCase()} (e.g. a floor), then ${(bill.secondLevelName || 'area').toLowerCase()}s and their measurements.`}
          action={<Button variant="contained" startIcon={<AddIcon />} onClick={addSection}>Add first {sectionLabel.toLowerCase()}</Button>}
        />
      )}

      <Stack spacing={1.25}>
        {sections.map((section, index) => (
          <SectionPanel
            key={section.id}
            section={section}
            sections={sections}
            index={index}
            open={disclosure.isSectionOpen(section.id, index)}
            disclosure={disclosure}
            levelName={bill.secondLevelName}
            onAddArea={addArea}
            onCopied={showResult}
          />
        ))}
      </Stack>

      {sections.length > 0 && (
        <BottomActionBar>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="caption" color="text.secondary" component="div" noWrap>Grand total</Typography>
            <Typography variant="h6" color="primary" noWrap>{formatCurrency(totals.total)}</Typography>
          </Box>
          <Button variant="contained" startIcon={<PictureAsPdfIcon />} onClick={() => onNavigate(VIEWS.print)}>Review PDF</Button>
        </BottomActionBar>
      )}

      <TemplatesDialog open={templatesOpen} onClose={() => setTemplatesOpen(false)} onApplied={showResult} />
    </section>
  );
}

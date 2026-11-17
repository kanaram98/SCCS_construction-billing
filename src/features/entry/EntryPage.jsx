import { useMemo, useState } from 'react';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Chip from '@mui/material/Chip';
import IconButton from '@mui/material/IconButton';
import Stack from '@mui/material/Stack';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import SearchIcon from '@mui/icons-material/Search';
import InputAdornment from '@mui/material/InputAdornment';
import BookmarksIcon from '@mui/icons-material/BookmarksOutlined';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdfOutlined';
import StraightenIcon from '@mui/icons-material/Straighten';
import UnfoldLessIcon from '@mui/icons-material/UnfoldLess';
import UnfoldMoreIcon from '@mui/icons-material/UnfoldMore';
import { useBilling } from '../../state/BillingContext.jsx';
import { BottomActionBar, EmptyState, IssuesAlert, PageHeading, SelectField, TextField, useNotify } from '../../components/ui';
import { countSearchResults, searchEntries } from '../../domain/entry-search.js';
import { countBillContents, getBillTotals } from '../../domain/calculations.js';
import { getBillValidation } from '../../domain/validation.js';
import { formatCurrency } from '../../domain/formatters.js';
import { VIEWS } from '../../config/app.js';
import { useEntryDisclosure } from './useEntryDisclosure.js';
import SectionPanel from './SectionPanel.jsx';
import TemplatesDialog from './TemplatesDialog.jsx';
import GettingStarted from './GettingStarted.jsx';
import { billLabel } from '../../domain/bill-kinds.js';
import Alert from '@mui/material/Alert';
import { tr as t, trn } from '../../i18n/translate.js';

export default function EntryPage({ onNavigate }) {
  const { data, bill, actions } = useBilling();
  const notify = useNotify();
  const sections = bill.sections || [];
  const disclosure = useEntryDisclosure(sections);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const [query, setQuery] = useState('');
  const results = useMemo(() => searchEntries(sections, data.rates, query), [sections, data.rates, query]);
  const shownSections = results || sections.map((section) => ({ section, areas: null }));

  const totals = useMemo(() => getBillTotals(bill, data.rates), [bill, data.rates]);
  const errors = useMemo(() => getBillValidation(bill, data.rates), [bill, data.rates]);
  const counts = countBillContents(bill);
  /** Level names are user-editable; common defaults (Section, Floor…) are translated. */
  const sectionLabel = t(bill.firstLevelName || 'Section');
  const areaLabel = t(bill.secondLevelName || 'Area');

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
        eyebrow={`${billLabel(bill, t)}${bill.projectName ? ` · ${bill.projectName}` : ''}`}
        title={t('Measurements')}
        action={<Chip color="primary" variant="outlined" label={formatCurrency(totals.total)} sx={{ fontWeight: 700 }} />}
      />

      <Stack direction="row" spacing={1} sx={{ mb: 1.5, alignItems: 'center' }}>
        <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }}>
          {trn(counts.sections, '{count} section', '{count} sections')} · {trn(counts.areas, '{count} area', '{count} areas')} · {trn(counts.items, '{count} entry', '{count} entries')}
        </Typography>
        <Tooltip title={t('Templates')}>
          <IconButton aria-label={t('Templates')} onClick={() => setTemplatesOpen(true)}><BookmarksIcon /></IconButton>
        </Tooltip>
        {sections.length > 0 && (
          <Tooltip title={disclosure.anySectionOpen ? t('Collapse all') : t('Expand all')}>
            <IconButton aria-label={disclosure.anySectionOpen ? t('Collapse all') : t('Expand all')} onClick={disclosure.toggleAllSections}>
              {disclosure.anySectionOpen ? <UnfoldLessIcon /> : <UnfoldMoreIcon />}
            </IconButton>
          </Tooltip>
        )}
        <Button variant="contained" size="small" startIcon={<AddIcon />} onClick={addSection}>{sectionLabel}</Button>
      </Stack>

      {bill.isSample && (
        <Alert severity="info" sx={{ mb: 1.5 }}>{t('This is a sample bill to explore. Delete it from Bills when you are done.')}</Alert>
      )}
      {counts.items === 0 && <GettingStarted counts={counts} levelName={sectionLabel.toLowerCase()} sublevelName={areaLabel.toLowerCase()} />}

      {counts.items > 0 && (
        <TextField
          type="search"
          value={query}
          placeholder={t('Search entries, notes or rooms')}
          onChange={setQuery}
          helperText={results ? trn(countSearchResults(results), '{count} matching entry', '{count} matching entries') : undefined}
          slotProps={{
            input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> },
            htmlInput: { 'aria-label': t('Search entries') }
          }}
          sx={{ mb: 1.5, bgcolor: 'background.paper' }}
        />
      )}

      {!results && sections.length > 1 && (
        <SelectField
          label={t('Go to {level}', { level: sectionLabel.toLowerCase() })}
          value=""
          placeholder={t('Jump to a {level}…', { level: sectionLabel.toLowerCase() })}
          options={sections.map((section) => ({ value: section.id, label: section.name }))}
          onChange={(sectionId) => sectionId && disclosure.reveal(sectionId)}
          sx={{ mb: 1.5, bgcolor: 'background.paper' }}
        />
      )}

      {counts.items > 0 && <IssuesAlert issues={errors} suffix={t('to fix before export')} />}

      {sections.length === 0 && (
        <EmptyState
          icon={<StraightenIcon />}
          title={t('Start with a {level}', { level: sectionLabel.toLowerCase() })}
          description={t('Add a {level} (e.g. a floor), then its {sublevel}s and their measurements.', { level: sectionLabel.toLowerCase(), sublevel: areaLabel.toLowerCase() })}
          action={<Button variant="contained" startIcon={<AddIcon />} onClick={addSection}>{t('Add first {level}', { level: sectionLabel.toLowerCase() })}</Button>}
        />
      )}

      <Stack spacing={1.25}>
        {shownSections.map(({ section, areas }) => (
          <SectionPanel
            key={section.id}
            section={section}
            sections={sections}
            index={sections.indexOf(section)}
            visibleAreas={areas}
            open={Boolean(results) || disclosure.isSectionOpen(section.id, sections.indexOf(section))}
            disclosure={disclosure}
            levelName={bill.secondLevelName}
            onAddArea={addArea}
            onCopied={showResult}
          />
        ))}
      </Stack>

      {results && results.length === 0 && (
        <EmptyState
          compact
          title={t('No matching entries')}
          description={t('Nothing matches “{query}”.', { query: query.trim() })}
          action={<Button onClick={() => setQuery('')}>{t('Clear search')}</Button>}
        />
      )}

      {sections.length > 0 && (
        <BottomActionBar>
          <Box sx={{ minWidth: 0 }}>
            <Typography variant="caption" color="text.secondary" component="div" noWrap>{t('Grand total')}</Typography>
            <Typography variant="h6" color="primary" noWrap>{formatCurrency(totals.total)}</Typography>
          </Box>
          <Button variant="contained" startIcon={<PictureAsPdfIcon />} onClick={() => onNavigate(VIEWS.print)}>{t('Review PDF')}</Button>
        </BottomActionBar>
      )}

      <TemplatesDialog open={templatesOpen} onClose={() => setTemplatesOpen(false)} onApplied={showResult} />
    </section>
  );
}

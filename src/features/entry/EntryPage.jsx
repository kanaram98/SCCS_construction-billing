import { useEffect, useMemo, useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Collapse from '@mui/material/Collapse';
import IconButton from '@mui/material/IconButton';
import InputAdornment from '@mui/material/InputAdornment';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import Tooltip from '@mui/material/Tooltip';
import Typography from '@mui/material/Typography';
import AddIcon from '@mui/icons-material/Add';
import BookmarksIcon from '@mui/icons-material/BookmarksOutlined';
import PictureAsPdfIcon from '@mui/icons-material/PictureAsPdfOutlined';
import SearchIcon from '@mui/icons-material/Search';
import StraightenIcon from '@mui/icons-material/Straighten';
import { useBilling } from '../../state/BillingContext.jsx';
import { BottomActionBar, EmptyState, IssuesAlert, TextField, useNotify } from '../../components/ui';
import { countSearchResults, searchEntries } from '../../domain/entry-search.js';
import { countBillContents, getBillTotals } from '../../domain/calculations.js';
import { getBillValidation } from '../../domain/validation.js';
import { formatCurrency } from '../../domain/formatters.js';
import { billLabel, isEstimate } from '../../domain/bill-kinds.js';
import { VIEWS } from '../../config/app.js';
import { tr as t, trn } from '../../i18n/translate.js';
import { useEntryDisclosure } from './useEntryDisclosure.js';
import FloorBar from './FloorBar.jsx';
import FloorPanel from './FloorPanel.jsx';
import AreaPanel from './AreaPanel.jsx';
import TemplatesDialog from './TemplatesDialog.jsx';
import AmountsCard from '../project/AmountsCard.jsx';
import { isFinal } from '../../domain/bill-final.js';
import PaymentsCard from '../project/PaymentsCard.jsx';

const TABS = { measure: 'measure', amounts: 'amounts' };

export default function EntryPage({ onNavigate }) {
  const { data, bill, actions } = useBilling();
  const notify = useNotify();
  const sections = bill.sections || [];
  const disclosure = useEntryDisclosure(sections);
  const [tab, setTab] = useState(TABS.measure);
  const [templatesOpen, setTemplatesOpen] = useState(false);
  const locked = isFinal(bill);
  useEffect(() => {
    const inform = () => notify(t('This bill is final. Reopen it in Bill details to make changes.'), 'info');
    window.addEventListener('bill-locked', inform);
    return () => window.removeEventListener('bill-locked', inform);
  }, [notify]);
  const [searchOpen, setSearchOpen] = useState(false);
  const [query, setQuery] = useState('');
  const results = useMemo(() => searchEntries(sections, data.rates, query), [sections, data.rates, query]);

  const totals = useMemo(() => getBillTotals(bill, data.rates), [bill, data.rates]);
  const errors = useMemo(() => getBillValidation(bill, data.rates), [bill, data.rates]);
  const counts = countBillContents(bill);
  /** Level names are user-editable; common defaults (Section, Floor…) are translated. */
  const sectionLabel = t(bill.firstLevelName || 'Section');
  const areaLabel = t(bill.secondLevelName || 'Area');

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

  function toggleSearch() {
    if (searchOpen) setQuery('');
    setSearchOpen((open) => !open);
  }

  return (
    <section>
      {/* Compact header: which bill, and its total */}
      <Stack direction="row" spacing={1} sx={{ alignItems: 'center', mb: 1 }}>
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 650 }} noWrap component="div">
            {billLabel(bill, t)}{bill.projectName ? ` · ${bill.projectName}` : ''}
          </Typography>
          <Typography variant="h6" component="h1" noWrap>{bill.client || t('No client')}</Typography>
        </Box>
        <Box sx={{ textAlign: 'right' }}>
          <Typography variant="caption" color="text.secondary" component="div">{t('Total')}</Typography>
          <Typography variant="h6" color="primary" sx={{ whiteSpace: 'nowrap' }}>{formatCurrency(totals.total)}</Typography>
        </Box>
      </Stack>

      <Paper variant="outlined" sx={{ mb: 1.5 }}>
        <Tabs value={tab} onChange={(_event, value) => setTab(value)} variant="fullWidth">
          <Tab value={TABS.measure} label={t('Measurements')} sx={{ minHeight: 44 }} />
          <Tab value={TABS.amounts} label={isEstimate(bill) ? t('Amounts') : t('Amounts & payments')} sx={{ minHeight: 44 }} />
        </Tabs>
      </Paper>

      {locked && <Alert severity="info" sx={{ mb: 1.5 }}>{t('This bill is final: prices are frozen and measurements are locked. Payments can still be added.')}</Alert>}
      {bill.isSample && (
        <Alert severity="info" sx={{ mb: 1.5 }}>{t('This is a sample bill to explore. Delete it from Bills when you are done.')}</Alert>
      )}

      {tab === TABS.amounts ? (
        <>
          <IssuesAlert issues={errors} suffix={t('to fix before export')} />
          <Box component="fieldset" disabled={locked} sx={{ border: 0, p: 0, m: 0, minWidth: 0 }}><AmountsCard /></Box>
          {!isEstimate(bill) && <PaymentsCard />}
        </>
      ) : (
        <>

          <Stack direction="row" spacing={0.5} sx={{ alignItems: 'center', mb: 0.5 }}>
            <Typography variant="body2" color="text.secondary" sx={{ flex: 1 }} noWrap>
              {trn(counts.areas, '{count} area', '{count} areas')} · {trn(counts.items, '{count} entry', '{count} entries')}
            </Typography>
            {counts.items > 0 && (
              <Tooltip title={t('Search entries')}>
                <IconButton aria-label={t('Search entries')} onClick={toggleSearch} color={searchOpen ? 'primary' : 'default'}><SearchIcon /></IconButton>
              </Tooltip>
            )}
            <Tooltip title={t('Templates')}>
              <IconButton aria-label={t('Templates')} onClick={() => setTemplatesOpen(true)}><BookmarksIcon /></IconButton>
            </Tooltip>
          </Stack>

          <Collapse in={searchOpen} unmountOnExit>
            <TextField
              type="search"
              value={query}
              autoFocus
              placeholder={t('Search entries, notes or rooms')}
              onChange={setQuery}
              helperText={results ? trn(countSearchResults(results), '{count} matching entry', '{count} matching entries') : undefined}
              slotProps={{
                input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> },
                htmlInput: { 'aria-label': t('Search entries') }
              }}
              sx={{ mb: 1.5, bgcolor: 'background.paper' }}
            />
          </Collapse>

          {counts.items > 0 && <IssuesAlert issues={errors} suffix={t('to fix before export')} />}

          {results ? (
            <SearchResults results={results} sections={sections} onCopied={showResult} onClear={() => setQuery('')} query={query} />
          ) : (
            <>
              <FloorBar
                sections={sections}
                activeId={disclosure.activeSection?.id}
                addLabel={sectionLabel}
                onSelect={disclosure.selectSection}
                onAdd={addSection}
              />
              {disclosure.activeSection ? (
                <FloorPanel
                  key={disclosure.activeSection.id}
                  section={disclosure.activeSection}
                  sections={sections}
                  disclosure={disclosure}
                  levelName={sectionLabel}
                  sublevelName={areaLabel.toLowerCase()}
                  onAddArea={addArea}
                  onCopied={showResult}
                />
              ) : (
                <EmptyState
                  icon={<StraightenIcon />}
                  title={t('Start with a {level}', { level: sectionLabel.toLowerCase() })}
                  description={t('Add a {level} (e.g. a floor), then its {sublevel}s and their measurements.', { level: sectionLabel.toLowerCase(), sublevel: areaLabel.toLowerCase() })}
                  action={<Button variant="contained" startIcon={<AddIcon />} onClick={addSection}>{t('Add first {level}', { level: sectionLabel.toLowerCase() })}</Button>}
                />
              )}
            </>
          )}
        </>
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

/** Matching entries across all floors, grouped by floor and room. */
function SearchResults({ results, sections, onCopied, onClear, query }) {
  if (!results.length) {
    return (
      <EmptyState
        compact
        title={t('No matching entries')}
        description={t('Nothing matches “{query}”.', { query: query.trim() })}
        action={<Button onClick={onClear}>{t('Clear search')}</Button>}
      />
    );
  }
  return (
    <Stack spacing={1.5}>
      {results.map(({ section, areas }) => (
        <Box key={section.id}>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 0.75 }}>{section.name}</Typography>
          <Stack spacing={1}>
            {areas.map(({ area, items }) => (
              <AreaPanel
                key={area.id}
                section={section}
                area={area}
                index={section.areas.indexOf(area)}
                sections={sections}
                open
                visibleItems={items}
                onToggle={() => {}}
                onCopied={onCopied}
              />
            ))}
          </Stack>
        </Box>
      ))}
    </Stack>
  );
}

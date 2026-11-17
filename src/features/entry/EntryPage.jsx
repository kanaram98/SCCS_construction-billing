import { useMemo, useState } from 'react';
import { useBilling } from '../../state/BillingContext.jsx';
import { Button, EmptyState } from '../../components/ui';
import { countBillContents, getBillTotals } from '../../domain/calculations.js';
import { getBillValidation } from '../../domain/validation.js';
import { formatCurrency, pluralize } from '../../domain/formatters.js';
import { VIEWS } from '../../config/app.js';
import { useEntryDisclosure } from './useEntryDisclosure.js';
import SectionNavigation from './SectionNavigation.jsx';
import TemplateLibrary from './TemplateLibrary.jsx';
import SectionPanel from './SectionPanel.jsx';

export default function EntryPage({ onNavigate }) {
  const { data, bill, actions } = useBilling();
  const sections = bill.sections || [];
  const disclosure = useEntryDisclosure(sections);
  const [copyMessage, setCopyMessage] = useState('');

  const totals = useMemo(() => getBillTotals(bill, data.rates), [bill, data.rates]);
  const errors = useMemo(() => getBillValidation(bill, data.rates), [bill, data.rates]);
  const counts = countBillContents(bill);
  const countsLabel = `${counts.sections} sections · ${counts.areas} areas · ${counts.items} entries`;

  /** Shows the result of a copy or template action and expands what it created. */
  function showResult(result) {
    disclosure.reveal(result.sectionId, result.areaIds);
    setCopyMessage(result.message);
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
    <section className="entry-page">
      <header className="entry-page-header">
        <div>
          <span className="entry-eyebrow">Bill {bill.number || '—'}{bill.projectName ? ` · ${bill.projectName}` : ''}</span>
          <h1>Measurements</h1>
        </div>
        <div className="entry-total-chip">
          <span>Current total</span>
          <strong>{formatCurrency(totals.total)}</strong>
        </div>
      </header>

      <div className="entry-toolbar">
        <span>{countsLabel}</span>
        <div>
          {sections.length > 0 && (
            <Button variant="subtle" onClick={disclosure.toggleAllSections}>
              {disclosure.anySectionOpen ? 'Collapse sections' : 'Expand sections'}
            </Button>
          )}
          <Button variant="primary" size="compact" onClick={addSection}>+ Section</Button>
        </div>
      </div>

      {sections.length > 1 && (
        <SectionNavigation
          sections={sections}
          activeSection={disclosure.activeSection}
          mode={disclosure.navigationMode}
          onModeChange={disclosure.changeNavigationMode}
          onSelectSection={(sectionId) => disclosure.reveal(sectionId)}
        />
      )}

      <TemplateLibrary activeSection={disclosure.activeSection} onApplied={showResult} />
      {copyMessage && <p className="entry-copy-status" role="status">{copyMessage}</p>}

      {errors.length > 0 && counts.items > 0 && (
        <details className="entry-validation">
          <summary>{errors.length} validation {pluralize(errors.length, 'issue')} to fix</summary>
          <ul>{errors.map((error, index) => <li key={`${error}-${index}`}>{error}</li>)}</ul>
        </details>
      )}

      {sections.length === 0 && (
        <EmptyState
          className="entry-empty"
          title="Start with a section"
          description="Add a section, then an area and record entries with the shared form."
          action={<Button variant="primary" onClick={addSection}>+ Add first section</Button>}
        />
      )}

      <div className="entry-groups">
        {disclosure.visibleSections.map((section, index) => (
          <SectionPanel
            key={section.id}
            section={section}
            sections={sections}
            open={disclosure.isSectionOpen(section.id, index)}
            disclosure={disclosure}
            onAddArea={addArea}
            onCopied={showResult}
          />
        ))}
      </div>

      {sections.length > 0 && (
        <div className="entry-total-dock">
          <div className="dock-detail">
            <span>{countsLabel}</span>
            <strong>Grand total · {formatCurrency(totals.total)}</strong>
          </div>
          <Button variant="primary" onClick={() => onNavigate(VIEWS.print)}>Review PDF</Button>
        </div>
      )}
    </section>
  );
}

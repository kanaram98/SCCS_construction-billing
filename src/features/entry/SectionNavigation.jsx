import { SelectField } from '../../components/ui';
import { NAVIGATION_MODES } from './useEntryDisclosure.js';

const MODES = [
  { id: NAVIGATION_MODES.select, label: 'Section picker' },
  { id: NAVIGATION_MODES.list, label: 'Full list' }
];

/** Switch between showing one section at a time and the full list. */
export default function SectionNavigation({ sections, activeSection, mode, onModeChange, onSelectSection }) {
  return (
    <div className="entry-navigation">
      <div className="entry-navigation-modes" role="group" aria-label="Section display mode">
        {MODES.map(({ id, label }) => (
          <button
            key={id}
            type="button"
            className={mode === id ? 'active' : ''}
            aria-pressed={mode === id}
            onClick={() => onModeChange(id)}
          >{label}</button>
        ))}
      </div>
      {mode === NAVIGATION_MODES.select && (
        <SelectField
          label="Go to section"
          value={activeSection?.id || ''}
          options={sections.map((section) => ({ value: section.id, label: section.name }))}
          onChange={onSelectSection}
        />
      )}
    </div>
  );
}

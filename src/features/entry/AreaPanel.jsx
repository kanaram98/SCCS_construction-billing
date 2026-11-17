import { useBilling } from '../../state/BillingContext.jsx';
import { Button } from '../../components/ui';
import { getAreaTotal } from '../../domain/calculations.js';
import { pluralize } from '../../domain/formatters.js';
import GroupHeader from './GroupHeader.jsx';
import CopyToSectionSelect from './CopyToSectionSelect.jsx';
import AreaEntries from './AreaEntries.jsx';

export default function AreaPanel({ section, area, sections, open, onToggle, onCopied }) {
  const { data, actions } = useBilling();
  const { entry } = actions;

  function copyArea(targetSectionId) {
    const result = entry.copyArea(section.id, area.id, targetSectionId);
    if (result) onCopied(result);
  }

  return (
    <article className={`entry-area ${open ? 'is-open' : ''}`}>
      <GroupHeader
        className="area-group-header"
        open={open}
        name={area.name}
        nameLabel="Area name"
        meta={`${area.items.length} ${pluralize(area.items.length, 'entry', 'entries')}`}
        total={getAreaTotal(area, data.rates)}
        onToggle={onToggle}
        onRename={(name) => entry.updateArea(section.id, area.id, { name })}
      >
        <CopyToSectionSelect
          className="copy-area-select"
          label={`Copy ${area.name} to section`}
          placeholder="Copy area to…"
          sections={sections}
          currentSectionId={section.id}
          onSelect={copyArea}
        />
        <Button variant="danger" size="compact" onClick={() => entry.removeArea(section.id, area.id)}>Remove</Button>
      </GroupHeader>

      <div className="entry-area-content" hidden={!open}>
        <AreaEntries sectionId={section.id} area={area} sections={sections} onCopied={onCopied} />
      </div>
    </article>
  );
}

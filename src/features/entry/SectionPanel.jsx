import { useBilling } from '../../state/BillingContext.jsx';
import { Button } from '../../components/ui';
import { countSectionItems, getSectionTotal } from '../../domain/calculations.js';
import GroupHeader from './GroupHeader.jsx';
import AreaPanel from './AreaPanel.jsx';

export default function SectionPanel({ section, sections, open, disclosure, onAddArea, onCopied }) {
  const { data, actions } = useBilling();
  const { entry } = actions;

  return (
    <article className={`entry-section ${open ? 'is-open' : ''}`}>
      <GroupHeader
        className="section-group-header"
        open={open}
        name={section.name}
        nameLabel="Section name"
        meta={`${section.areas.length} areas · ${countSectionItems(section)} entries`}
        total={getSectionTotal(section, data.rates)}
        onToggle={() => disclosure.setSectionOpen(section.id, !open)}
        onRename={(name) => entry.updateSection(section.id, { name })}
      >
        <Button variant="subtle" onClick={() => onAddArea(section.id)}>+ Area</Button>
        <Button variant="danger" size="compact" onClick={() => entry.removeSection(section.id)}>Remove</Button>
      </GroupHeader>

      {open && (
        <div className="entry-section-content">
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
          {section.areas.length === 0 && <p className="area-empty-note">No areas yet. Add an area to start measuring.</p>}
        </div>
      )}
    </article>
  );
}

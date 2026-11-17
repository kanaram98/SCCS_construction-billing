import { useState } from 'react';
import { useBilling } from '../../state/BillingContext.jsx';
import { Button, CollapsibleCard, EmptyState, SelectField, TextField } from '../../components/ui';
import { createTemplateContent } from '../../domain/bill-tree.js';
import { getTemplateSources, parseTemplateSource } from '../../domain/templates.js';

/** Save sections/areas as reusable templates and add saved templates to the bill. */
export default function TemplateLibrary({ activeSection, onApplied }) {
  const { data, bill, actions } = useBilling();
  const { templates } = data;
  const [source, setSource] = useState('');
  const [name, setName] = useState('');
  const [message, setMessage] = useState('');

  function saveTemplate(event) {
    event.preventDefault();
    const { type, sectionId, areaId } = parseTemplateSource(source);
    const content = createTemplateContent(bill, type, sectionId, areaId);
    if (!content) {
      setMessage('Choose a section or area to save as a template.');
      return;
    }
    const saved = actions.templates.save({ type, name, content });
    setMessage(saved
      ? `Saved “${name.trim()}” for reuse on this device.`
      : 'Enter a unique template name before saving.');
    if (saved) setName('');
  }

  function applyTemplate(template) {
    const result = actions.templates.apply(template.id, activeSection?.id);
    if (!result) {
      setMessage('Choose a section before adding an area template.');
      return;
    }
    setMessage('');
    onApplied(result);
  }

  return (
    <CollapsibleCard className="template-library" title="Reusable templates" meta={`${templates.length} saved`}>
      <p>Save a section or area with its items and measurements, then reuse it in another bill.</p>
      <form className="template-save-form" onSubmit={saveTemplate}>
        <SelectField
          label="Save from"
          value={source}
          placeholder="Choose a section or area"
          options={getTemplateSources(bill.sections)}
          onChange={setSource}
        />
        <TextField label="Template name" value={name} placeholder="e.g. Standard bathroom" onChange={setName} />
        <Button variant="primary" type="submit" disabled={!source || !name.trim()}>Save template</Button>
      </form>
      {message && <p className="entry-copy-status" role="status">{message}</p>}

      {templates.length > 0 ? (
        <div className="template-list">
          {templates.map((template) => (
            <div className="template-row" key={template.id}>
              <div>
                <strong>{template.name}</strong>
                <small>
                  {template.type === 'section'
                    ? 'Section template · adds a new section'
                    : 'Area template · adds to the selected section'}
                </small>
              </div>
              <div className="template-actions">
                <Button disabled={template.type === 'area' && !activeSection} onClick={() => applyTemplate(template)}>
                  {template.type === 'section' ? 'Add section' : 'Add area'}
                </Button>
                <Button variant="danger" onClick={() => actions.templates.remove(template.id)}>Remove</Button>
              </div>
            </div>
          ))}
        </div>
      ) : <EmptyState compact description="No templates yet. Save a section or area above." />}
    </CollapsibleCard>
  );
}

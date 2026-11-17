import { newId } from './ids.js';
import { sameText, text } from './formatters.js';

export const TEMPLATE_TYPES = Object.freeze(['section', 'area']);

/** Validates and builds a template record, or returns `null` when it can't be saved. */
export function createTemplate(existing, template) {
  const name = text(template?.name);
  if (!name || !TEMPLATE_TYPES.includes(template?.type) || !template.content) return null;
  if (existing.some((entry) => sameText(entry.name, name))) return null;
  return { ...template, id: newId(), name };
}

/** Options for the "Save from" picker: every section, and every area within it. */
export function getTemplateSources(sections) {
  return sections.flatMap((section, sectionIndex) => [
    { value: `section|${section.id}`, label: `Section · ${section.name} (${sectionIndex + 1})` },
    ...section.areas.map((area, areaIndex) => ({
      value: `area|${section.id}|${area.id}`,
      label: `Area · ${section.name} (${sectionIndex + 1}) / ${area.name} (${areaIndex + 1})`
    }))
  ]);
}

export function parseTemplateSource(value) {
  const [type, sectionId, areaId] = String(value || '').split('|');
  return { type, sectionId, areaId };
}

/**
 * Immutable operations on a bill's section → area → item tree.
 *
 * Simple updates take a bill and return a new bill. Operations that create
 * entities and need to report back (copying, templates) return
 * `{ apply(bill), result }`: ids are generated once up front, so `apply` can be
 * run against the latest state while `result` tells the UI what was created.
 */
import { createArea, createSection, cloneItems } from './factories.js';
import { sameText } from './formatters.js';

export const applyPatch = (target, updater) =>
  typeof updater === 'function' ? updater(target) : { ...target, ...updater };

const findSection = (bill, sectionId) => bill.sections.find((section) => section.id === sectionId);

export function updateSection(bill, sectionId, updater) {
  return {
    ...bill,
    sections: bill.sections.map((section) => section.id === sectionId ? applyPatch(section, updater) : section)
  };
}

export function updateArea(bill, sectionId, areaId, updater) {
  return updateSection(bill, sectionId, (section) => ({
    ...section,
    areas: section.areas.map((area) => area.id === areaId ? applyPatch(area, updater) : area)
  }));
}

export function updateItem(bill, sectionId, areaId, itemId, patch) {
  return updateArea(bill, sectionId, areaId, (area) => ({
    ...area,
    items: area.items.map((item) => item.id === itemId ? { ...item, ...patch } : item)
  }));
}

export function appendSection(bill, section) {
  return { ...bill, sections: [...bill.sections, section] };
}

export function appendArea(bill, sectionId, area) {
  return updateSection(bill, sectionId, (section) => ({ ...section, areas: [...section.areas, area] }));
}

export function appendItems(bill, sectionId, areaId, items) {
  return updateArea(bill, sectionId, areaId, (area) => ({ ...area, items: [...area.items, ...items] }));
}

export function removeSection(bill, sectionId) {
  return { ...bill, sections: bill.sections.filter((section) => section.id !== sectionId) };
}

export function removeArea(bill, sectionId, areaId) {
  return updateSection(bill, sectionId, (section) => ({
    ...section,
    areas: section.areas.filter((area) => area.id !== areaId)
  }));
}

export function removeItem(bill, sectionId, areaId, itemId) {
  return updateArea(bill, sectionId, areaId, (area) => ({
    ...area,
    items: area.items.filter((item) => item.id !== itemId)
  }));
}

/**
 * Places copied items in the target section: into an area with the same name
 * when one exists, otherwise into a new area named after the source area.
 */
function placeItemsInSection(bill, sourceArea, items, targetSectionId) {
  const targetSection = findSection(bill, targetSectionId);
  const matchingArea = targetSection.areas.find((area) => sameText(area.name, sourceArea.name));
  if (matchingArea) {
    return {
      apply: (current) => appendItems(current, targetSectionId, matchingArea.id, items),
      targetSection,
      area: matchingArea,
      merged: true
    };
  }
  const newArea = createArea(sourceArea.name, items);
  return {
    apply: (current) => appendArea(current, targetSectionId, newArea),
    targetSection,
    area: newArea,
    merged: false
  };
}

export function copyAreaToSection(bill, sourceSectionId, sourceAreaId, targetSectionId) {
  const sourceArea = findSection(bill, sourceSectionId)?.areas.find((area) => area.id === sourceAreaId);
  if (!sourceArea || !findSection(bill, targetSectionId) || targetSectionId === sourceSectionId) return null;

  const placement = placeItemsInSection(bill, sourceArea, cloneItems(sourceArea.items), targetSectionId);
  const { targetSection, area } = placement;
  return {
    apply: placement.apply,
    result: {
      sectionId: targetSectionId,
      areaIds: [area.id],
      message: placement.merged
        ? `Copied ${sourceArea.name} entries into ${targetSection.name} · ${area.name}.`
        : `Copied area ${sourceArea.name} into ${targetSection.name}.`
    }
  };
}

export function copyItemToSection(bill, sourceSectionId, sourceAreaId, itemId, targetSectionId) {
  const sourceArea = findSection(bill, sourceSectionId)?.areas.find((area) => area.id === sourceAreaId);
  const sourceItem = sourceArea?.items.find((entry) => entry.id === itemId);
  if (!sourceItem || !findSection(bill, targetSectionId) || targetSectionId === sourceSectionId) return null;

  const placement = placeItemsInSection(bill, sourceArea, cloneItems([sourceItem]), targetSectionId);
  const { targetSection, area } = placement;
  return {
    apply: placement.apply,
    result: {
      sectionId: targetSectionId,
      areaIds: [area.id],
      message: placement.merged
        ? `Copied ${sourceItem.name} into ${targetSection.name} · ${area.name}.`
        : `Copied ${sourceItem.name} into a new ${area.name} area in ${targetSection.name}.`
    }
  };
}

const withoutIds = (items) => items.map(({ id, ...item }) => item);

/** Builds reusable template content from a section or area (ids are stripped). */
export function createTemplateContent(bill, type, sectionId, areaId) {
  const section = findSection(bill, sectionId);
  if (!section) return null;
  if (type === 'section') {
    return {
      name: section.name,
      areas: section.areas.map((area) => ({ name: area.name, items: withoutIds(area.items) }))
    };
  }
  const area = section.areas.find((entry) => entry.id === areaId);
  return area ? { name: area.name, items: withoutIds(area.items) } : null;
}

/** Instantiates a saved template into the bill with fresh ids. */
export function applyTemplate(bill, template, targetSectionId) {
  const content = template?.content;
  if (!content) return null;

  if (template.type === 'section' && Array.isArray(content.areas)) {
    const section = createSection(
      content.name || template.name,
      content.areas.map((area) => createArea(area.name || 'Area', cloneItems(Array.isArray(area.items) ? area.items : [])))
    );
    return {
      apply: (current) => appendSection(current, section),
      result: {
        sectionId: section.id,
        areaIds: section.areas.map((area) => area.id),
        message: `Added section template “${template.name}”.`
      }
    };
  }

  if (template.type === 'area' && Array.isArray(content.items)) {
    const target = findSection(bill, targetSectionId);
    if (!target) return null;
    const area = createArea(content.name || template.name, cloneItems(content.items));
    return {
      apply: (current) => appendArea(current, target.id, area),
      result: {
        sectionId: target.id,
        areaIds: [area.id],
        message: `Added area template “${template.name}” to ${target.name}.`
      }
    };
  }
  return null;
}

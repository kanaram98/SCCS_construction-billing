import { useState } from 'react';

export const sectionAnchorId = (sectionId) => `section-${sectionId}`;

/**
 * Which sections and areas are expanded. Unvisited ones default to open
 * only when they are first in their list.
 */
export function useEntryDisclosure(sections) {
  const [openSections, setOpenSections] = useState({});
  const [openAreas, setOpenAreas] = useState({});

  const isSectionOpen = (sectionId, index) => openSections[sectionId] ?? index === 0;
  const isAreaOpen = (areaId, index) => openAreas[areaId] ?? index === 0;
  const anySectionOpen = sections.some((section, index) => isSectionOpen(section.id, index));

  /** Expands a section (and any listed areas) and scrolls it into view. */
  function reveal(sectionId, areaIds = []) {
    setOpenSections((current) => ({ ...current, [sectionId]: true }));
    if (areaIds.length) {
      setOpenAreas((current) => ({ ...current, ...Object.fromEntries(areaIds.map((id) => [id, true])) }));
    }
    window.setTimeout(() => {
      document.getElementById(sectionAnchorId(sectionId))?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }, 150);
  }

  function toggleAllSections() {
    const expand = !anySectionOpen;
    setOpenSections(Object.fromEntries(sections.map((section) => [section.id, expand])));
    if (!expand) setOpenAreas({});
  }

  return {
    anySectionOpen,
    isSectionOpen,
    isAreaOpen,
    reveal,
    toggleAllSections,
    setSectionOpen: (sectionId, open) => setOpenSections((current) => ({ ...current, [sectionId]: open })),
    setAreaOpen: (areaId, open) => setOpenAreas((current) => ({ ...current, [areaId]: open }))
  };
}

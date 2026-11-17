import { useState } from 'react';

export const sectionAnchorId = (sectionId) => `section-${sectionId}`;

/**
 * Which floor (section) is shown and which rooms (areas) are expanded.
 * One floor is shown at a time; its first room starts open.
 */
export function useEntryDisclosure(sections) {
  const [selectedSectionId, setSelectedSectionId] = useState('');
  const [openAreas, setOpenAreas] = useState({});

  const activeSection = sections.find((section) => section.id === selectedSectionId) || sections[0] || null;
  const isAreaOpen = (areaId, index) => openAreas[areaId] ?? index === 0;

  /** Shows a floor and expands the listed rooms. */
  function reveal(sectionId, areaIds = []) {
    setSelectedSectionId(sectionId);
    if (areaIds.length) {
      setOpenAreas((current) => ({ ...current, ...Object.fromEntries(areaIds.map((id) => [id, true])) }));
      window.setTimeout(() => {
        document.getElementById(`area-${areaIds[areaIds.length - 1]}`)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      }, 150);
    }
  }

  return {
    activeSection,
    selectSection: setSelectedSectionId,
    isAreaOpen,
    reveal,
    setAreaOpen: (areaId, open) => setOpenAreas((current) => ({ ...current, [areaId]: open }))
  };
}

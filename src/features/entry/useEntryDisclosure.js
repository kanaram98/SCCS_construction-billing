import { useState } from 'react';
import { COMPACT_LAYOUT_QUERY } from '../../config/app.js';

export const NAVIGATION_MODES = Object.freeze({ select: 'select', list: 'list' });

/**
 * Which sections/areas are expanded and which section is selected.
 * Unvisited sections and areas default to open only when they are first in their list.
 */
export function useEntryDisclosure(sections) {
  const [openSections, setOpenSections] = useState({});
  const [openAreas, setOpenAreas] = useState({});
  const [selectedSectionId, setSelectedSectionId] = useState('');
  const [navigationMode, setNavigationMode] = useState(() =>
    window.matchMedia(COMPACT_LAYOUT_QUERY).matches ? NAVIGATION_MODES.select : NAVIGATION_MODES.list);

  const activeSection = sections.find((section) => section.id === selectedSectionId) || sections[0];
  const visibleSections = navigationMode === NAVIGATION_MODES.select && activeSection ? [activeSection] : sections;
  const isSectionOpen = (sectionId, index) => openSections[sectionId] ?? index === 0;
  const isAreaOpen = (areaId, index) => openAreas[areaId] ?? index === 0;
  const anySectionOpen = sections.some((section, index) => isSectionOpen(section.id, index));

  /** Selects and expands a section, plus any listed areas within it. */
  function reveal(sectionId, areaIds = []) {
    setSelectedSectionId(sectionId);
    setOpenSections((current) => ({ ...current, [sectionId]: true }));
    if (areaIds.length) {
      setOpenAreas((current) => ({ ...current, ...Object.fromEntries(areaIds.map((id) => [id, true])) }));
    }
  }

  function toggleAllSections() {
    const expand = !anySectionOpen;
    setOpenSections(Object.fromEntries(sections.map((section) => [section.id, expand])));
    if (!expand) setOpenAreas({});
  }

  function changeNavigationMode(mode) {
    setNavigationMode(mode);
    if (mode === NAVIGATION_MODES.select && activeSection) reveal(activeSection.id);
  }

  return {
    activeSection,
    visibleSections,
    navigationMode,
    anySectionOpen,
    isSectionOpen,
    isAreaOpen,
    reveal,
    toggleAllSections,
    changeNavigationMode,
    setSectionOpen: (sectionId, open) => setOpenSections((current) => ({ ...current, [sectionId]: open })),
    setAreaOpen: (areaId, open) => setOpenAreas((current) => ({ ...current, [areaId]: open }))
  };
}

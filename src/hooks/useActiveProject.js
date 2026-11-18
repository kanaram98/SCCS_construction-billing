import { useState } from 'react';

const KEY = 'active_project';
const OLD_KEY = 'attendance_site'; // the site chosen before this was shared between Labour and Expenses

function read(key) {
  try { return window.localStorage.getItem(key) || ''; } catch { return ''; }
}

/**
 * The one project Labour and Expenses are showing and changing right now. It is never empty while
 * projects exist: the last one used on this phone, else a running project, else the first.
 * `preferred` (e.g. from a search result) wins when it is a real project.
 * @returns {[string, (id: string) => void]}
 */
export function useActiveProject(projects, preferred = '') {
  const [stored, setStored] = useState(() => (projects.some((project) => project.id === preferred) ? preferred : read(KEY) || read(OLD_KEY)));
  const running = projects.filter((project) => project.status === 'running');
  const projectId = projects.some((project) => project.id === stored)
    ? stored
    : (running[0] || projects[0])?.id || '';
  function setProject(next) {
    setStored(next);
    try { window.localStorage.setItem(KEY, next); } catch { /* remembering is optional */ }
  }
  return [projectId, setProject];
}

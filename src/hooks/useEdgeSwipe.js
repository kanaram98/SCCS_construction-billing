import { useEffect } from 'react';

/** Distance from the left edge where an opening swipe may start (px). Browsers on iPhone keep the first ~20px for their own back swipe. */
export const SWIPE_START_ZONE = 110;
const SWIPE_MIN = 55;

/**
 * Decides whether a finger movement is a deliberate swipe to the right that began in the left strip.
 * Pure so it can be tested: `start`/`end` are { x, y } touch points.
 */
export function isOpenSwipe(start, end) {
  const dx = end.x - start.x;
  const dy = Math.abs(end.y - start.y);
  return start.x <= SWIPE_START_ZONE && dx >= SWIPE_MIN && dx > dy * 2;
}

/**
 * Opens the menu with a swipe right from the left side of the screen. Phone browsers (Safari, Chrome on iPhone)
 * do not deliver touches from the very edge to the page, so this also works from a little way in.
 */
export function useEdgeSwipe(onOpen, enabled = true) {
  useEffect(() => {
    if (!enabled) return undefined;
    let start = null;
    const down = (event) => {
      const touch = event.touches[0];
      start = event.touches.length === 1 && touch.clientX <= SWIPE_START_ZONE ? { x: touch.clientX, y: touch.clientY } : null;
    };
    const move = (event) => {
      if (!start) return;
      const touch = event.touches[0];
      if (isOpenSwipe(start, { x: touch.clientX, y: touch.clientY })) { start = null; onOpen(); }
      else if (Math.abs(touch.clientY - start.y) > 40) start = null; // it is a scroll, not a swipe
    };
    const stop = () => { start = null; };
    document.addEventListener('touchstart', down, { passive: true });
    document.addEventListener('touchmove', move, { passive: true });
    document.addEventListener('touchend', stop, { passive: true });
    document.addEventListener('touchcancel', stop, { passive: true });
    return () => {
      document.removeEventListener('touchstart', down);
      document.removeEventListener('touchmove', move);
      document.removeEventListener('touchend', stop);
      document.removeEventListener('touchcancel', stop);
    };
  }, [onOpen, enabled]);
}

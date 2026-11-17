import { useLayoutEffect, useRef, useState } from 'react';
import Box from '@mui/material/Box';

/**
 * Shrinks a fixed-width child (a paper page) to fit the available width,
 * so the whole page is visible on a phone. Uses CSS `zoom`, which keeps
 * layout height and pointer coordinates consistent for signature dragging.
 */
export default function FitToWidth({ contentWidth, children }) {
  const containerRef = useRef(null);
  const [scale, setScale] = useState(1);

  useLayoutEffect(() => {
    const element = containerRef.current;
    if (!element) return undefined;
    const update = () => setScale(Math.min(1, element.clientWidth / contentWidth));
    update();
    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => observer.disconnect();
  }, [contentWidth]);

  return (
    <Box ref={containerRef} className="no-print" sx={{ width: '100%', overflow: 'hidden' }}>
      <Box sx={{ width: contentWidth, zoom: scale }}>{children}</Box>
    </Box>
  );
}

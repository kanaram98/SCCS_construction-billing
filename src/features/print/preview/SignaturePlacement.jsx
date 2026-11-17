import { useEffect, useRef, useState } from 'react';
import { SIGNATURE_AREA, normalizeSignatureLayout } from '../../../domain/signature-layout.js';

/** Signature position (mm) used for inline styles. */
export function signatureStyle(layout) {
  return {
    left: `${layout.x}mm`,
    top: `${layout.y}mm`,
    width: `${layout.width}mm`,
    height: `${layout.height}mm`
  };
}

/**
 * Draggable, resizable signature stamp inside the footer signature area.
 * Supports pointer drag, a corner resize handle, and arrow keys (Shift resizes).
 */
export default function SignaturePlacement({ image, layout, onChange }) {
  const areaRef = useRef(null);
  const interactionRef = useRef(null);
  const [current, setCurrent] = useState(() => normalizeSignatureLayout(layout));

  useEffect(() => {
    if (!interactionRef.current) setCurrent(normalizeSignatureLayout(layout));
  }, [layout]);

  function startPointer(event, mode) {
    event.preventDefault();
    event.stopPropagation();
    const bounds = areaRef.current?.getBoundingClientRect();
    if (!bounds) return;
    event.currentTarget.setPointerCapture(event.pointerId);
    interactionRef.current = {
      pointerId: event.pointerId,
      mode,
      startX: event.clientX,
      startY: event.clientY,
      bounds,
      layout: current
    };
  }

  function getUpdatedLayout(event, interaction) {
    const deltaX = (event.clientX - interaction.startX) / interaction.bounds.width * SIGNATURE_AREA.width;
    const deltaY = (event.clientY - interaction.startY) / interaction.bounds.height * SIGNATURE_AREA.height;
    const next = interaction.mode === 'move'
      ? { ...interaction.layout, x: interaction.layout.x + deltaX, y: interaction.layout.y + deltaY }
      : { ...interaction.layout, width: interaction.layout.width + deltaX, height: interaction.layout.height + deltaY };
    return normalizeSignatureLayout(next);
  }

  function movePointer(event) {
    const interaction = interactionRef.current;
    if (!interaction || interaction.pointerId !== event.pointerId) return;
    setCurrent(getUpdatedLayout(event, interaction));
  }

  function finishPointer(event) {
    const interaction = interactionRef.current;
    if (!interaction || interaction.pointerId !== event.pointerId) return;
    const next = getUpdatedLayout(event, interaction);
    interactionRef.current = null;
    setCurrent(next);
    onChange(next);
  }

  function handleKeyDown(event) {
    const directions = {
      ArrowLeft: [-1, 0],
      ArrowRight: [1, 0],
      ArrowUp: [0, -1],
      ArrowDown: [0, 1]
    };
    const direction = directions[event.key];
    if (!direction) return;
    event.preventDefault();
    const amount = event.shiftKey ? 2 : 1;
    const deltaX = direction[0] * amount;
    const deltaY = direction[1] * amount;
    const next = event.shiftKey
      ? { ...current, width: current.width + deltaX, height: current.height + deltaY }
      : { ...current, x: current.x + deltaX, y: current.y + deltaY };
    const normalized = normalizeSignatureLayout(next);
    setCurrent(normalized);
    onChange(normalized);
  }

  return (
    <div
      ref={areaRef}
      className="paper-signature-area"
      onPointerMove={movePointer}
      onPointerUp={finishPointer}
      onPointerCancel={finishPointer}
    >
      <div
        className="signature-placement-stamp"
        role="group"
        tabIndex={0}
        aria-label="Signature image. Drag to move, use the corner handle to resize, or use arrow keys."
        onPointerDown={(event) => startPointer(event, 'move')}
        onKeyDown={handleKeyDown}
        style={signatureStyle(current)}
      >
        <img src={image} alt="" draggable="false" />
        <button
          className="signature-resize-handle"
          type="button"
          aria-label="Resize signature"
          onPointerDown={(event) => startPointer(event, 'resize')}
        >
          <span aria-hidden="true">↘</span>
        </button>
      </div>
      <span className="paper-signature-caption">Signature</span>
    </div>
  );
}

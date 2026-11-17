/** Footer box (in mm) that the signature image is positioned within. */
export const SIGNATURE_AREA = Object.freeze({ width: 74, height: 25 });

export const DEFAULT_SIGNATURE_LAYOUT = Object.freeze({
  x: 30,
  y: 0,
  width: 35,
  height: 14
});

const MIN_WIDTH = 8;
const MIN_HEIGHT = 5;

function bounded(value, fallback, min, max) {
  const parsed = Number(value);
  const candidate = value == null || value === '' || !Number.isFinite(parsed) ? fallback : parsed;
  return Math.min(max, Math.max(min, candidate));
}

/** Clamps a signature layout so the image always stays inside the footer area. */
export function normalizeSignatureLayout(layout = {}) {
  if (!layout || typeof layout !== 'object') layout = {};
  const width = bounded(layout.width, DEFAULT_SIGNATURE_LAYOUT.width, MIN_WIDTH, SIGNATURE_AREA.width);
  const height = bounded(layout.height, DEFAULT_SIGNATURE_LAYOUT.height, MIN_HEIGHT, SIGNATURE_AREA.height);
  return {
    x: bounded(layout.x, DEFAULT_SIGNATURE_LAYOUT.x, 0, SIGNATURE_AREA.width - width),
    y: bounded(layout.y, DEFAULT_SIGNATURE_LAYOUT.y, 0, SIGNATURE_AREA.height - height),
    width,
    height
  };
}

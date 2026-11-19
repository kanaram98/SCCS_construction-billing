/**
 * The ॐ sign at the top of a bill, as a small image for the jsPDF documents (jsPDF's own fonts cannot draw
 * Devanagari). The browser draws it with a Devanagari font of the device, once; the picture is kept.
 * Returns '' where there is no canvas (tests), and the header then simply has no sign.
 */
export const OM_SIGN = 'ॐ';
export const OM_COLOR = '#ec6b35';

let cached = null;

export function omImage() {
  if (cached !== null) return cached;
  cached = '';
  try {
    if (typeof document === 'undefined') return cached;
    const canvas = document.createElement('canvas');
    canvas.width = 160;
    canvas.height = 160;
    const context = canvas.getContext('2d');
    if (!context) return cached;
    context.fillStyle = OM_COLOR;
    context.textAlign = 'center';
    context.textBaseline = 'middle';
    context.font = '120px "Noto Sans Devanagari", "Nirmala UI", "Mangal", "Kohinoor Devanagari", sans-serif';
    context.fillText(OM_SIGN, 80, 86);
    cached = canvas.toDataURL('image/png');
  } catch {
    cached = '';
  }
  return cached;
}

/**
 * Letterhead drawn with jsPDF, matching the on-screen Letterhead component:
 * logo + firm details, brand stripe, title with number/date, "Bill to" block.
 */
const STRIPE_STOPS = [[247, 165, 71], [236, 107, 53], [159, 193, 64], [90, 143, 60]];
const ACCENT = [236, 107, 53];

function mix(stops, position) {
  const scaled = position * (stops.length - 1);
  const index = Math.min(stops.length - 2, Math.floor(scaled));
  const local = scaled - index;
  return stops[index].map((value, channel) => Math.round(value + (stops[index + 1][channel] - value) * local));
}

function imageSize(doc, image, maxWidth, maxHeight) {
  const properties = doc.getImageProperties(image);
  const scale = Math.min(maxWidth / properties.width, maxHeight / properties.height);
  return { width: properties.width * scale, height: properties.height * scale };
}

/**
 * @param {{ firm, title: string, meta: string[], billTo?: { label: string, lines: string[] }, margin: number, fontSize: number }} options
 * @returns {number} y position below the letterhead
 */
export function drawLetterhead(doc, { firm, title, meta, billTo, margin, fontSize }) {
  const pageWidth = doc.internal.pageSize.getWidth();
  const right = pageWidth - margin;
  let top = margin;

  // Logo (left) and firm details (right)
  let logoHeight = 0;
  if (firm.logo) {
    const size = imageSize(doc, firm.logo, (pageWidth - margin * 2) * 0.48, 20);
    doc.addImage(firm.logo, firm.logo.startsWith('data:image/png') ? 'PNG' : 'JPEG', margin, top, size.width, size.height, 'firm-logo', 'FAST');
    logoHeight = size.height;
  } else {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(fontSize + 8);
    doc.setTextColor(58);
    doc.text(firm.name || 'Firm name', margin, top + 7);
    logoHeight = 9;
    if (firm.tagline) {
      doc.setFont('helvetica', 'italic');
      doc.setFontSize(fontSize);
      doc.setTextColor(85);
      doc.text(doc.splitTextToSize(firm.tagline, (pageWidth - margin * 2) * 0.5), margin, top + 12.5);
      logoHeight = 14;
    }
  }
  const details = [
    firm.logo && firm.name ? { text: firm.name, bold: true, size: fontSize + 3 } : null,
    firm.logo && firm.tagline ? { text: firm.tagline, italic: true } : null,
    firm.address ? { text: firm.address } : null,
    [firm.phone && `Ph: ${firm.phone}`, firm.gstRegistered && firm.gstin && `GSTIN: ${firm.gstin}`].filter(Boolean).join('   ') ? { text: [firm.phone && `Ph: ${firm.phone}`, firm.gstRegistered && firm.gstin && `GSTIN: ${firm.gstin}`].filter(Boolean).join('   ') } : null
  ].filter(Boolean);
  let detailY = top + 4;
  details.forEach((line) => {
    doc.setFont('helvetica', line.bold ? 'bold' : line.italic ? 'italic' : 'normal');
    doc.setFontSize(line.size || fontSize - 1);
    doc.setTextColor(line.bold ? 43 : 68);
    const wrapped = doc.splitTextToSize(line.text, (pageWidth - margin * 2) * 0.48);
    doc.text(wrapped, right, detailY, { align: 'right' });
    detailY += wrapped.length * (line.bold ? 5.2 : 4);
  });
  let y = Math.max(top + logoHeight, detailY - 2) + 3;

  // Brand stripe (gradient as thin bands)
  const stripeWidth = pageWidth - margin * 2;
  const bands = 60;
  for (let index = 0; index < bands; index += 1) {
    doc.setFillColor(...mix(STRIPE_STOPS, index / (bands - 1)));
    doc.rect(margin + (stripeWidth / bands) * index, y, stripeWidth / bands + 0.2, 1.4, 'F');
  }
  y += 1.4 + 4.5; // stripe height + gap, so the title row never touches the stripe

  // Title (left) and number/date (right): first baselines sit below the stripe
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(fontSize + 5);
  doc.setTextColor(43);
  const metaLines = meta.filter(Boolean);
  const titleBaseline = y + 4;
  doc.text(String(title).toUpperCase(), margin, titleBaseline);
  doc.setFontSize(fontSize);
  metaLines.forEach((line, index) => {
    doc.setFont('helvetica', index === 0 ? 'bold' : 'normal');
    doc.text(line, right, y + 3 + index * 4.2, { align: 'right' });
  });
  y = Math.max(titleBaseline, y + 3 + (metaLines.length - 1) * 4.2) + 3;

  // Bill to
  const lines = (billTo?.lines || []).filter(Boolean);
  if (lines.length) {
    const height = 6 + lines.length * 4.2;
    doc.setFillColor(251, 246, 242);
    doc.rect(margin, y, stripeWidth, height, 'F');
    doc.setFillColor(...ACCENT);
    doc.rect(margin, y, 0.9, height, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(fontSize - 1);
    doc.setTextColor(...ACCENT);
    doc.text(String(billTo.label).toUpperCase(), margin + 3, y + 4);
    doc.setTextColor(34);
    lines.forEach((line, index) => {
      doc.setFont('helvetica', index === 0 ? 'bold' : 'normal');
      doc.setFontSize(fontSize);
      doc.text(String(line), margin + 3, y + 8.2 + index * 4.2, { maxWidth: stripeWidth - 6 });
    });
    y += height + 3;
  }
  doc.setTextColor(0);
  return y + 2;
}

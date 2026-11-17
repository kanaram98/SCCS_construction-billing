/**
 * PDF from rendered HTML, used for Hindi bills: jsPDF's text engine cannot
 * shape Devanagari (joined letters and vowel signs), but the browser can.
 * Each document is drawn to an image and split into pages between table rows.
 * Loaded on demand (html2canvas + jsPDF are large).
 */
import { jsPDF } from 'jspdf';
import html2canvas from 'html2canvas';
import { deliverPdf } from './pdf-file.js';

const PX_PER_MM = 96 / 25.4;
const RENDER_SCALE = 2;
const PAGE_NUMBER_SPACE_MM = 6;

/** Offsets (CSS px from the top) where a page may end, and where one must start. */
function measureBreaks(element) {
  const top = element.getBoundingClientRect().top;
  const bottomOf = (node) => node.getBoundingClientRect().bottom - top;
  const allowed = [...element.querySelectorAll('tr, .paper-header, .paper-payment, .paper-footer, .signature-row')].map(bottomOf);
  const forced = [...element.querySelectorAll('.entry-break-before')].map((node) => node.getBoundingClientRect().top - top);
  return { allowed: allowed.sort((a, b) => a - b), forced: forced.sort((a, b) => a - b) };
}

/** Splits [0, height] into page slices no taller than `pageHeight`, cutting between rows. */
export function planSlices(height, pageHeight, { allowed, forced }) {
  const slices = [];
  let start = 0;
  while (start < height - 1) {
    const limit = start + pageHeight;
    const forcedBreak = forced.find((offset) => offset > start + 1 && offset < limit);
    let end;
    if (forcedBreak) end = forcedBreak;
    else if (limit >= height) end = height;
    else {
      const candidates = allowed.filter((offset) => offset > start + 20 && offset <= limit);
      end = candidates.length ? candidates[candidates.length - 1] : limit;
    }
    slices.push([start, end]);
    start = end;
  }
  return slices;
}

/**
 * @param {Element[]} documents rendered `.print-document` elements (may be hidden)
 * @returns {Promise<jsPDF>}
 */
export async function createImagePdf(documents, settings) {
  const doc = new jsPDF({ unit: 'mm', format: settings.paper, orientation: settings.orientation });
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  const { margin } = settings;
  const contentWidth = pageWidth - margin * 2;
  const contentHeight = pageHeight - margin * 2 - (settings.pageNumbers ? PAGE_NUMBER_SPACE_MM : 0);
  const widthPx = Math.round(contentWidth * PX_PER_MM);
  const mmPerPx = contentWidth / widthPx;

  const host = document.createElement('div');
  Object.assign(host.style, { position: 'fixed', left: '-10000px', top: '0', width: `${widthPx}px`, background: '#fff' });
  document.body.appendChild(host);
  let firstPage = true;
  try {
    for (const source of documents) {
      const element = source.cloneNode(true);
      Object.assign(element.style, { display: 'block', width: `${widthPx}px`, maxWidth: 'none', padding: '0', margin: '0', border: '0', borderRadius: '0', boxShadow: 'none' });
      host.appendChild(element);
      const canvas = await html2canvas(element, { scale: RENDER_SCALE, backgroundColor: '#ffffff', logging: false });
      const slices = planSlices(element.offsetHeight, contentHeight / mmPerPx, measureBreaks(element));
      for (const [start, end] of slices) {
        if (!firstPage) doc.addPage();
        firstPage = false;
        const slice = document.createElement('canvas');
        slice.width = canvas.width;
        slice.height = Math.max(1, Math.ceil((end - start) * RENDER_SCALE));
        const context = slice.getContext('2d');
        context.fillStyle = '#ffffff';
        context.fillRect(0, 0, slice.width, slice.height);
        context.drawImage(canvas, 0, start * RENDER_SCALE, canvas.width, slice.height, 0, 0, slice.width, slice.height);
        doc.addImage(slice.toDataURL('image/jpeg', 0.9), 'JPEG', margin, margin, contentWidth, (end - start) * mmPerPx);
      }
      host.removeChild(element);
    }
  } finally {
    host.remove();
  }

  if (settings.pageNumbers) {
    const count = doc.internal.getNumberOfPages();
    for (let page = 1; page <= count; page += 1) {
      doc.setPage(page);
      doc.setFontSize(8);
      doc.text(`${page} / ${count}`, pageWidth - margin, pageHeight - margin / 2, { align: 'right' });
    }
  }
  return doc;
}

/** Builds the image PDF from the rendered documents and shares or downloads it. */
export async function exportImagePdf(bill, documents, settings, { shareText } = {}) {
  await deliverPdf(await createImagePdf(documents, settings), bill, { shareText });
}

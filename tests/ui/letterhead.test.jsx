import { describe, expect, it } from 'vitest';
import { render, screen } from '@testing-library/react';
import Letterhead from '../../src/features/print/preview/Letterhead.jsx';
import PaperHeader from '../../src/features/print/preview/PaperHeader.jsx';
import { drawLetterhead } from '../../src/documents/letterhead-pdf.js';
import { tr } from '../../src/i18n/translate.js';

const firm = { name: 'Acme Interiors', tagline: '', address: '', phone: '' };

describe('ॐ at the top of a bill', () => {
  it('shows in the bill header, and not in other letterheads', () => {
    const bill = { number: '1', date: '2026-11-01', client: 'Sharma', sections: [] };
    const { container, rerender } = render(<PaperHeader bill={bill} firm={firm} documentType="bill" t={tr} />);
    expect(container.querySelector('img.lh-om')?.getAttribute('src')).toMatch(/^data:image\/png;base64,/);
    rerender(<Letterhead firm={firm} t={tr} title="Quotation" meta={[]} />);
    expect(container.querySelector('.lh-om')).toBeNull();
    expect(screen.getByText('Acme Interiors')).toBeTruthy();
  });

  it('is drawn in the centre of the page by the jsPDF letterhead, and pushes the firm details down', async () => {
    const calls = [];
    const fake = {
      internal: { pageSize: { getWidth: () => 210, getHeight: () => 297 } },
      addImage: (...args) => calls.push(args), setFont() {}, setFontSize() {}, setTextColor() {}, setFillColor() {}, rect() {},
      text() {}, splitTextToSize: (text) => [text], getImageProperties: () => ({ width: 10, height: 10 })
    };
    const withOm = drawLetterhead(fake, { firm, title: 'Bill', meta: ['Bill 1'], margin: 10, fontSize: 9, om: true });
    const sign = calls.find((call) => call[6] === 'om-sign');
    expect(sign).toBeTruthy();
    const [, format, x, , width] = sign;
    expect(format).toBe('PNG');
    expect(x + width / 2).toBeCloseTo(105, 1); // the middle of a 210 mm page
    calls.length = 0;
    const without = drawLetterhead(fake, { firm, title: 'Bill', meta: ['Bill 1'], margin: 10, fontSize: 9 });
    expect(calls.find((call) => call[6] === 'om-sign')).toBeUndefined();
    expect(withOm - without).toBeCloseTo(8.5, 1); // the sign takes its own line
  });
});

import { describe, expect, it, vi } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { SAMPLE_STATE, renderApp } from './render-app.jsx';

let captured = null;
vi.mock('../../src/documents/pdf-file.js', () => ({ deliverPdf: vi.fn(async (doc) => { captured = doc; }) }));

const goTo = async (user, name) => {
  await user.click(screen.getByRole('button', { name: 'Menu' }));
  await user.click(within(await screen.findByRole('navigation', { name: 'Main navigation' })).getByRole('button', { name }));
};

/** The sample bill, made a new-style bill (adds up room by room) with two entries of the same work item in the Hall. */
const roomBill = (extra = {}) => ({
  ...SAMPLE_STATE,
  bills: SAMPLE_STATE.bills.map((bill, index) => (index === 0 ? {
    ...bill,
    billStyle: 'room',
    sections: bill.sections.map((section, sectionIndex) => (sectionIndex === 0 ? {
      ...section,
      areas: section.areas.map((area, areaIndex) => (areaIndex === 0 ? {
        ...area,
        items: [...area.items, { id: 'i9', rateId: 'floor-tiles', name: 'Floor tiles', unit: 'sqft', type: 'area', rate: 85, count: 1, length: '10.0', width: '10.0', note: 'second' }]
      } : area))
    } : section))
  } : bill)),
  ...extra
});

describe('Layout of the printed bill', () => {
  it('an older bill offers every entry, by room and by floor, and opens as it always printed', async () => {
    const { user } = renderApp(SAMPLE_STATE);
    await goTo(user, 'PDF / Print');
    const group = await screen.findByRole('group', { name: 'Layout' });
    expect(within(group).getAllByRole('button').map((button) => button.textContent)).toEqual(['Every entry', 'By room', 'By floor']);
    expect(within(group).getByRole('button', { name: 'Every entry' }).getAttribute('aria-pressed')).toBe('true');
  });

  it('a new bill opens by room, and one tap switches the preview to by floor without changing the total', async () => {
    const { user } = renderApp(roomBill());
    await goTo(user, 'PDF / Print');
    const group = await screen.findByRole('group', { name: 'Layout' });
    expect(within(group).getAllByRole('button').map((button) => button.textContent)).toEqual(['By room', 'By floor']);
    const preview = document.querySelector('.print-preview');
    expect(within(preview).getByText('Hall')).toBeTruthy(); // the room heading
    const totalBefore = preview.querySelector('.grand-row')?.textContent;
    await user.click(within(group).getByRole('button', { name: 'By floor' }));
    await waitFor(() => expect(document.querySelector('.print-preview .area-band')).toBeNull()); // no rooms on a floor-layout bill
    expect(document.querySelector('.print-preview .grand-row')?.textContent).toBe(totalBefore);
    await user.click(within(group).getByRole('button', { name: 'By room' }));
    await waitFor(() => expect(document.querySelector('.print-preview .area-band')).toBeTruthy());
  });

  it('the PDF is made in both layouts, with the measurement sheet', async () => {
    const { exportBillPdf } = await import('../../src/documents/pdf-export.js');
    const state = roomBill();
    const bill = state.bills[0];
    const settings = { documents: { bill: true, measurement: true, summary: true, items: false } };
    for (const layout of ['room', 'floor']) {
      captured = null;
      await exportBillPdf(bill, state.rates, { name: 'Acme' }, { ...settings, layouts: { bill: layout, measurement: layout } });
      expect(captured.getNumberOfPages()).toBeGreaterThan(0);
    }
  });
});

describe('Entering the room of a new bill', () => {
  it('lists entries of the same work item together under the line the bill shows, and keeps the floor lines folded away', async () => {
    const { user } = renderApp(roomBill());
    await goTo(user, 'Entry');
    await user.click((await screen.findAllByRole('button', { name: 'Add or edit entries' }))[0]);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText(/on the bill/)).toBeTruthy(); // Floor tiles: two entries, one bill line
    const toggle = within(dialog).getByRole('button', { name: /what the bill shows by floor/ });
    expect(toggle.getAttribute('aria-expanded')).toBe('false');
    await user.click(toggle);
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    expect(within(dialog).getAllByText(/Floor tiles/).length).toBeGreaterThan(1); // now also as a floor line
  });

  it('an older bill keeps its plain list, with no floor panel', async () => {
    const { user } = renderApp(SAMPLE_STATE);
    await goTo(user, 'Entry');
    await user.click((await screen.findAllByRole('button', { name: 'Add or edit entries' }))[0]);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).queryByRole('button', { name: /what the bill shows by floor/ })).toBeNull();
    expect(within(dialog).queryByText(/on the bill/)).toBeNull();
  });
});

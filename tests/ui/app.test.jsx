import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { SAMPLE_STATE, renderApp, savedState } from './render-app.jsx';

const nav = (name) => within(screen.getByRole('navigation', { name: 'Main navigation' })).getByRole('button', { name });

describe('Bills screen', () => {
  it('shows totals and the bill list on a phone layout', () => {
    renderApp(SAMPLE_STATE);
    expect(screen.getByRole('heading', { name: 'Bills' })).toBeTruthy();
    expect(screen.getAllByText('₹13,895').length).toBeGreaterThan(0);
    expect(screen.getByText('Bill 1 · Lake View Villa')).toBeTruthy();
    expect(screen.getByText('Bill 2 · Office fitout')).toBeTruthy();
    // Bottom navigation (mobile) rather than the desktop drawer
    expect(nav('Rates')).toBeTruthy();
  });

  it('deletes a bill after confirmation and can undo it', async () => {
    const { user } = renderApp(SAMPLE_STATE);
    await user.click(screen.getByRole('button', { name: 'Actions for bill 2' }));
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Delete bill 2?')).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(screen.queryByText('Bill 2 · Office fitout')).toBeNull());

    await user.click(await screen.findByRole('button', { name: 'Undo' }));
    expect(await screen.findByText('Bill 2 · Office fitout')).toBeTruthy();
  });

  it('reminds the user to back up when there are entries', () => {
    renderApp(SAMPLE_STATE);
    expect(screen.getByText(/Last backup: never/)).toBeTruthy();
  });
});

describe('Entry screen', () => {
  it('adds a measured entry through the dialog and updates the total', async () => {
    const { user } = renderApp(SAMPLE_STATE);
    await user.click(screen.getByText('Bill 1 · Lake View Villa'));
    await screen.findByRole('heading', { name: 'Measurements' });

    const hallAddButtons = screen.getAllByRole('button', { name: 'Add entry' });
    await user.click(hallAddButtons[0]);
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/Length \(ft\.in\)/), '10.6');
    await user.type(within(dialog).getByLabelText(/Width \(ft\.in\)/), '5.0');
    await user.click(within(dialog).getByRole('button', { name: 'Add' }));

    // 10'6" × 5' = 52.5 sqft × ₹85 = ₹4,463 → new total ₹19,161
    await waitFor(() => expect(screen.getAllByText('₹19,161').length).toBeGreaterThan(0));
    const items = savedState().bills[0].sections[0].areas[0].items;
    expect(items).toHaveLength(3);
    expect(items[2]).toMatchObject({ rateId: 'floor-tiles', length: '10.6', width: '5.0' });
  });

  it('rejects inches above 11', async () => {
    const { user } = renderApp(SAMPLE_STATE);
    await user.click(screen.getByText('Bill 1 · Lake View Villa'));
    await user.click((await screen.findAllByRole('button', { name: 'Add entry' }))[0]);
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/Length \(ft\.in\)/), '10.13');
    expect(within(dialog).getAllByText('Inches must be from 0 to 11.').length).toBeGreaterThan(0);
    expect(within(dialog).getByRole('button', { name: 'Add' }).disabled).toBe(true);
  });

  it('filters entries with search', async () => {
    const { user } = renderApp(SAMPLE_STATE);
    await user.click(screen.getByText('Bill 1 · Lake View Villa'));
    await user.type(await screen.findByRole('searchbox', { name: 'Search entries' }), 'gas');
    expect(await screen.findByText('1 matching entry')).toBeTruthy();
    expect(screen.queryByText('Skirting')).toBeNull();
  });
});

describe('Rates screen', () => {
  it('validates and adds a work item through the form', async () => {
    const { user } = renderApp(SAMPLE_STATE);
    await user.click(nav('Rates'));
    await user.click(await screen.findByRole('button', { name: 'Add item' }));
    const dialog = await screen.findByRole('dialog');

    await user.click(within(dialog).getByRole('button', { name: 'Add item' }));
    expect(within(dialog).getByText('Enter an item name.')).toBeTruthy();

    await user.type(within(dialog).getByLabelText(/Item name/), 'Wall putty');
    await user.type(within(dialog).getByLabelText(/^Unit/), 'sqft');
    await user.type(within(dialog).getByLabelText(/Rate/), '12');
    await user.click(within(dialog).getByRole('button', { name: 'Add item' }));

    expect(await screen.findByText('Wall putty')).toBeTruthy();
    expect(savedState().rates.at(-1)).toMatchObject({ name: 'Wall putty', unit: 'sqft', rate: 12 });
  });
});

describe('Project screen', () => {
  it('records a payment and updates the balance', async () => {
    const { user } = renderApp(SAMPLE_STATE);
    await user.click(nav('Project'));
    await user.click(await screen.findByRole('button', { name: 'Record payment' }));
    const dialog = await screen.findByRole('dialog');
    const amount = within(dialog).getByLabelText(/Amount/);
    expect(amount.value).toBe('8895'); // suggested: balance due
    await user.clear(amount);
    await user.type(amount, '3000');
    await user.click(within(dialog).getByRole('button', { name: 'Record payment' }));
    expect(await screen.findByText('₹5,895')).toBeTruthy();
    expect(savedState().bills[0].payments[0]).toMatchObject({ amount: 3000, mode: 'upi' });
  });
});

describe('PDF screen', () => {
  it('opens on the preview tab with the bill and amount in words', async () => {
    const { user } = renderApp(SAMPLE_STATE);
    await user.click(nav('PDF'));
    expect((await screen.findByRole('tab', { name: 'Preview' })).getAttribute('aria-selected')).toBe('true');
    // The preview and the hidden print-only copy both contain the bill.
    const preview = document.querySelector('.print-preview');
    expect(within(preview).getByText(/Rupees Thirteen Thousand Eight Hundred Ninety-Five Only/)).toBeTruthy();
    expect(within(preview).getByText('CGST (9%)')).toBeTruthy();

    await user.click(screen.getByRole('tab', { name: 'Settings' }));
    expect(await screen.findByText('Page setup')).toBeTruthy();
  });
});

describe('Language', () => {
  it('switches the app to Hindi and remembers it', async () => {
    const { user } = renderApp(SAMPLE_STATE);
    await user.click(screen.getByRole('button', { name: 'Language' }));
    await user.click(await screen.findByRole('menuitem', { name: 'हिंदी' }));
    expect(await screen.findByRole('button', { name: 'नया बिल' })).toBeTruthy();
    expect(within(screen.getByRole('navigation', { name: 'मुख्य मेनू' })).getByRole('button', { name: 'दरें' })).toBeTruthy();
    expect(savedState().preferences.language).toBe('hi');
  });
});

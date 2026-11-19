import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { SAMPLE_STATE, renderApp, savedState } from './render-app.jsx';

/** Opens the side menu and taps a tab. */
const goTo = async (user, name) => {
  await user.click(screen.getByRole('button', { name: 'Menu' }));
  await user.click(within(await screen.findByRole('navigation', { name: 'Main navigation' })).getByRole('button', { name }));
};
/** The sample bill after it has been marked ready (it goes to the client and can take payments). */
const READY_SAMPLE = { ...SAMPLE_STATE, bills: SAMPLE_STATE.bills.map((bill, index) => (index === 0 ? { ...bill, status: 'ready' } : bill)) };
/** Opens the ⋮ menu of a bill on the Bills page and taps an item. */
const billMenu = async (user, number, item) => {
  await goTo(user, 'Bills');
  await user.click(await screen.findByRole('button', { name: `Actions for bill ${number}` }));
  await user.click(screen.getByRole('menuitem', { name: item }));
};
const openSettings = (user) => user.click(screen.getByRole('button', { name: 'App settings' }));

describe('Home', () => {
  it('opens on the business summary with KPIs and lists', async () => {
    renderApp(READY_SAMPLE); // a bill that has gone to the client counts as billed
    expect(await screen.findByRole('heading', { name: 'Namaste, Acme Interiors' })).toBeTruthy();
    expect(screen.getByText('Outstanding')).toBeTruthy();
    expect(screen.getAllByText('₹8,895').length).toBeGreaterThan(0); // 13,895 − 5,000 advance
    expect(screen.getByText('Recent')).toBeTruthy();
  });
});

describe('Bills screen', () => {
  it('lists bills only', async () => {
    const { user } = renderApp(SAMPLE_STATE);
    await goTo(user, 'Bills');
    await screen.findByRole('heading', { name: 'Bills' });
    expect(await screen.findByText('Bill 1 · Lake View Villa')).toBeTruthy();
    expect(screen.getByText('Bill 2 · Office fitout')).toBeTruthy();
    expect(screen.queryByText('Total billed')).toBeNull();
  });

  it('deletes a bill after confirmation and can undo it', async () => {
    const { user } = renderApp(SAMPLE_STATE);
    await goTo(user, 'Bills');
    await screen.findByRole('heading', { name: 'Bills' });
    await user.click(await screen.findByRole('button', { name: 'Actions for bill 2' }));
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Delete Bill 2?')).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(screen.queryByText('Bill 2 · Office fitout')).toBeNull());
    await user.click(await screen.findByRole('button', { name: 'Undo' }));
    expect(await screen.findByText('Bill 2 · Office fitout')).toBeTruthy();
  });
});

describe('Entry screen', () => {
  /** Chooses a work item in the entry form. */
  async function pickInLastRow(user, dialog, name) {
    await user.click(within(dialog).getByRole('combobox', { name: /Work item/ }));
    await user.click(await screen.findByRole('option', { name: new RegExp(name) }));
  }
  const lastField = (dialog, label) => within(dialog).getByLabelText(label);

  it('shows one floor at a time and adds a measured entry in the entry sheet', async () => {
    const { user } = renderApp(SAMPLE_STATE);
    await goTo(user, 'Entry');
    expect(await screen.findByRole('tab', { name: 'Ground floor' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'First floor' })).toBeTruthy();

    await user.click(screen.getAllByRole('button', { name: 'Add or edit entries' })[0]);
    const dialog = await screen.findByRole('dialog');
    await pickInLastRow(user, dialog, 'Floor tiles');
    await user.type(lastField(dialog, 'Length'), '10.6');
    await user.type(lastField(dialog, 'Width'), '5.0');
    // the amount of the row and the room total update while typing: 10'6" x 5' = 52.5 sqft x Rs 85 = Rs 4,463
    expect(within(dialog).getAllByText('₹4,463').length).toBeGreaterThan(0);
    await user.click(within(dialog).getByRole('button', { name: 'Add entry' }));
    await user.click(within(dialog).getByRole('button', { name: 'Done' }));

    // new total Rs 19,161, and the entry was saved
    await waitFor(() => expect(screen.getAllByText('₹19,161').length).toBeGreaterThan(0));
    expect(savedState().bills[0].sections[0].areas[0].items).toHaveLength(3);
  });

  it('Enter in the last box adds the entry and keeps the work item for the next one', async () => {
    const { user } = renderApp(SAMPLE_STATE);
    await goTo(user, 'Entry');
    await user.click((await screen.findAllByRole('button', { name: 'Add or edit entries' }))[0]);
    const dialog = await screen.findByRole('dialog');
    await pickInLastRow(user, dialog, 'Gas hole');
    // after choosing the item the cursor is in the first number box
    await waitFor(() => expect(document.activeElement.dataset.sheetInput).toBe('count')); // a count item has only Nos
    await user.keyboard('{Enter}'); // last box: the entry is added
    await waitFor(() => expect(savedState().bills[0].sections[0].areas[0].items).toHaveLength(3));
    expect(within(dialog).getByRole('combobox', { name: /Work item/ }).value).toMatch(/Gas hole/); // ready to repeat
    expect(within(dialog).getAllByRole('button', { name: /^Change entry/ })).toHaveLength(3);
  });

  it('flags a bad measurement and will not finish with an unfinished row', async () => {
    const { user } = renderApp(SAMPLE_STATE);
    await goTo(user, 'Entry');
    await user.click((await screen.findAllByRole('button', { name: 'Add or edit entries' }))[0]);
    const dialog = await screen.findByRole('dialog');
    await pickInLastRow(user, dialog, 'Floor tiles');
    await user.type(lastField(dialog, 'Length'), '10.13');
    expect(within(dialog).getAllByText(/Inches must be from 0 to 11./).length).toBeGreaterThan(0);
    await user.click(within(dialog).getByRole('button', { name: 'Done' }));
    expect(await screen.findByText(/not finished/)).toBeTruthy();
    expect(screen.getByRole('dialog')).toBeTruthy(); // still open
    expect(savedState().bills[0].sections[0].areas[0].items).toHaveLength(2);
  });

  it('editing a saved entry in the sheet updates it', async () => {
    const { user } = renderApp(SAMPLE_STATE);
    await goTo(user, 'Entry');
    await user.click((await screen.findAllByRole('button', { name: /^Floor tiles/ }))[0]);
    const dialog = await screen.findByRole('dialog');
    const length = within(dialog).getByLabelText('Length');
    await user.clear(length);
    await user.type(length, '20');
    await user.click(within(dialog).getByRole('button', { name: 'Save changes' }));
    await user.click(within(dialog).getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(savedState().bills[0].sections[0].areas[0].items.find((item) => item.type === 'area').length).toBe('20'));
  });

  it('duplicates a room in the same floor and asks for its new name', async () => {
    const { user } = renderApp(SAMPLE_STATE);
    await goTo(user, 'Entry');
    await user.click(await screen.findByRole('button', { name: 'Actions for Hall' }));
    await user.click(screen.getByRole('menuitem', { name: 'Duplicate in this section' }));
    const dialog = await screen.findByRole('dialog');
    const input = within(dialog).getByLabelText('Area name');
    expect(input.value).toBe('Hall (copy)');
    await user.clear(input);
    await user.type(input, 'Bedroom 2{Enter}');
    await waitFor(() => expect(savedState().bills[0].sections[0].areas.map((area) => area.name)).toEqual(['Hall', 'Bedroom 2', 'Kitchen']));
    const [hall, copy] = savedState().bills[0].sections[0].areas;
    expect(copy.items).toHaveLength(hall.items.length);
    expect(copy.items[0].id).not.toBe(hall.items[0].id);
  });

  it('duplicates a whole floor and asks for its new name', async () => {
    const { user } = renderApp(SAMPLE_STATE);
    await goTo(user, 'Entry');
    await user.click(await screen.findByRole('button', { name: 'Actions for Ground floor' }));
    await user.click(screen.getByRole('menuitem', { name: 'Duplicate section' }));
    const dialog = await screen.findByRole('dialog');
    const input = within(dialog).getByRole('textbox');
    expect(input.value).toBe('Ground floor (copy)');
    await user.clear(input);
    await user.type(input, 'Second floor{Enter}');
    await waitFor(() => expect(savedState().bills[0].sections.map((section) => section.name)).toEqual(['Ground floor', 'Second floor', 'First floor']));
    expect(savedState().bills[0].sections[1].areas[0].items.length).toBe(savedState().bills[0].sections[0].areas[0].items.length);
  });

  it('copies several rooms into other floors at once with tick boxes', async () => {
    const { user } = renderApp(SAMPLE_STATE);
    await goTo(user, 'Entry');
    await user.click(await screen.findByRole('button', { name: 'Actions for Ground floor' }));
    await user.click(screen.getByRole('menuitem', { name: 'Copy several areas to other sections…' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('button', { name: 'Copy' }).disabled).toBe(true); // nothing ticked yet
    await user.click(within(dialog).getAllByRole('checkbox', { name: 'Select all' })[0]);
    await user.click(within(dialog).getByRole('checkbox', { name: 'First floor' }));
    await user.click(within(dialog).getByRole('button', { name: 'Copy' }));
    await waitFor(() => expect(savedState().bills[0].sections[1].areas.length).toBeGreaterThan(0));
    const ground = savedState().bills[0].sections[0].areas;
    const first = savedState().bills[0].sections[1].areas;
    expect(first.reduce((sum, area) => sum + area.items.length, 0)).toBeGreaterThanOrEqual(ground.reduce((sum, area) => sum + area.items.length, 0));
  });

  it('renames a room from its menu', async () => {
    const { user } = renderApp(SAMPLE_STATE);
    await goTo(user, 'Entry');
    await user.click(await screen.findByRole('button', { name: 'Actions for Hall' }));
    await user.click(screen.getByRole('menuitem', { name: 'Rename' }));
    const dialog = await screen.findByRole('dialog');
    const input = within(dialog).getByLabelText('Area name');
    await user.clear(input);
    await user.type(input, 'Living room{Enter}');
    expect(await screen.findByText('Living room')).toBeTruthy();
  });

  it('filters entries with search', async () => {
    const { user } = renderApp(SAMPLE_STATE);
    await goTo(user, 'Entry');
    await user.click(await screen.findByRole('button', { name: 'Search entries' }));
    await user.type(await screen.findByRole('searchbox', { name: 'Search entries' }), 'gas');
    expect(await screen.findByText('1 matching entry')).toBeTruthy();
    expect(screen.queryByText('Skirting')).toBeNull();
  });

  it('records a payment on the Amounts & payments tab', async () => {
    const { user } = renderApp(READY_SAMPLE);
    await goTo(user, 'Entry');
    await user.click(await screen.findByRole('tab', { name: 'Amounts & payments' }));
    await user.click(await screen.findByRole('button', { name: 'Record payment' }));
    const dialog = await screen.findByRole('dialog');
    const amount = within(dialog).getByLabelText(/Amount/);
    expect(amount.value).toBe('8895');
    await user.clear(amount);
    await user.type(amount, '3000');
    await user.click(within(dialog).getByRole('button', { name: 'Record payment' }));
    expect(await screen.findByText('₹5,895')).toBeTruthy();
    expect(savedState().bills[0].payments[0]).toMatchObject({ amount: 3000 });
  });
});

describe('Settings', () => {
  it('validates and adds a work item on the Standard rates tab (Add item is under the list)', async () => {
    const { user } = renderApp(SAMPLE_STATE);
    await goTo(user, 'Quotation');
    await user.click(await screen.findByRole('tab', { name: 'Standard rates' }));
    await user.click(await screen.findByRole('button', { name: 'Add item' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('button', { name: 'Add item' }));
    expect(within(dialog).getByText('Enter an item name.')).toBeTruthy();
    await user.type(within(dialog).getByLabelText(/Item name/), 'Wall putty');
    await user.type(within(dialog).getByLabelText(/^Unit/), 'sqft');
    await user.type(within(dialog).getByLabelText(/Rate/), '12');
    await user.click(within(dialog).getByRole('button', { name: 'Add item' }));
    expect((await screen.findAllByText('Wall putty')).length).toBeGreaterThan(0);
    expect(savedState().rates.at(-1)).toMatchObject({ name: 'Wall putty', unit: 'sqft', rate: 12 });
  });

  it('shows the standard rate quotation with editable terms', async () => {
    const { user } = renderApp(SAMPLE_STATE);
    await goTo(user, 'Quotation');
    await user.click(await screen.findByRole('tab', { name: 'Standard rates' }));
    const quotation = await waitFor(() => document.querySelector('.quotation-document'));
    expect(within(quotation).getByText('Rate quotation')).toBeTruthy();
    expect(within(quotation).getByText('Floor tiles')).toBeTruthy();
    expect(within(quotation).getByText('GST extra as applicable.')).toBeTruthy();
    const terms = screen.getByLabelText('Terms & conditions (one per line)');
    await user.clear(terms);
    await user.type(terms, 'Material by client');
    expect(within(document.querySelector('.quotation-document')).getByText('Material by client')).toBeTruthy();
    expect(savedState().quotation.terms).toBe('Material by client');
  });

  it('switches the app to Hindi and remembers it', async () => {
    const { user } = renderApp(SAMPLE_STATE);
    await openSettings(user);
    await user.click(await screen.findByRole('button', { name: 'हिंदी' }));
    expect(await screen.findByRole('heading', { name: 'सेटिंग्स' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'मेनू' }));
    expect(within(await screen.findByRole('navigation', { name: 'मुख्य मेनू' })).getByRole('button', { name: 'होम' })).toBeTruthy();
    expect(savedState().preferences.language).toBe('hi');
  });
});

describe('Project and PDF', () => {
  it('Bill details shows the project and client; the firm has its own tab', async () => {
    const { user } = renderApp(SAMPLE_STATE);
    await billMenu(user, 1, 'Edit details');
    expect(await screen.findByRole('dialog', { name: 'Bill details' })).toBeTruthy();
    expect(screen.queryByText('Your firm')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await goTo(user, 'Firm');
    expect(await screen.findByText('Your firm')).toBeTruthy();
    expect(screen.queryByText('Payments')).toBeNull();
    expect(screen.queryByText('Backup & restore')).toBeNull();
  });

  it('a bill linked to a project cannot change its project or date', async () => {
    const linked = { ...SAMPLE_STATE, projects: [{ id: 'pa', name: 'Alpha site', client: 'Mr Alpha', status: 'running', version: 1 }] };
    linked.bills = linked.bills.map((entry, index) => (index === 0 ? { ...entry, projectId: 'pa', projectName: 'Alpha site', client: 'Mr Alpha' } : entry));
    const { user } = renderApp(linked);
    await billMenu(user, 1, 'Edit details');
    await screen.findByRole('dialog', { name: 'Bill details' });
    expect(screen.queryByRole('combobox', { name: /Project/ })).toBeNull(); // shown as text, not a dropdown
    expect(screen.getAllByText('Alpha site').length).toBeGreaterThan(0);
    expect(screen.getByLabelText('Date').disabled).toBe(true);
  });

  it('PDF opens on the preview with the amount in words', async () => {
    const { user } = renderApp(SAMPLE_STATE);
    await goTo(user, 'PDF / Print');
    expect((await screen.findByRole('tab', { name: 'Preview' })).getAttribute('aria-selected')).toBe('true');
    const preview = document.querySelector('.print-preview');
    expect(within(preview).getByText(/Rupees Thirteen Thousand Eight Hundred Ninety-Five Only/)).toBeTruthy();
    expect(preview.querySelector('.draft-stamp')).toBeTruthy(); // a draft prints with a DRAFT stamp
  });

  it('a ready bill prints without the DRAFT stamp', async () => {
    const { user } = renderApp(READY_SAMPLE);
    await goTo(user, 'PDF / Print');
    await screen.findByRole('tab', { name: 'Preview' });
    expect(document.querySelector('.print-preview .draft-stamp')).toBeNull();
  });
});

describe('First use', () => {
  it('welcomes a new user and can open a sample bill', async () => {
    const { user } = renderApp();
    const welcome = await screen.findByRole('dialog', { name: 'Welcome to Construction Billing' });
    await user.click(within(welcome).getByRole('button', { name: 'See a sample bill' }));
    expect(await screen.findByText(/This is a sample bill to explore/)).toBeTruthy();
    expect(screen.getAllByText('₹12,545').length).toBeGreaterThan(0);
    expect(savedState().meta.onboarded).toBe(true);
  });

  it('lets the welcome popup be closed without starting a bill', async () => {
    const { user } = renderApp();
    const welcome = await screen.findByRole('dialog');
    await user.click(within(welcome).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(savedState().meta.onboarded).toBe(true);
  });

  it('asks for the project before the first bill is made, and replaces the empty starter bill', async () => {
    const { user } = renderApp();
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Start my first bill' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('New bill')).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: 'Create' }));
    expect(await within(dialog).findByText('Enter the project or site name.')).toBeTruthy(); // no bill without a project
    await user.type(within(dialog).getByLabelText(/Project \/ site name/), 'Sharma house');
    await user.type(within(dialog).getByLabelText(/Client name/), 'Sharma ji');
    await user.click(within(dialog).getByRole('button', { name: 'Create' }));
    await waitFor(() => expect(savedState().bills.filter((entry) => !entry.deletedAt)).toHaveLength(1)); // the empty starter bill went to the recycle bin
    const [made] = savedState().bills.filter((entry) => !entry.deletedAt);
    expect(made).toMatchObject({ number: '1', projectName: 'Sharma house', client: 'Sharma ji' });
    expect(made.projectId).toBeTruthy();
    expect(screen.queryByText('Getting started')).toBeNull();
  });
});

describe('Labour screen', () => {
  it('adds a worker, marks 2P / 1.5P attendance and shows the monthly wages', async () => {
    const { user } = renderApp(SAMPLE_STATE);
    await goTo(user, 'Labour');
    await screen.findByRole('heading', { name: 'Labour' });

    await user.click(screen.getByRole('button', { name: 'Add worker' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/Name/), 'Ramesh');
    await user.type(within(dialog).getByLabelText(/Daily wage/), '600');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(screen.getByText('Ramesh')).toBeTruthy();

    await user.click(screen.getByRole('tab', { name: 'Attendance' }));
    await user.click(await screen.findByRole('button', { name: 'Mark today’s attendance' }));
    const day = await screen.findByRole('dialog');
    await user.click(within(day).getByRole('button', { name: 'Ramesh 2P' }));
    expect(await within(day).findByText('1 present')).toBeTruthy();
    const today = Object.keys(savedState().labour.attendance)[0];
    expect(savedState().labour.attendance[today][savedState().labour.workers[0].id]).toMatchObject({ units: 2, wage: 600 });

    await user.click(within(day).getByRole('button', { name: 'Ramesh 1.5P' }));
    await user.click(within(day).getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    // Single-worker view: the calendar shows the worker's mark.
    await user.click(screen.getByRole('button', { name: 'Ramesh' }));
    expect(screen.getByRole('button', { name: /: 1.5P$/ })).toBeTruthy();
    await user.click(screen.getByRole('tab', { name: 'Report' }));
    expect(await screen.findByText('1.5P · 1 days · 0 absent')).toBeTruthy();
    expect(screen.getAllByText('₹900').length).toBeGreaterThan(0);
    expect(screen.getAllByText('1½P × 1').length).toBeGreaterThan(0);

    // The language of the worker PDFs is chosen here, separately from the app language, and remembered.
    await user.click(screen.getByRole('button', { name: 'PDF in Hindi' }));
    expect(window.localStorage.getItem('labour_pdf_language')).toBe('hi');
    await user.click(screen.getByRole('button', { name: 'PDF in English' }));
    expect(window.localStorage.getItem('labour_pdf_language')).toBe('en');

    // Advance with date, mode and description; each worker has their own PDF.
    await user.click(screen.getByRole('button', { name: 'Pay Ramesh' }));
    const pay = await screen.findByRole('dialog');
    await user.clear(within(pay).getByLabelText(/Amount/));
    await user.type(within(pay).getByLabelText(/Amount/), '500');
    await user.type(within(pay).getByLabelText(/Description/), 'Advance for rent');
    await user.click(within(pay).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await user.click(screen.getByRole('button', { name: 'Details for Ramesh' }));
    expect(await screen.findByText('₹500 · Cash')).toBeTruthy();
    expect(screen.getAllByText(/Advance for rent/).length).toBeGreaterThan(0);
    expect(savedState().labour.payments[0]).toMatchObject({ amount: 500, mode: 'cash', note: 'Advance for rent' });
    expect(screen.getByRole('button', { name: 'PDF for Ramesh' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Share with Ramesh' })).toBeTruthy();

    // Attendance sheet with the firm header.
    await user.click(screen.getByRole('tab', { name: 'Sheet / PDF' }));
    expect((await screen.findAllByText('Labour attendance register')).length).toBeGreaterThan(0);
    expect(screen.getAllByText('Acme Interiors').length).toBeGreaterThan(0);
    expect(screen.getByRole('button', { name: 'WhatsApp' })).toBeTruthy();
  });
});

describe('Labour safety: history, recycle bin, closed months', () => {
  const LABOUR_STATE = {
    ...SAMPLE_STATE,
    labour: {
      workers: [{ id: 'w1', name: 'Ramesh', dailyWage: 600, role: '', phone: '', active: true }],
      attendance: {},
      payments: [{ id: 'p1', workerId: 'w1', date: `${new Date().toISOString().slice(0, 7)}-01`, amount: 2000, mode: 'cash', note: 'Advance' }]
    }
  };

  it('deletes a payment to the recycle bin, restores it, and closes the month', async () => {
    const { user } = renderApp(LABOUR_STATE);
    await goTo(user, 'Labour');
    await user.click(await screen.findByRole('tab', { name: 'Report' }));
    await user.click((await screen.findAllByRole('button', { name: /^Details for / }))[0]);

    // Delete asks first, then the payment can be restored from History.
    await user.click(await screen.findByRole('button', { name: 'Delete payment' }));
    const ask = await screen.findByRole('dialog');
    expect(within(ask).getByText('Delete this payment?')).toBeTruthy();
    await user.click(within(ask).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(screen.queryByText('₹2,000 · Cash')).toBeNull());
    expect(savedState().labour.payments[0].deletedAt).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    await user.click(screen.getByRole('button', { name: 'History' }));
    const history = await screen.findByRole('dialog');
    expect(within(history).getByText('Payment deleted')).toBeTruthy();
    await user.click(within(history).getByRole('tab', { name: 'Recently deleted' }));
    await user.click(within(history).getByRole('button', { name: 'Restore' }));
    await waitFor(() => expect(savedState().labour.payments[0].deletedAt).toBeNull());
    await user.click(within(history).getByRole('button', { name: 'Close' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(await screen.findByText('₹2,000 · Cash')).toBeTruthy();

    // Closing the month (from the Attendance tab) locks its payments.
    expect(screen.queryByRole('button', { name: 'Close month' })).toBeNull();
    await user.click(screen.getByRole('tab', { name: 'Attendance' }));
    await user.click(await screen.findByRole('button', { name: 'Close month' }));
    const close = await screen.findByRole('dialog');
    await user.click(within(close).getByRole('button', { name: 'Close month' }));
    expect(await screen.findByRole('button', { name: 'Unlock' })).toBeTruthy();
    await user.click(screen.getByRole('tab', { name: 'Report' }));
    expect(screen.queryByRole('button', { name: 'Delete payment' })).toBeNull();
    expect(Object.keys(savedState().labour.closedMonths)).toHaveLength(1);
  });
});

describe('History and recycle bin', () => {
  it('restores a deleted bill and undoes a bill edit', async () => {
    const { user } = renderApp(SAMPLE_STATE);
    await goTo(user, 'Bills');
    await screen.findByRole('heading', { name: 'Bills' });

    // Deleting moves the bill to Recently deleted.
    await user.click(await screen.findByRole('button', { name: 'Actions for bill 2' }));
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
    const ask = await screen.findByRole('dialog');
    expect(within(ask).getByText('It moves to Recently deleted and can be restored for 30 days.')).toBeTruthy();
    await user.click(within(ask).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(screen.queryByText('Bill 2 · Office fitout')).toBeNull());
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(savedState().bills.find((bill) => bill.id === 'b2').deletedAt).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'History' }));
    const history = await screen.findByRole('dialog');
    expect(within(history).getByText('Bill deleted')).toBeTruthy();
    await user.click(within(history).getByRole('tab', { name: 'Recently deleted' }));
    expect(within(history).getByText('Bill 2 · Office fitout')).toBeTruthy();
    await user.click(within(history).getByRole('button', { name: 'Restore' }));
    await waitFor(() => expect(savedState().bills.find((bill) => bill.id === 'b2').deletedAt).toBeNull());
    await user.click(within(history).getByRole('button', { name: 'Close' }));
    expect(await screen.findByText('Bill 2 · Office fitout')).toBeTruthy();
  });

  it('Delete everything shows its progress, keeps the app working and leaves nothing behind', async () => {
    const { user } = renderApp(SAMPLE_STATE);
    await goTo(user, 'Bills');
    await user.click(await screen.findByRole('button', { name: 'History' }));
    const history = await screen.findByRole('dialog');
    await user.click(within(history).getByRole('tab', { name: 'Recently deleted' }));
    await user.click(await within(history).findByRole('button', { name: 'Delete everything…' }));
    const ask = (await screen.findAllByRole('dialog')).at(-1);
    await user.type(within(ask).getByLabelText(/Type DELETE/), 'DELETE');
    await user.click(within(ask).getByRole('button', { name: 'Delete everything' }));
    expect(await screen.findByText('Deleting everything…')).toBeTruthy();
    expect(await screen.findByText('Everything is deleted.', {}, { timeout: 15000 })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(savedState().bills.filter((bill) => !bill.deletedAt)).toHaveLength(1)); // one blank bill to work in
    expect(savedState().bills.filter((bill) => bill.deletedAt)).toHaveLength(0);
    expect(screen.getAllByRole('heading', { name: 'Bills', hidden: true }).length).toBeGreaterThan(0); // no blank screen
  }, 30000);

  it('Delete everything also unlocks a closed month when there are no workers left', async () => {
    const { user } = renderApp({ ...SAMPLE_STATE, labour: { closedMonths: { '2026-10': { closedAt: '2026-11-01T10:00:00.000Z' } } } });
    await goTo(user, 'Bills');
    await user.click(await screen.findByRole('button', { name: 'History' }));
    const history = await screen.findByRole('dialog');
    await user.click(within(history).getByRole('tab', { name: 'Recently deleted' }));
    await user.click(await within(history).findByRole('button', { name: 'Delete everything…' }));
    const ask = (await screen.findAllByRole('dialog')).at(-1);
    await user.type(within(ask).getByLabelText(/Type DELETE/), 'DELETE');
    await user.click(within(ask).getByRole('button', { name: 'Delete everything' }));
    expect(await screen.findByText('Everything is deleted.', {}, { timeout: 15000 })).toBeTruthy();
    await waitFor(() => expect(savedState().labour.closedMonths).toEqual({}));
  }, 30000);

  it('undoes an edit to firm details from Settings', async () => {
    const { user } = renderApp(SAMPLE_STATE);
    await goTo(user, 'Firm');
    const name = await screen.findByLabelText(/Firm name/);
    await user.clear(name);
    await user.type(name, 'Typo Firm');
    await waitFor(() => expect(savedState().firm.name).toBe('Typo Firm'));

    await openSettings(user);
    await user.click(await screen.findByRole('button', { name: 'Open history' }));
    const history = await screen.findByRole('dialog');
    expect(within(history).getByText('Firm details changed')).toBeTruthy();
    await user.click(within(history).getAllByRole('button', { name: 'Undo' })[0]);
    const ask = (await screen.findAllByRole('dialog')).at(-1);
    await user.click(within(ask).getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(savedState().firm.name).toBe('Acme Interiors'));
  });
});

describe('Projects, advances and expenses', () => {
  it('deletes an empty project but refuses one that still has records', async () => {
    const { user } = renderApp(SAMPLE_STATE);
    await goTo(user, 'Projects');
    const addProject = async (name) => {
      await user.click(await screen.findByRole('button', { name: 'Add project' }));
      const dialog = await screen.findByRole('dialog');
      await user.type(within(dialog).getByLabelText(/Project \/ site name/), name);
      await user.type(within(dialog).getByLabelText(/Client name/), 'Some client');
      await user.click(within(dialog).getByRole('button', { name: 'Save' }));
      await screen.findByRole('heading', { name });
    };

    await addProject('Empty site');
    await user.click(screen.getByRole('button', { name: 'Delete project' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(savedState().projects.find((entry) => entry.name === 'Empty site').deletedAt).toBeTruthy());

    await addProject('Busy site');
    await user.click(screen.getByRole('button', { name: 'Add advance' }));
    const advance = await screen.findByRole('dialog');
    await user.type(within(advance).getByLabelText(/Amount/), '1000');
    await user.click(within(advance).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await user.click(screen.getByRole('button', { name: 'Delete project' }));
    expect(await screen.findByText(/still has 1 advance/)).toBeTruthy();
    expect(savedState().projects.find((entry) => entry.name === 'Busy site').deletedAt).toBeFalsy();
  });

  it('adds a project, an advance from the client and a site expense, and lists the expense day by day', async () => {
    const { user } = renderApp(SAMPLE_STATE);
    await goTo(user, 'Projects');
    await user.click(await screen.findByRole('button', { name: 'Add project' }));
    let dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/Project \/ site name/), 'Sharma house');
    await user.type(within(dialog).getByLabelText(/Client name/), 'Sharma ji');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(await screen.findByRole('heading', { name: 'Sharma house' })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Add advance' }));
    dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/Amount/), '50000');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    expect(await screen.findByText('Received from the client: ₹50,000')).toBeTruthy();
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    expect(screen.queryByRole('tab', { name: 'Expenses' })).toBeNull(); // expenses are entered on the Expenses page only
    await user.click(screen.getByRole('button', { name: 'Back to projects' }));
    await goTo(user, 'Expenses');
    await user.click(await screen.findByRole('button', { name: 'Add expense' }));
    dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/Amount/), '250');
    await user.type(within(dialog).getByLabelText(/Note/), 'Lunch');
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(savedState().expenses).toHaveLength(1));
    expect(savedState().expenses[0]).toMatchObject({ amount: 250, category: 'food', note: 'Lunch', version: 1 });
    expect(savedState().advances[0]).toMatchObject({ amount: 50000, mode: 'cash' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(savedState().projects[0].name).toBe('Sharma house');
    expect(savedState().advances[0].projectId).toBe(savedState().projects[0].id);

    // The Expenses tab: the daily table with its total, and exports.
    await goTo(user, 'Expenses');
    expect(await screen.findByRole('heading', { name: 'Expenses' })).toBeTruthy();
    // The calendar shows the day as a short amount tile.
    expect(await screen.findByRole('button', { name: /: ₹250$/ })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Table' }));
    expect((await screen.findAllByText('₹250')).length).toBeGreaterThan(1); // the row and the day total
    expect(screen.getAllByText('Lunch').length).toBeGreaterThan(0); // the row (and the hidden PDF copy)
    expect(screen.getByRole('button', { name: 'PDF' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Excel (CSV)' })).toBeTruthy();
  });

  it('asks for a project before the first expense', async () => {
    const { user } = renderApp(SAMPLE_STATE);
    await goTo(user, 'Expenses');
    expect(await screen.findByText('Add a project first')).toBeTruthy();
    await user.click(await screen.findByRole('button', { name: 'Go to Projects' }));
    expect(await screen.findByRole('heading', { name: 'Projects' })).toBeTruthy();
  });
});

describe('New bill and projects', () => {
  it('creates a bill under a new project', async () => {
    const { user } = renderApp(SAMPLE_STATE);
    await goTo(user, 'Bills');
    await screen.findByRole('heading', { name: 'Bills' });
    await user.click(await screen.findByRole('button', { name: /New bill/ }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('combobox', { name: /Project/ }));
    await user.click(await screen.findByRole('option', { name: 'Add a new project…' }));
    await user.type(within(dialog).getByLabelText(/Project \/ site name/), 'Green Park');
    await user.type(within(dialog).getByLabelText(/Client name/), 'Mehta');
    await user.click(within(dialog).getByRole('button', { name: 'Create' }));
    expect((await screen.findAllByText(/Green Park/)).length).toBeGreaterThan(0);
  });
});

describe('Link a bill to a project from the Bills list', () => {
  it('links an unlinked bill by adding its project, without opening it', async () => {
    const { user } = renderApp({ ...SAMPLE_STATE, bills: SAMPLE_STATE.bills.map((bill) => ({ ...bill, isSample: false, projectId: '' })) });
    await goTo(user, 'Bills');
    await screen.findByRole('heading', { name: 'Bills' });
    await user.click((await screen.findAllByRole('button', { name: 'Link to a project' }))[0]);
    const dialog = await screen.findByRole('dialog');
    // The bill's own project and client names are suggested.
    expect(within(dialog).getByLabelText(/Project \/ site name/).value).not.toBe('');
    await user.click(within(dialog).getByRole('button', { name: 'Link' }));
    await waitFor(() => expect(savedState().projects).toHaveLength(1));
    expect(savedState().bills.filter((bill) => bill.projectId === savedState().projects[0].id)).toHaveLength(1);
  });
});

describe('Firm tag line', () => {
  it('saves the tag line from the Firm tab', async () => {
    const { user } = renderApp(SAMPLE_STATE);
    await goTo(user, 'Firm');
    await user.type(await screen.findByLabelText('Tag line'), 'Specialist in marble');
    await waitFor(() => expect(savedState().firm.tagline).toBe('Specialist in marble'));
  });
});

describe('Project report', () => {
  it('shows billing, money received, costs and cash for a project', async () => {
    const stamp = { createdAt: '2026-11-01T00:00:00.000Z', updatedAt: '2026-11-01T00:00:00.000Z', version: 1 };
    const project = { id: 'p1', name: 'Lake villa', clientId: '', client: 'Mehta', clientPhone: '', clientAddress: '', clientGstin: '', address: '', status: 'running', agreedAmount: '', notes: '', ...stamp };
    const { user } = renderApp({
      ...SAMPLE_STATE,
      projects: [project],
      bills: SAMPLE_STATE.bills.map((bill, index) => (index === 0 ? { ...bill, projectId: 'p1' } : bill)),
      advances: [{ id: 'a1', projectId: 'p1', date: '2026-11-02', amount: 2000, mode: 'cash', note: '', ...stamp }],
      expenses: [{ id: 'e1', projectId: 'p1', date: '2026-11-03', amount: 500, category: 'food', note: '', ...stamp }]
    });
    await goTo(user, 'Reports');
    expect(await screen.findByRole('heading', { name: 'Reports' })).toBeTruthy();
    expect(screen.getAllByText('Total received').length).toBeGreaterThan(0);
    expect(screen.getAllByText('Cash in hand').length).toBeGreaterThan(0);
    expect(screen.getAllByText('₹2,000').length).toBeGreaterThan(0); // the advance
    expect(screen.getAllByText('₹500').length).toBeGreaterThan(0); // site expenses
    await user.click(screen.getByRole('button', { name: 'PDF preview' }));
    expect(await screen.findByText('Project statement')).toBeTruthy();
  });
});

describe('Worker leaves and rejoins', () => {
  const STATE = {
    ...SAMPLE_STATE,
    labour: {
      workers: [{ id: 'w1', name: 'Ramesh', dailyWage: 600, role: '', phone: '', active: true, joinedOn: '2026-01-01', leftOn: '' }],
      attendance: { [`${new Date().toISOString().slice(0, 7)}-01`]: { w1: { units: 1, wage: 600, at: '2026-11-01T00:00:00.000Z' } } },
      payments: []
    }
  };

  it('settles wages and leaves, keeps the records, can rejoin, and cannot be deleted without typing the name', async () => {
    const { user } = renderApp(STATE);
    await goTo(user, 'Labour');
    await user.click(await screen.findByRole('tab', { name: 'Workers' }));
    await user.click(await screen.findByRole('button', { name: 'Actions for Ramesh' }));
    await user.click(screen.getByRole('menuitem', { name: 'Settle and leave' }));
    let dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Wages due to the worker: ₹600')).toBeTruthy();
    await user.click(within(dialog).getByRole('button', { name: 'Settle and leave' }));
    await waitFor(() => expect(savedState().labour.workers[0].active).toBe(false));
    const saved = savedState().labour;
    expect(saved.workers[0].leftOn).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(saved.payments).toHaveLength(1);
    expect(saved.payments[0]).toMatchObject({ amount: 600, note: 'Final settlement' });
    expect(Object.keys(saved.attendance)).toHaveLength(1); // attendance is kept
    expect(await screen.findByText('Left workers (1)')).toBeTruthy();

    // Deleting a worker with records asks for the name.
    await user.click(await screen.findByRole('button', { name: 'Actions for Ramesh' }));
    await user.click(screen.getByRole('menuitem', { name: 'Delete' }));
    dialog = await screen.findByRole('dialog');
    const confirmDelete = within(dialog).getByRole('button', { name: 'Delete with all records' });
    expect(confirmDelete.disabled).toBe(true);
    await user.type(within(dialog).getByLabelText(/Type Ramesh to confirm/), 'ramesh');
    expect(confirmDelete.disabled).toBe(false);
    await user.click(within(dialog).getByRole('button', { name: 'Cancel' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

    // Rejoin brings the worker back.
    await user.click(await screen.findByRole('button', { name: 'Actions for Ramesh' }));
    await user.click(screen.getByRole('menuitem', { name: 'Rejoin' }));
    await waitFor(() => expect(savedState().labour.workers[0].active).toBe(true));
    expect(savedState().labour.workers[0].leftOn).toBe('');
  });
});

describe('Apply a project advance to a bill', () => {
  it('applies part of the advance on the bill and keeps the project total unchanged', async () => {
    const stamp = { createdAt: '2026-11-01T00:00:00.000Z', updatedAt: '2026-11-01T00:00:00.000Z', version: 1 };
    const project = { id: 'p1', name: 'Lake villa', clientId: '', client: 'Mehta', clientPhone: '', clientAddress: '', clientGstin: '', address: '', status: 'running', agreedAmount: '', notes: '', ...stamp };
    const { user } = renderApp({
      ...SAMPLE_STATE,
      projects: [project],
      activeBillId: SAMPLE_STATE.bills[0].id,
      bills: SAMPLE_STATE.bills.map((bill, index) => (index === 0 ? { ...bill, status: 'ready', projectId: 'p1', advance: '0', payments: [] } : bill)),
      advances: [{ id: 'a1', projectId: 'p1', date: '2026-11-02', amount: 5000, mode: 'cash', note: '', ...stamp }]
    });
    await goTo(user, 'Entry');
    await user.click(await screen.findByRole('tab', { name: 'Amounts & payments' }));
    await user.click(await screen.findByRole('button', { name: 'Apply project advance' }));
    const dialog = await screen.findByRole('dialog');
    const amount = within(dialog).getByLabelText(/Amount to apply/);
    await user.clear(amount);
    await user.type(amount, '3000');
    await user.click(within(dialog).getByRole('button', { name: 'Apply' }));
    await waitFor(() => expect(savedState().bills[0].advanceAdjustments).toHaveLength(1));
    expect(savedState().bills[0].advanceAdjustments[0]).toMatchObject({ advanceId: 'a1', amount: 3000 });
    expect((await screen.findAllByText('Adjusted from advance')).length).toBeGreaterThan(0);
  });
});

describe('Bill stages', () => {
  it('marks a bill ready from the Bills page, freezing its prices, and can move it back to draft', async () => {
    const { user } = renderApp(SAMPLE_STATE);
    await billMenu(user, 1, 'Mark ready');
    const ask = await screen.findByRole('dialog');
    await user.click(within(ask).getByRole('button', { name: 'Mark as ready' }));
    await waitFor(() => expect(savedState().bills[0].status).toBe('ready'));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    const item = savedState().bills[0].sections[0].areas[0].items[0];
    expect(item.rateId).toBeUndefined();
    expect(item.sourceRateId).toBe('floor-tiles');
    await user.click(await screen.findByRole('button', { name: 'Actions for bill 1' }));
    await user.click(screen.getByRole('menuitem', { name: 'Back to draft' }));
    const again = await screen.findByRole('dialog');
    // the sample bill carries an advance, so the admin gives a reason
    await user.type(within(again).getByLabelText('Reason'), 'Client asked for a discount');
    await user.click(within(again).getByRole('button', { name: 'Back to draft' }));
    await waitFor(() => expect(savedState().bills[0].status).toBe('draft'));
    expect(savedState().bills[0].sections[0].areas[0].items[0].rateId).toBe('floor-tiles');
  });

  it('the Entry page shows the stage but changes happen from the Bills page', async () => {
    const { user } = renderApp(SAMPLE_STATE);
    await goTo(user, 'Entry');
    expect(await screen.findByText(/Being worked on/)).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Mark ready' })).toBeNull();
    await user.click(await screen.findByRole('button', { name: 'Manage in Bills' }));
    expect(await screen.findByRole('heading', { name: 'Bills' })).toBeTruthy();
  });

  it('a draft takes no payments or advance until the bill is ready', async () => {
    const { user } = renderApp(SAMPLE_STATE);
    await goTo(user, 'Entry');
    await user.click(await screen.findByRole('tab', { name: 'Amounts & payments' }));
    expect(screen.queryByRole('button', { name: 'Record payment' })).toBeNull();
    expect((await screen.findAllByText(/Mark the bill ready/)).length).toBeGreaterThan(0);
  });
});

describe('Payment receipt', () => {
  it('opens a receipt for a payment recorded on the bill', async () => {
    const payment = { id: 'pay1', date: '2026-11-02', amount: 1500, mode: 'cash', note: '' };
    const { user } = renderApp({ ...SAMPLE_STATE, bills: SAMPLE_STATE.bills.map((bill, index) => (index === 0 ? { ...bill, payments: [payment] } : bill)) });
    await goTo(user, 'Entry');
    await user.click(await screen.findByRole('tab', { name: 'Amounts & payments' }));
    await user.click(await screen.findByRole('button', { name: /Actions for payment on 2026-11-02/ }));
    await user.click(screen.getByRole('menuitem', { name: 'Receipt' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Receipt no.')).toBeTruthy();
    expect(within(dialog).getAllByText('RCT-261102-PAY1').length).toBeGreaterThan(0);
    expect(within(dialog).getByText('Payment for bill 1')).toBeTruthy();
  });
});

describe('Search everything', () => {
  it('finds a project from the header search and opens it', async () => {
    const stamp = { createdAt: '2026-11-01T00:00:00.000Z', updatedAt: '2026-11-01T00:00:00.000Z', version: 1 };
    const project = { id: 'p1', name: 'Lake villa', clientId: '', client: 'Mehta', clientPhone: '', clientAddress: '', clientGstin: '', address: '', status: 'running', agreedAmount: '', notes: '', ...stamp };
    const { user } = renderApp({ ...SAMPLE_STATE, projects: [project] });
    await user.click(await screen.findByRole('button', { name: 'Search' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Search everything'), 'mehta');
    await user.click(await within(dialog).findByText('Lake villa'));
    expect(await screen.findByRole('heading', { name: 'Lake villa' })).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Back to projects' })).toBeTruthy();
  });
});

describe('To do today', () => {
  it('reminds about attendance and can be set aside for the day', async () => {
    const { user } = renderApp({ ...SAMPLE_STATE, labour: { workers: [{ id: 'w1', name: 'Ramesh', dailyWage: 600, role: '', phone: '', active: true, joinedOn: '2026-01-01', leftOn: '' }], attendance: {}, payments: [] } });
    expect(await screen.findByText('To do today')).toBeTruthy();
    expect(screen.getByText('Attendance is not marked today for 1 of 1 workers.')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: /^Later: Attendance/ }));
    await waitFor(() => expect(screen.queryByText('Attendance is not marked today for 1 of 1 workers.')).toBeNull());
  });
});

describe('Expenses and Labour follow one project at a time', () => {
  const twoProjects = () => ({
    ...SAMPLE_STATE,
    projects: [
      { id: 'pa', name: 'Alpha site', client: 'A', status: 'running', version: 1 },
      { id: 'pb', name: 'Beta site', client: 'B', status: 'running', version: 1 }
    ]
  });

  it('shows only the chosen project\'s expenses, and deletes one entry or the whole day', async () => {
    const today = new Date().toISOString().slice(0, 10);
    const expense = (id, projectId, amount) => ({ id, projectId, date: today, amount, category: 'food', note: `note-${id}`, version: 1, createdAt: '2026-11-01T00:00:00Z', updatedAt: '2026-11-01T00:00:00Z', updatedBy: 'u' });
    const state = { ...twoProjects(), expenses: [expense('e1', 'pa', 100), expense('e2', 'pa', 200), expense('e3', 'pb', 999)] };
    const { user } = renderApp(state);
    await goTo(user, 'Expenses');
    await user.click(await screen.findByRole('button', { name: 'Table' }));
    expect(await screen.findAllByText('note-e1')).not.toHaveLength(0);
    expect(screen.queryByText('note-e3')).toBeNull(); // the other project is not shown

    await user.click(screen.getByRole('button', { name: 'Delete expense ₹100' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete' }));
    await waitFor(() => expect(savedState().expenses.find((item) => item.id === 'e1').deletedAt).toBeTruthy());

    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    await user.click(await screen.findByRole('button', { name: /^Delete all expenses of / }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Delete all' }));
    await waitFor(() => expect(savedState().expenses.find((item) => item.id === 'e2').deletedAt).toBeTruthy());
    expect(savedState().expenses.find((item) => item.id === 'e3').deletedAt).toBeFalsy(); // the other project is untouched
  });
});

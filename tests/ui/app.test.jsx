import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { SAMPLE_STATE, renderApp, savedState } from './render-app.jsx';

/** Opens the side menu and taps a tab. */
const goTo = async (user, name) => {
  await user.click(screen.getByRole('button', { name: 'Menu' }));
  await user.click(within(await screen.findByRole('navigation', { name: 'Main navigation' })).getByRole('button', { name }));
};
const openSettings = (user) => user.click(screen.getByRole('button', { name: 'App settings' }));

describe('Home', () => {
  it('opens on the business summary with KPIs and lists', async () => {
    renderApp(SAMPLE_STATE);
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
  it('shows one floor at a time and adds a measured entry', async () => {
    const { user } = renderApp(SAMPLE_STATE);
    await goTo(user, 'Entry');
    expect(await screen.findByRole('tab', { name: 'Ground floor' })).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'First floor' })).toBeTruthy();

    await user.click(screen.getAllByRole('button', { name: 'Add entry' })[0]);
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/Length \(ft\.in\)/), '10.6');
    await user.type(within(dialog).getByLabelText(/Width \(ft\.in\)/), '5.0');
    await user.click(within(dialog).getByRole('button', { name: 'Add' }));

    // 10'6" × 5' = 52.5 sqft × ₹85 = ₹4,463 → new total ₹19,161
    await waitFor(() => expect(screen.getAllByText('₹19,161').length).toBeGreaterThan(0));
    expect(savedState().bills[0].sections[0].areas[0].items).toHaveLength(3);
  });

  it('rejects inches above 11', async () => {
    const { user } = renderApp(SAMPLE_STATE);
    await goTo(user, 'Entry');
    await user.click((await screen.findAllByRole('button', { name: 'Add entry' }))[0]);
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText(/Length \(ft\.in\)/), '10.13');
    expect(within(dialog).getAllByText('Inches must be from 0 to 11.').length).toBeGreaterThan(0);
    expect(within(dialog).getByRole('button', { name: 'Add' }).disabled).toBe(true);
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
    const { user } = renderApp(SAMPLE_STATE);
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
  it('validates and adds a work item rate on the Rates tab', async () => {
    const { user } = renderApp(SAMPLE_STATE);
    await goTo(user, 'Rates');
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

  it('shows the rate quotation with editable terms', async () => {
    const { user } = renderApp(SAMPLE_STATE);
    await goTo(user, 'Rates');
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
    await goTo(user, 'Bill details');
    expect(await screen.findByRole('heading', { name: 'Bill details' })).toBeTruthy();
    expect(screen.queryByText('Your firm')).toBeNull();
    await goTo(user, 'Firm');
    expect(await screen.findByText('Your firm')).toBeTruthy();
    expect(screen.queryByText('Payments')).toBeNull();
    expect(screen.queryByText('Backup & restore')).toBeNull();
  });

  it('PDF opens on the preview with the amount in words', async () => {
    const { user } = renderApp(SAMPLE_STATE);
    await goTo(user, 'PDF / Print');
    expect((await screen.findByRole('tab', { name: 'Preview' })).getAttribute('aria-selected')).toBe('true');
    const preview = document.querySelector('.print-preview');
    expect(within(preview).getByText(/Rupees Thirteen Thousand Eight Hundred Ninety-Five Only/)).toBeTruthy();
  });
});

describe('First use', () => {
  it('welcomes a new user and can open a sample bill', async () => {
    const { user } = renderApp();
    const welcome = await screen.findByRole('dialog', { name: 'Welcome to Construction Billing' });
    await user.click(within(welcome).getByRole('button', { name: 'See a sample bill' }));
    expect(await screen.findByText(/This is a sample bill to explore/)).toBeTruthy();
    expect(screen.getAllByText('₹34,440').length).toBeGreaterThan(0);
    expect(savedState().meta.onboarded).toBe(true);
  });

  it('shows the getting-started checklist on an empty bill', async () => {
    const { user } = renderApp();
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Start my first bill' }));
    expect(await screen.findByText('Getting started')).toBeTruthy();
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

    // Advance with date, mode and description; each worker has their own PDF.
    await user.click(screen.getByRole('button', { name: 'Pay Ramesh' }));
    const pay = await screen.findByRole('dialog');
    await user.clear(within(pay).getByLabelText(/Amount/));
    await user.type(within(pay).getByLabelText(/Amount/), '500');
    await user.type(within(pay).getByLabelText(/Description/), 'Advance for rent');
    await user.click(within(pay).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
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

    // Closing the month locks its payments.
    await user.click(screen.getByRole('button', { name: 'Close month' }));
    const close = await screen.findByRole('dialog');
    await user.click(within(close).getByRole('button', { name: 'Close month' }));
    expect(await screen.findByRole('button', { name: 'Unlock' })).toBeTruthy();
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

    await user.click(screen.getByRole('tab', { name: 'Expenses' }));
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
    expect((await screen.findAllByText('₹250')).length).toBeGreaterThan(1); // the row and the day total
    expect(screen.getByText('Lunch')).toBeTruthy();
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

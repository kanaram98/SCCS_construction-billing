import { describe, expect, it } from 'vitest';
import { screen, waitFor, within } from '@testing-library/react';
import { SAMPLE_STATE, renderApp, savedState } from './render-app.jsx';

/** Opens the side menu and taps a tab. */
const goTo = async (user, name) => {
  await user.click(screen.getByRole('button', { name: 'Menu' }));
  await user.click(within(await screen.findByRole('navigation', { name: 'Main navigation' })).getByRole('button', { name }));
};
/** Opens the ⋮ menu of a bill on the Bills page and taps an item. */
const billMenu = async (user, number, item) => {
  await goTo(user, 'Bills');
  await user.click(await screen.findByRole('button', { name: `Actions for bill ${number}` }));
  await user.click(screen.getByRole('menuitem', { name: item }));
};
const noDialog = () => waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());

const PROJECT = { id: 'p1', name: 'Lake View Villa', clientId: '', client: 'Sample Client', clientPhone: '', clientAddress: '', clientGstin: '', address: '', status: 'running', agreedAmount: '', notes: '' };
const withFirstBill = (state, extra) => ({ ...state, bills: state.bills.map((bill, index) => (index === 0 ? { ...bill, ...extra } : bill)) });
const ratesTable = async () => within(await screen.findByRole('table', { name: 'Work item rates' }));
const standardRates = async (user) => {
  await goTo(user, 'Quotation');
  await user.click(await screen.findByRole('tab', { name: 'Standard rates' }));
};

describe('Protected bills and prices', () => {
  it('cancels a bill that has money on it instead of deleting it; it moves to the Submitted tab, marked Cancelled', async () => {
    const { user } = renderApp(SAMPLE_STATE); // bill 1 carries a 5,000 advance
    await goTo(user, 'Bills');
    await user.click(await screen.findByRole('button', { name: 'Actions for bill 1' }));
    expect(screen.queryByRole('menuitem', { name: 'Delete' })).toBeNull();
    await user.click(screen.getByRole('menuitem', { name: 'Cancel bill' }));
    const dialog = await screen.findByRole('dialog');
    const confirmButton = within(dialog).getByRole('button', { name: 'Cancel bill' });
    expect(confirmButton.disabled).toBe(true); // a reason is required
    await user.type(within(dialog).getByLabelText('Reason'), 'Made by mistake');
    await user.click(confirmButton);
    await waitFor(() => expect(savedState().bills[0].cancelled).toBe(true));
    expect(savedState().bills[0].cancelReason).toBe('Made by mistake');
    expect(savedState().bills[0].deletedAt).toBeFalsy();
    await user.click(await screen.findByRole('tab', { name: /Submitted/ }));
    expect(await screen.findByText('Cancelled')).toBeTruthy();
  });

  it('retires a work item that bills use instead of deleting it', async () => {
    const { user } = renderApp(SAMPLE_STATE);
    await standardRates(user);
    await user.click(await screen.findByRole('button', { name: 'Actions for Floor tiles' }));
    await user.click(screen.getByRole('menuitem', { name: 'Retire' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Retire' }));
    await waitFor(() => expect(savedState().rates.find((rate) => rate.id === 'floor-tiles').archived).toBe(true));
    expect(savedState().bills[0].sections[0].areas[0].items[0].rate).toBe(85); // the bill is untouched
    expect((await ratesTable()).getByText('Retired')).toBeTruthy();
  });

  async function changePrice(user, price) {
    await standardRates(user);
    await user.click(await (await ratesTable()).findByText('Floor tiles'));
    const dialog = await screen.findByRole('dialog');
    const field = within(dialog).getByLabelText(/Rate/);
    await user.clear(field);
    await user.type(field, price);
    await user.click(within(dialog).getByRole('button', { name: 'Save' }));
    return screen.findByRole('dialog', { name: 'Change the price?' });
  }

  it('a new price applies to new entries only; existing entries keep theirs', async () => {
    const { user } = renderApp(SAMPLE_STATE);
    const ask = await changePrice(user, '100');
    await user.click(within(ask).getByRole('button', { name: 'New entries only' }));
    await waitFor(() => expect(savedState().rates.find((rate) => rate.id === 'floor-tiles').rate).toBe(100));
    expect(savedState().bills[0].sections[0].areas[0].items[0].rate).toBe(85);
  });

  it('the admin can also re-price the entries in draft bills', async () => {
    const { user } = renderApp(SAMPLE_STATE);
    const ask = await changePrice(user, '100');
    await user.click(within(ask).getByRole('button', { name: /Also update 1 draft bills/ }));
    await waitFor(() => expect(savedState().bills[0].sections[0].areas[0].items[0].rate).toBe(100));
  });

  it('a quotation: made from the Quotation tab, priced, made final, attached from the bill’s menu, and used for new entries', async () => {
    const { user } = renderApp({ ...withFirstBill(SAMPLE_STATE, { projectId: 'p1' }), projects: [PROJECT] });
    await goTo(user, 'Quotation');
    // nothing is crowded at the top: New quotation is at the bottom of the (empty) list
    await user.click(await screen.findByRole('button', { name: 'New quotation' }));
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('combobox', { name: /Project/ }));
    await user.click(await screen.findByRole('option', { name: /Lake View Villa/ }));
    await user.click(within(dialog).getByRole('button', { name: 'Create quotation' }));
    await waitFor(() => expect(savedState().quotations).toHaveLength(1));
    expect(savedState().quotations[0]).toMatchObject({ number: 'Q-0001', rev: 1, status: 'draft', projectId: 'p1' });
    expect(savedState().quotations[0].lines.map((entry) => entry.rateId)).toContain('floor-tiles');

    // it opens at once; its items are edited here and Add item is under the list
    await user.click(await (await ratesTable()).findByText('Floor tiles'));
    const edit = await screen.findByRole('dialog');
    const price = within(edit).getByLabelText(/Rate/);
    await user.clear(price);
    await user.type(price, '70');
    await user.click(within(edit).getByRole('button', { name: 'Save' }));
    await waitFor(() => expect(savedState().quotations[0].lines.find((entry) => entry.rateId === 'floor-tiles').rate).toBe(70));
    expect(savedState().rates.find((rate) => rate.id === 'floor-tiles').rate).toBe(85); // standard price unchanged
    await noDialog();
    expect(screen.getByRole('button', { name: 'Add item' })).toBeTruthy();

    // final: its prices are saved and it cannot be edited any more
    await user.click(screen.getByRole('button', { name: 'Make final' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Make final' }));
    await waitFor(() => expect(savedState().quotations[0].status).toBe('final'));
    await noDialog();
    expect(screen.queryByRole('button', { name: 'Add item' })).toBeNull();

    // attach it from the bill's menu: the draft's entries take its prices
    await billMenu(user, 1, 'Attach quotation');
    const attach = await screen.findByRole('dialog');
    await user.click(within(attach).getByRole('combobox', { name: /Quotation/ }));
    await user.click(await screen.findByRole('option', { name: /Q-0001/ }));
    await user.click(within(attach).getByRole('button', { name: 'Attach' }));
    await waitFor(() => expect(savedState().bills[0].quotationId).toBe(savedState().quotations[0].id));
    expect(savedState().bills[0].quotationLabel).toBe('Q-0001');
    expect(savedState().bills[0].sections[0].areas[0].items[0].rate).toBe(70);
    await noDialog();

    // a new entry is priced from the quotation too
    await goTo(user, 'Entry');
    await screen.findByRole('tab', { name: 'Ground floor' });
    await user.click(screen.getAllByRole('button', { name: 'Add or edit entries' })[0]);
    const sheet = await screen.findByRole('dialog');
    const boxes = within(sheet).getAllByRole('combobox', { name: /Work item/ });
    await user.click(boxes[boxes.length - 1]);
    await user.click(await screen.findByRole('option', { name: /Floor tiles/ }));
    const lastField = (label) => { const all = within(sheet).getAllByLabelText(label); return all[all.length - 1]; };
    await user.type(lastField('Length'), '10');
    await user.type(lastField('Width'), '10');
    await user.click(within(sheet).getByRole('button', { name: 'Done' }));
    await waitFor(() => expect(savedState().bills[0].sections[0].areas[0].items).toHaveLength(3));
    expect(savedState().bills[0].sections[0].areas[0].items.at(-1).rate).toBe(70);
  });

  it('a new work item can be made while building a quotation, and joins the standard rates too', async () => {
    const quotation = { id: 'q1', projectId: 'p1', number: 'Q-0001', rev: 1, name: 'Villa', status: 'draft', lines: [{ rateId: 'floor-tiles', name: 'Floor tiles', unit: 'sqft', type: 'area', rate: 70 }] };
    const { user } = renderApp({ ...SAMPLE_STATE, projects: [PROJECT], quotations: [quotation] });
    await goTo(user, 'Quotation');
    await user.click(await screen.findByText(/Q-0001 · Villa/));
    await user.click(await screen.findByRole('button', { name: 'Add item' }));
    await user.click(within(await screen.findByRole('dialog')).getByRole('button', { name: 'Make a new work item' }));
    const form = await screen.findByRole('dialog', { name: 'Add work item' });
    await user.type(within(form).getByLabelText(/Item name/), 'Wall putty');
    await user.type(within(form).getByLabelText(/^Unit/), 'sqft');
    await user.type(within(form).getByLabelText(/Rate/), '12');
    await user.click(within(form).getByRole('button', { name: 'Add item' }));
    await waitFor(() => expect(savedState().quotations[0].lines.some((entry) => entry.name === 'Wall putty' && entry.rate === 12)).toBe(true));
    expect(savedState().rates.some((rate) => rate.name === 'Wall putty')).toBe(true);
  });

  it('a bill cannot be marked ready while its quotation is still a draft', async () => {
    const quotation = { id: 'q1', projectId: 'p1', number: 'Q-0001', rev: 1, name: 'Villa', status: 'draft', lines: [{ rateId: 'floor-tiles', name: 'Floor tiles', unit: 'sqft', type: 'area', rate: 70 }] };
    const { user } = renderApp({ ...withFirstBill(SAMPLE_STATE, { projectId: 'p1', quotationId: 'q1', quotationLabel: 'Q-0001' }), projects: [PROJECT], quotations: [quotation] });
    await billMenu(user, 1, 'Mark ready');
    expect(await screen.findByText(/Make quotation Q-0001 final first/)).toBeTruthy();
    expect(savedState().bills[0].status).toBeUndefined();
  });

  it('an estimate needs a final quotation before it can be marked final', async () => {
    const estimate = { ...SAMPLE_STATE.bills[0], kind: 'estimate', advance: '' };
    const { user } = renderApp({ ...SAMPLE_STATE, bills: [estimate, SAMPLE_STATE.bills[1]] });
    await goTo(user, 'Bills');
    await user.click(await screen.findByRole('tab', { name: /Estimates/ }));
    await user.click(await screen.findByRole('button', { name: 'Actions for bill 1' }));
    await user.click(screen.getByRole('menuitem', { name: 'Mark final' }));
    expect(await screen.findByText(/An estimate needs a final quotation/)).toBeTruthy();
  });

  it('a submitted bill is read-only: no payments, locked entries; the admin reopens it from the Submitted tab with a reason', async () => {
    const { user } = renderApp(withFirstBill(SAMPLE_STATE, { status: 'submitted' }));
    await goTo(user, 'Entry');
    expect(await screen.findByText(/Closed and read-only/)).toBeTruthy();
    await user.click(await screen.findByRole('tab', { name: 'Amounts & payments' }));
    expect(screen.queryByRole('button', { name: 'Record payment' })).toBeNull();
    await goTo(user, 'Bills');
    await user.click(await screen.findByRole('tab', { name: /Submitted/ }));
    await user.click(await screen.findByRole('button', { name: 'Actions for bill 1' }));
    await user.click(screen.getByRole('menuitem', { name: 'Reopen' }));
    const dialog = await screen.findByRole('dialog');
    await user.type(within(dialog).getByLabelText('Reason'), 'Client found a mistake');
    await user.click(within(dialog).getByRole('button', { name: 'Reopen' }));
    await waitFor(() => expect(savedState().bills[0].status).toBe('ready')); // back to ready, not to draft
    expect(savedState().bills[0].audit.at(-1)).toMatchObject({ action: 'reopened', reason: 'Client found a mistake' });
  });

  it('submits a ready bill from the Bills page: a balance needs a reason, then it moves to the Submitted tab', async () => {
    const { user } = renderApp(withFirstBill(SAMPLE_STATE, { status: 'ready' }));
    await billMenu(user, 1, 'Submit');
    const dialog = await screen.findByRole('dialog');
    const confirmButton = within(dialog).getByRole('button', { name: 'Submit' });
    expect(confirmButton.disabled).toBe(true); // 8,895 is still unpaid, so a reason is needed
    await user.type(within(dialog).getByLabelText('Reason'), 'Client will pay next month');
    await user.click(confirmButton);
    await waitFor(() => expect(savedState().bills[0].status).toBe('submitted'));
    expect(savedState().bills[0].audit.at(-1)).toMatchObject({ action: 'submitted-unpaid', reason: 'Client will pay next month' });
    await noDialog();
    expect(await screen.findByRole('tab', { name: /Submitted \(1\)/ })).toBeTruthy();
    expect(screen.queryByText('Bill 1 · Lake View Villa')).toBeNull(); // gone from the working list
    await user.click(screen.getByRole('tab', { name: /Submitted/ }));
    expect(await screen.findByText('Bill 1 · Lake View Villa')).toBeTruthy();
  });

  it('a ready bill keeps its number fixed in Edit details', async () => {
    const { user } = renderApp(withFirstBill(SAMPLE_STATE, { status: 'ready' }));
    await billMenu(user, 1, 'Edit details');
    expect((await screen.findByLabelText(/Bill number/)).disabled).toBe(true);
  });

  it('Find a bill searches every bill and estimate by number, name, client, project or quotation, and filters by stage', async () => {
    const state = {
      ...SAMPLE_STATE,
      bills: [
        { ...SAMPLE_STATE.bills[0], status: 'ready', name: 'Marble work', quotationLabel: 'Q-0004' },
        { ...SAMPLE_STATE.bills[1], status: 'submitted' },
        { ...SAMPLE_STATE.bills[1], id: 'b3', number: '3', projectName: 'Garden house', client: 'Verma', status: 'draft' },
        { ...SAMPLE_STATE.bills[1], id: 'e1', number: '1', kind: 'estimate', projectName: 'Mall fitout', client: 'Gupta' }
      ]
    };
    const { user } = renderApp(state);
    await goTo(user, 'Find a bill');
    expect(await screen.findByText('Bill 1 · Lake View Villa')).toBeTruthy();
    expect(screen.getByText('Bill 2 · Office fitout')).toBeTruthy(); // submitted bills are listed here too
    expect(screen.getByText('Estimate 1 · Mall fitout')).toBeTruthy();
    const search = await screen.findByLabelText('Search bills');
    await user.type(search, 'marble'); // a bill name
    expect(await screen.findByText('Bill 1 · Lake View Villa')).toBeTruthy();
    expect(screen.queryByText('Bill 2 · Office fitout')).toBeNull();
    await user.clear(search);
    await user.type(search, 'Q-0004'); // a quotation
    expect(screen.getByText('Bill 1 · Lake View Villa')).toBeTruthy();
    expect(screen.queryByText('Bill 3 · Garden house')).toBeNull();
    await user.clear(search);
    await user.type(search, 'verma'); // a client
    expect(screen.getByText('Bill 3 · Garden house')).toBeTruthy();
    await user.clear(search);
    await user.click(screen.getByRole('button', { name: /^Submitted/ }));
    expect(screen.getByText('Bill 2 · Office fitout')).toBeTruthy();
    expect(screen.queryByText('Bill 3 · Garden house')).toBeNull();
    // a bill found here has the same menu as on the Bills page
    await user.click(screen.getByRole('button', { name: 'Actions for bill 2' }));
    expect(screen.getByRole('menuitem', { name: 'Print / PDF' })).toBeTruthy();
  });

  it('any bill can be printed: pick an older one on the PDF page, or send it there from its menu', async () => {
    const older = { ...SAMPLE_STATE.bills[0], id: 'old', number: '9', date: '2026-01-05', projectName: 'Old Palace', client: 'Rao', status: 'submitted', advance: '' };
    const { user } = renderApp({ ...SAMPLE_STATE, bills: [SAMPLE_STATE.bills[0], older] });
    await goTo(user, 'PDF / Print');
    const picker = await screen.findByRole('combobox', { name: 'Bill to print' });
    expect(picker.value).toMatch(/Bill 1/); // the open bill by default
    await user.click(picker);
    await user.click(await screen.findByRole('option', { name: /Bill 9/ }));
    await waitFor(() => expect(document.querySelector('.print-preview')?.textContent).toMatch(/Old Palace/));
    expect(savedState().activeBillId).toBe('b1'); // choosing it to print does not change the open bill
    expect(document.querySelector('.print-preview .draft-stamp')).toBeNull(); // a submitted bill has no DRAFT stamp
    // from the bill's menu
    await goTo(user, 'Find a bill');
    await user.click(await screen.findByRole('button', { name: 'Actions for bill 9' }));
    await user.click(screen.getByRole('menuitem', { name: 'Print / PDF' }));
    expect((await screen.findByRole('combobox', { name: 'Bill to print' })).value).toMatch(/Bill 9/);
  });

  it('makes a stray bill the next running bill of another bill in the same project', async () => {
    const state = {
      ...SAMPLE_STATE,
      projects: [PROJECT],
      bills: [
        { ...SAMPLE_STATE.bills[0], projectId: 'p1', advance: '' },
        { ...SAMPLE_STATE.bills[1], projectId: 'p1', projectName: 'Lake View Villa', sections: [] },
        { ...SAMPLE_STATE.bills[1], id: 'b3', number: '3', projectId: 'p2', projectName: 'Other', sections: [] }
      ]
    };
    const { user } = renderApp(state);
    await billMenu(user, 2, 'Make a running bill of…');
    const dialog = await screen.findByRole('dialog');
    await user.click(within(dialog).getByRole('combobox', { name: /Running bill of/ }));
    const options = await screen.findAllByRole('option');
    expect(options.map((option) => option.textContent).join('|')).toMatch(/LVV.001/);
    expect(options.map((option) => option.textContent).join('|')).not.toMatch(/OTH.003/); // another project
    await user.click(options.find((option) => /LVV.001/.test(option.textContent)));
    await user.click(within(dialog).getByRole('button', { name: 'Make running bill' }));
    await waitFor(() => expect(savedState().bills.find((bill) => bill.id === 'b2').raNumber).toBe(2));
    expect(savedState().bills.find((bill) => bill.id === 'b1')).toMatchObject({ raNumber: 1 });
    expect(savedState().bills.find((bill) => bill.id === 'b2').number).toBe('2');
  });
});

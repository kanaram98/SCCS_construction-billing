import test from 'node:test';
import assert from 'node:assert/strict';
import { hydrateState, selectActiveBill } from '../../src/domain/app-state.js';
import { migrateLegacyState } from '../../src/domain/legacy-migration.js';
import { getClientProfileState, getClientSaveError } from '../../src/domain/clients.js';
import { filterBills, getBillClientNames } from '../../src/domain/bill-filters.js';
import { EMPTY_BILL_FILTERS } from '../../src/domain/bill-filters.js';

test('hydrating saved state fills defaults and repairs the active bill id', () => {
  const state = hydrateState({ bills: [{ id: 'b1', sections: [] }], activeBillId: 'gone' });
  assert.equal(state.activeBillId, 'b1');
  assert.deepEqual(state.clients, []);
  assert.equal(state.printSettings.paper, 'a4');
  assert.equal(selectActiveBill(state).id, 'b1');
  assert.equal(hydrateState({ bills: [] }), null);
});

test('migrates legacy bills including feet/inch pairs', () => {
  const migrated = migrateLegacyState({
    bid: 2,
    rates: [{ id: 1, name: 'Tiles', unit: 'sqft', type: 'area', rate: 50 }],
    bills: [{
      id: 2,
      p: { no: 9, name: 'Old site' },
      floors: [{ id: 3, name: 'GF', rooms: [{ id: 4, name: 'Hall', items: [{ id: 5, rid: 1, l: [10, 6], b: [8, 0] }] }] }]
    }]
  });
  const state = hydrateState(migrated, { isLegacy: true });
  const item = state.bills[0].sections[0].areas[0].items[0];
  assert.equal(state.activeBillId, '2');
  assert.equal(item.length, '10.6');
  assert.equal(item.name, 'Tiles');
  assert.deepEqual(state.templates, []);
  assert.equal(migrateLegacyState({}), null);
});

test('client profile state detects duplicates by case-insensitive name', () => {
  const clients = [{ id: 'c1', name: 'Asha Builders' }];
  const typed = getClientProfileState({ client: ' asha builders ', clientId: '' }, clients);
  assert.equal(typed.duplicateClient, true);
  assert.equal(typed.canSaveNew, false);
  assert.match(getClientSaveError({ client: 'Asha Builders' }, clients, false), /already saved/);
  assert.equal(getClientSaveError({ client: 'New Co' }, clients, false), '');
  assert.match(getClientSaveError({ client: 'New Co' }, clients, true), /Select a saved client/);
});

test('filters bills by search, client, date range and status', () => {
  const bills = [
    { id: '1', number: '1', projectName: 'Tower', client: 'Ravi', date: '2026-01-10' },
    { id: '2', number: '2', projectName: 'Villa', client: 'Meera', date: '2026-03-05' }
  ];
  const status = (bill) => (bill.id === '1' ? 'paid' : 'unpaid');
  const run = (patch) => filterBills(bills, { ...EMPTY_BILL_FILTERS, ...patch }, status).map((bill) => bill.id);
  assert.deepEqual(run({ search: 'villa' }), ['2']);
  assert.deepEqual(run({ client: 'Ravi' }), ['1']);
  assert.deepEqual(run({ dateFrom: '2026-02-01' }), ['2']);
  assert.deepEqual(run({ dateTo: '2026-02-01' }), ['1']);
  assert.deepEqual(run({ payment: 'unpaid' }), ['2']);
  assert.deepEqual(getBillClientNames([...bills, { client: ' Ravi ' }]), ['Meera', 'Ravi']);
});

test('sorts bills by date, number, amount and balance', async () => {
  const { sortBills } = await import('../../src/domain/bill-filters.js');
  const bills = [
    { id: 'a', number: '2', date: '2026-02-01' },
    { id: 'b', number: '10', date: '2026-03-01' },
    { id: 'c', number: '1', date: '2026-01-01' }
  ];
  const totals = { a: { total: 500, balance: 0 }, b: { total: 100, balance: 100 }, c: { total: 900, balance: 50 } };
  const run = (sort) => sortBills(bills, sort, (bill) => ({ totals: totals[bill.id] })).map((bill) => bill.id).join('');
  assert.equal(run('newest'), 'bac');
  assert.equal(run('oldest'), 'cab');
  assert.equal(run('number'), 'cab');
  assert.equal(run('amount'), 'cab');
  assert.equal(run('balance'), 'bca');
  assert.equal(run('unknown'), 'bac');
});

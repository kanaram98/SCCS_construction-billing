import test from 'node:test';
import assert from 'node:assert/strict';
import { billStyleOf, getBillTotals, getSectionTotal, groupItemLines } from '../../src/domain/calculations.js';
import { createBill } from '../../src/domain/factories.js';
import { defaultLayout, layoutOptions, resolveLayout } from '../../src/domain/bill-layout.js';
import { normalizePrintSettings } from '../../src/domain/print-settings.js';
import { buildDocument, toTableCells } from '../../src/documents/document-model.js';

const rates = [
  { id: 'g', name: 'Granite door fitting', unit: 'sqft', type: 'area', rate: 50 },
  { id: 'p', name: 'PCC tile leveling', unit: 'sqft', type: 'area', rate: 25 },
  { id: 'd', name: 'Dhar polish', unit: 'rft', type: 'lenw', rate: 35 }
];
let counter = 0;
const item = (rateId, note, length, width = '') => {
  const rate = rates.find((entry) => entry.id === rateId);
  counter += 1;
  return { id: `i${counter}`, rateId, name: rate.name, unit: rate.unit, type: rate.type, rate: rate.rate, count: 1, length, width, note };
};
// Floor 1: three rooms, Floor 2: one room (the numbers of the sample bills in docs/mockups)
const sections = () => [
  { id: 's1', name: 'Floor 1', areas: [
    { id: 'a1', name: 'Bedroom 1', items: [item('g', 'Door 1', '24.6', '12.6'), item('g', 'Door 2', '23.9', '12.6'), item('p', '', '15.0', '12.0')] },
    { id: 'a2', name: 'Bedroom 2', items: [item('g', 'Door 1', '24.0', '12.6'), item('p', '', '14.0', '12.0')] },
    { id: 'a3', name: 'Bathroom', items: [item('g', 'Door 1', '25.3', '12.6'), item('d', 'Edge', '24.0')] }
  ] },
  { id: 's2', name: 'Floor 2', areas: [{ id: 'a4', name: 'Bedroom 3', items: [item('g', 'Door 1', '24.0', '12.6'), item('p', '', '15.0', '10.0')] }] }
];
const bill = (billStyle) => ({ ...createBill('3'), billStyle, number: '3', date: '2026-11-20', client: 'Sharma', sections: sections() });
const settings = (layouts) => ({ ...normalizePrintSettings({ pageBreak: 'none' }), layouts });
const money = (value) => `R${Math.round(value)}`;
const build = (type, billValue, layouts) => buildDocument(type, billValue, rates, settings(layouts), { money });
const labels = (rows) => rows.map((entry) => entry.cells[0]);

test('entries of the same work item, unit and price are added into one line; a different price stays a line of its own', () => {
  const room = bill('room').sections[0].areas[0];
  const lines = groupItemLines(room.items, rates);
  assert.deepEqual(lines.map((line) => [line.name, line.quantity, line.amount]), [['Granite door fitting', 603.13, 30157], ['PCC tile leveling', 180, 4500]]);
  assert.equal(lines[0].items.length, 2);
  const cheaper = { ...room.items[1], rate: 40 };
  assert.deepEqual(groupItemLines([room.items[0], cheaper], rates).map((line) => line.rate), [50, 40]);
});

test('a new bill adds up room by room; an older bill (no style) adds up entry by entry, so its total never changes', () => {
  assert.equal(createBill('1').billStyle, 'room');
  assert.equal(billStyleOf({}), 'entry');
  const room = getSectionTotal(bill('room').sections[0], rates, 'room');
  const entry = getSectionTotal(bill('entry').sections[0], rates, 'entry');
  assert.equal(room, 70479); // 30,157 + 4,500 + 15,000 + 4,200 + 15,782 + 840
  assert.equal(entry, 70479); // every entry rounded on its own: 15,313 + 14,844 + …
  assert.equal(getBillTotals(bill('room'), rates).total, 89229);
  assert.equal(getBillTotals({ ...bill('room'), billStyle: undefined }, rates).total, 89229);
});

test('the layouts offered, and the one a bill opens in', () => {
  assert.equal(defaultLayout(bill('room')), 'room');
  assert.equal(defaultLayout(bill(undefined)), 'entry');
  assert.deepEqual(layoutOptions(bill('room')), ['room', 'floor']);
  assert.deepEqual(layoutOptions(bill(undefined)), ['entry', 'room', 'floor']);
  assert.equal(resolveLayout(bill('room'), { bill: 'floor' }, 'bill'), 'floor');
  assert.equal(resolveLayout(bill('room'), { bill: 'entry' }, 'bill'), 'room'); // not offered for a new bill
  assert.equal(resolveLayout(bill('room'), {}, 'measurement'), 'room');
});

test('the bill by room has one line per work item in each room', () => {
  const { chunks } = build('bill', bill('room'), { bill: 'room' });
  const rows = chunks[0];
  const bedroom1 = rows.slice(rows.findIndex((entry) => entry.cells[0] === 'Bedroom 1'));
  assert.deepEqual(bedroom1.slice(1, 4).map((entry) => entry.cells), [
    ['Granite door fitting', '603.13', 'sqft', 'R50', 'R30157'],
    ['PCC tile leveling', '180.00', 'sqft', 'R25', 'R4500'],
    ['Bedroom 1 total', '', '', '', 'R34657']
  ]);
  assert.ok(!rows.some((entry) => entry.kind === 'round')); // the lines are the real amounts
});

test('the bill by floor has one line per work item for the floor, and a Round off row keeps every floor total exact', () => {
  const { chunks } = build('bill', bill('room'), { bill: 'floor' });
  const rows = chunks[0];
  const floor1 = rows.slice(0, rows.findIndex((entry) => entry.cells[0] === 'Floor 2'));
  assert.deepEqual(floor1.map((entry) => entry.cells), [
    ['Floor 1'],
    ['Granite door fitting', '1218.76', 'sqft', 'R50', 'R60938'],
    ['PCC tile leveling', '348.00', 'sqft', 'R25', 'R8700'],
    ['Dhar polish', '24.00', 'rft', 'R35', 'R840'],
    ['Round off', '', '', '', '+ R1'],
    ['Floor 1 total', '', '', '', 'R70479']
  ]);
  assert.ok(!rows.some((entry) => entry.cells[0] === 'Bedroom 1'));
  // Floor 2 needs no round off
  assert.equal(rows.filter((entry) => entry.kind === 'round').length, 1);
  const floorTotals = rows.filter((entry) => entry.kind === 'sectionTotal' && entry.cells[0].startsWith('Floor')).map((entry) => entry.cells[4]);
  const roomTotals = build('bill', bill('room'), { bill: 'room' }).chunks[0].filter((entry) => entry.kind === 'sectionTotal' && entry.cells[0].startsWith('Floor')).map((entry) => entry.cells[4]);
  assert.deepEqual(floorTotals, roomTotals); // the same floor totals in both layouts
  assert.deepEqual(floorTotals, ['R70479', 'R18750']);
});

test('the summary and the item totals tie to the same bill total', () => {
  const room = bill('room');
  const summary = build('summary', room).chunks[0];
  assert.equal(summary.find((entry) => entry.kind === 'grandTotal').cells[1], 'R89229');
  assert.deepEqual(summary.find((entry) => entry.cells[0] === 'Bedroom 1').cells, ['Bedroom 1', 'R34657']); // the room amount from the room lines
  const items = build('items', room).chunks[0];
  assert.equal(items.find((entry) => entry.kind === 'grandTotal').cells[4], 'R89229');
});

test('an older bill printed by room or by floor still ends at its own total, using a Round off row', () => {
  const older = bill(undefined);
  const entryTotal = getBillTotals(older, rates).total;
  for (const layout of ['entry', 'room', 'floor']) {
    const rows = build('bill', older, { bill: layout }).chunks[0];
    const totals = rows.filter((entry) => entry.kind === 'sectionTotal' && entry.cells[0].startsWith('Floor')).map((entry) => Number(entry.cells[4].slice(1)));
    assert.equal(totals.reduce((sum, value) => sum + value, 0), entryTotal, layout);
  }
  assert.equal(build('bill', older, {}).chunks[0].some((entry) => entry.kind === 'round'), false); // the default is the layout it always had
});

test('the measurement sheet by room totals each work item in the room; by floor it lists the rooms under each work item', () => {
  const room = build('measurement', bill('room'), { measurement: 'room' });
  const roomRows = room.chunks[0];
  const totalsRows = roomRows.filter((entry) => entry.kind === 'groupTotal');
  assert.deepEqual(totalsRows.map((entry) => [entry.cells[0], entry.cells[entry.cells.length - 2]]), [
    ['Granite door fitting · Bedroom 1 total (goes to the bill)', '603.13']
  ]); // only a room with several entries of one work item gets a total
  assert.equal(room.columns[0], 'Item');

  const floor = build('measurement', bill('room'), { measurement: 'floor' });
  assert.equal(floor.columns[0], 'Room');
  const floorRows = floor.chunks[0];
  const granite = floorRows.slice(floorRows.findIndex((entry) => entry.cells[0] === 'Granite door fitting'));
  assert.deepEqual(granite.slice(1, 6).map((entry) => entry.cells[0]), [
    'Bedroom 1\nDoor 1'.replace('\n', ' · '), 'Bedroom 1 · Door 2', 'Bedroom 2 · Door 1', 'Bathroom · Door 1',
    'Granite door fitting · Floor 1 total (goes to the bill)'
  ]);
  const total = granite[5];
  assert.equal(total.kind, 'groupTotal');
  assert.equal(total.cells[total.cells.length - 2], '1218.76'); // the quantity of the bill line
  assert.ok(!floorRows.some((entry) => entry.cells[0] === 'Bathroom')); // no room headings
});

test('the total row of a group spans the item columns in the table', () => {
  const cells = ['Granite door fitting · Bedroom 1 total', '', '', '', '603.13', 'sqft'];
  assert.deepEqual(toTableCells({ kind: 'groupTotal', cells }, 6), [
    { text: cells[0], span: 4 }, { text: '603.13', span: 1 }, { text: 'sqft', span: 1 }
  ]);
});

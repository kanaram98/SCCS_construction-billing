import test from 'node:test';
import assert from 'node:assert/strict';
import { buildDocument, toTableCells } from '../../src/documents/document-model.js';
import { createDefaultPrintSettings } from '../../src/domain/print-settings.js';

const rates = [
  { id: 'tile', name: 'Floor tiles', unit: 'sqft', type: 'area', rate: 10 },
  { id: 'hole', name: 'Gas hole', unit: 'nos', type: 'count', rate: 250 }
];
const money = (value) => `R${value}`;

const bill = {
  taxRate: '10',
  discount: '',
  advance: '100',
  sections: [
    {
      id: 's1',
      name: 'Ground',
      areas: [
        { id: 'a1', name: 'Hall', items: [{ id: 'i1', name: 'Floor tiles', rateId: 'tile', length: '10.0', width: '10.0', count: 1, note: 'Matt' }] },
        { id: 'a2', name: 'Kitchen', items: [{ id: 'i2', name: 'Gas hole', rateId: 'hole', count: 2 }] }
      ]
    },
    { id: 's2', name: 'First', areas: [{ id: 'a3', name: 'Bed', items: [{ id: 'i3', name: 'Gas hole', rateId: 'hole', count: 1 }] }] }
  ]
};

const settings = (patch = {}) => ({ ...createDefaultPrintSettings(), ...patch });

test('bill document splits pages per area and ends with totals', () => {
  const { columns, chunks } = buildDocument('bill', bill, rates, settings(), { money });
  assert.deepEqual(columns, ['Item', 'Qty', 'Unit', 'Rate', 'Amount']);
  assert.equal(chunks.length, 3);
  assert.equal(chunks[0][0].kind, 'section');
  assert.equal(chunks[1][0].kind, 'area');
  assert.equal(chunks[1].at(-1).cells[0], 'Ground total');
  assert.equal(chunks[0][1].cells[0], 'Hall');
  assert.equal(chunks[0][2].cells[0], 'Floor tiles\nMatt');

  const last = chunks.at(-1).map((row) => row.cells[0]);
  assert.deepEqual(last.slice(-5), ['Subtotal', 'GST (10%)', 'Total', 'Advance received', 'Balance due']);
  assert.equal(chunks.at(-1).find((row) => row.cells[0] === 'Total').cells[4], 'R1925');
});

test('page break settings control chunking', () => {
  assert.equal(buildDocument('measurement', bill, rates, settings({ pageBreak: 'section' }), { money }).chunks.length, 2);
  assert.equal(buildDocument('measurement', bill, rates, settings({ pageBreak: 'none' }), { money }).chunks.length, 1);
});

test('measurement sheet only shows the dimensions a work item uses', () => {
  const { chunks } = buildDocument('measurement', bill, rates, settings({ pageBreak: 'none' }), { money });
  const rows = chunks[0].filter((row) => row.kind === 'normal');
  assert.deepEqual(rows[0].cells, ['Floor tiles\nMatt', '1', `10'0"`, `10'0"`, '', '100', 'sqft']);
  assert.deepEqual(rows[1].cells, ['Gas hole', '2', '', '', '', '2', 'nos']);
});

test('summary and item totals', () => {
  const summary = buildDocument('summary', bill, rates, settings({ summaryDetail: 'section', rowNumbers: true }), { money });
  assert.deepEqual(summary.chunks[0].map((row) => row.cells), [['1. Ground', 'R1500'], ['2. First', 'R250'], ['Grand total', 'R1925']]);

  const items = buildDocument('items', bill, rates, settings(), { money });
  assert.deepEqual(items.chunks[0][1].cells, ['Gas hole', '3', 'nos', 'R250', 'R750']);
  assert.deepEqual(items.chunks[0].at(-1).cells, ['Item totals', '', '', '', 'R1750']);
});

test('table cells merge label columns for bands and totals', () => {
  assert.deepEqual(toTableCells({ kind: 'section', cells: ['Ground', ''] }, 2), [{ text: 'Ground', span: 2 }]);
  assert.deepEqual(toTableCells({ kind: 'total', cells: ['Hall total', '', '', '', 'R1'] }, 5), [
    { text: 'Hall total', span: 4 },
    { text: 'R1', span: 1 }
  ]);
  assert.equal(toTableCells({ kind: 'normal', cells: ['a', 'b'] }, 2).length, 2);
});

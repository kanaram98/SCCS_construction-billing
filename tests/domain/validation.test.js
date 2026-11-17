import test from 'node:test';
import assert from 'node:assert/strict';
import {
  getAmountErrors,
  getExportErrors,
  isBillNumberTaken,
  validateEntry
} from '../../src/domain/validation.js';

const tileRate = { id: 'tile', name: 'Floor tiles', unit: 'sqft', type: 'area', rate: 20 };

test('entry validation words errors for the form', () => {
  assert.deepEqual(validateEntry({}, undefined), ['Choose a work item.']);
  assert.deepEqual(validateEntry({ count: '1', length: '10.0', width: '' }, tileRate), ['Width is required.']);
  assert.deepEqual(validateEntry({ count: '1', length: '10.13', width: '5.0' }, tileRate), ['Length: Inches must be from 0 to 11.']);
  assert.deepEqual(validateEntry({ count: '0', length: '10.0', width: '0' }, tileRate), [
    'Quantity must be greater than zero.',
    'Width must be greater than zero.'
  ]);
});

test('optional width on "length (width noted)" items is only format-checked', () => {
  const rate = { ...tileRate, type: 'lenw' };
  assert.deepEqual(validateEntry({ count: '1', length: '10.0', width: '' }, rate), []);
  assert.equal(validateEntry({ count: '1', length: '10.0', width: 'abc' }, rate).length, 1);
});

test('direct quantity items validate the quantity, not the count', () => {
  const rate = { ...tileRate, type: 'direct' };
  assert.deepEqual(validateEntry({ count: '0', quantity: '4' }, rate), []);
  assert.deepEqual(validateEntry({ count: '1', quantity: '0' }, rate), ['Quantity must be greater than zero.']);
});

test('amount errors are keyed by field', () => {
  const bill = {
    discount: '5000',
    taxRate: '120',
    advance: '-1',
    sections: [{ areas: [{ items: [{ rateId: 'tile', length: '10.0', width: '10.0', count: 1 }] }] }]
  };
  assert.deepEqual(getAmountErrors(bill, [tileRate]), {
    discount: 'Discount cannot exceed the subtotal.',
    taxRate: 'GST must be between 0 and 100%.',
    advance: 'Advance must be zero or greater.'
  });
});

test('export errors include missing details and duplicate bill numbers', () => {
  const bill = { id: 'a', number: '7', projectName: '', client: '', sections: [] };
  const bills = [bill, { id: 'b', number: ' 7 ' }];
  assert.equal(isBillNumberTaken(bills, bill), true);
  const errors = getExportErrors({ bill, bills, rates: [], firm: { name: '' } });
  assert.deepEqual(errors, [
    'Add at least one work item before exporting a bill.',
    'Bill number is already used by another bill.',
    'Enter a project or site name in Project details.',
    'Enter a client name in Project details.',
    'Enter your firm name in Project details.'
  ]);
});

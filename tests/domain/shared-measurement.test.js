import test from 'node:test';
import assert from 'node:assert/strict';
import { updateItem, removeItem } from '../../src/domain/bill-tree.js';
import { cloneItems } from '../../src/domain/factories.js';
import { getItemQuantity } from '../../src/domain/calculations.js';

const rate = (type, unit) => ({ type, unit, rate: 10 });
const door = { id: 'd', name: 'Granite door', type: 'area', unit: 'sqft', count: '2', length: '24.6', width: '12.6', height: '', quantity: 0 };
const polish = { id: 'p', name: 'Dhar polish', type: 'length', unit: 'rft', linkedTo: 'd', count: '2', length: '24.6', width: '12.6', height: '', quantity: 0 };
const bill = () => ({ sections: [{ id: 's', areas: [{ id: 'a', items: [{ ...door }, { ...polish }, { id: 'x', name: 'Other', count: '1', length: '5.0' }] }] }] });
const items = (b) => b.sections[0].areas[0].items;

test('correcting the measurement of an entry corrects the works that share it', () => {
  const next = updateItem(bill(), 's', 'a', 'd', { length: '30.0', count: '3' });
  const [d, p, x] = items(next);
  assert.equal(d.length, '30.0');
  assert.deepEqual([p.length, p.count, p.width], ['30.0', '3', '12.6']);
  assert.equal(p.linkedTo, 'd');
  assert.equal(x.length, '5.0'); // another entry is untouched
  assert.equal(getItemQuantity(p, rate('length', 'rft')), 90); // 30 ft × 3 nos
});

test('changing a linked entry itself (its note, its way of measuring) does not touch the entry it follows', () => {
  const next = updateItem(bill(), 's', 'a', 'p', { note: 'edge', calc: 'perimeter' });
  assert.equal(items(next)[0].length, '24.6');
  assert.equal(items(next)[1].calc, 'perimeter');
});

test('removing the entry that was measured keeps its numbers on the works that shared it', () => {
  const next = removeItem(bill(), 's', 'a', 'd');
  const [p] = items(next);
  assert.equal(p.linkedTo, undefined);
  assert.equal(p.length, '24.6');
});

test('copying an area keeps the sharing inside the copy; a copy of one linked entry on its own stands alone', () => {
  const copies = cloneItems(items(bill()));
  assert.equal(copies[1].linkedTo, copies[0].id);
  assert.notEqual(copies[0].id, 'd');
  assert.equal(cloneItems([items(bill())[1]])[0].linkedTo, undefined);
});

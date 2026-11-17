import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyTemplate,
  copyAreaToSection,
  copyItemToSection,
  createTemplateContent,
  removeItem,
  updateItem
} from '../../src/domain/bill-tree.js';
import { duplicateBill, getNextBillNumber } from '../../src/domain/factories.js';

function sampleBill() {
  return {
    id: 'bill',
    number: '3',
    projectName: 'Villa',
    sections: [
      {
        id: 's1',
        name: 'Ground floor',
        areas: [{ id: 'a1', name: 'Kitchen', items: [{ id: 'i1', name: 'Tiles', rateId: 'tile', count: 1 }] }]
      },
      { id: 's2', name: 'First floor', areas: [{ id: 'a2', name: ' kitchen ', items: [] }] },
      { id: 's3', name: 'Roof', areas: [] }
    ]
  };
}

test('updates and removes items without mutating the original bill', () => {
  const bill = sampleBill();
  const updated = updateItem(bill, 's1', 'a1', 'i1', { count: 4 });
  assert.equal(updated.sections[0].areas[0].items[0].count, 4);
  assert.equal(bill.sections[0].areas[0].items[0].count, 1);
  assert.equal(removeItem(bill, 's1', 'a1', 'i1').sections[0].areas[0].items.length, 0);
});

test('copying an area merges into a same-named area in the target section', () => {
  const bill = sampleBill();
  const operation = copyAreaToSection(bill, 's1', 'a1', 's2');
  const next = operation.apply(bill);
  const target = next.sections[1].areas[0];
  assert.equal(target.items.length, 1);
  assert.notEqual(target.items[0].id, 'i1');
  assert.deepEqual(operation.result.areaIds, ['a2']);
  assert.match(operation.result.message, /entries into First floor/);
});

test('copying an item into a section without a matching area creates one', () => {
  const bill = sampleBill();
  const operation = copyItemToSection(bill, 's1', 'a1', 'i1', 's3');
  const next = operation.apply(bill);
  assert.equal(next.sections[2].areas.length, 1);
  assert.equal(next.sections[2].areas[0].name, 'Kitchen');
  assert.equal(copyItemToSection(bill, 's1', 'a1', 'i1', 's1'), null);
});

test('templates round-trip through content with fresh ids', () => {
  const bill = sampleBill();
  const content = createTemplateContent(bill, 'section', 's1');
  assert.equal(content.areas[0].items[0].id, undefined);

  const operation = applyTemplate(bill, { name: 'Std', type: 'section', content });
  const next = operation.apply(bill);
  const added = next.sections.at(-1);
  assert.equal(added.name, 'Ground floor');
  assert.ok(added.areas[0].items[0].id);
  assert.equal(applyTemplate(bill, { name: 'Area', type: 'area', content: { items: [] } }, 'missing'), null);
});

test('duplicating a bill assigns a new number and new ids throughout', () => {
  const bill = sampleBill();
  const copy = duplicateBill(bill, getNextBillNumber([bill, { number: '12' }]));
  assert.equal(copy.number, '13');
  assert.equal(copy.projectName, 'Villa (copy)');
  assert.notEqual(copy.id, bill.id);
  assert.notEqual(copy.sections[0].areas[0].items[0].id, 'i1');
  assert.equal(bill.sections[0].id, 's1');
});

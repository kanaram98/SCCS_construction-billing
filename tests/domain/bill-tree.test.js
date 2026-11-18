import test from 'node:test';
import assert from 'node:assert/strict';
import {
  applyTemplate,
  copyAreaToSection,
  copyAreasToSections,
  copyItemToSection,
  duplicateArea,
  duplicateSection,
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

test('moves sections, areas and items up and down, ignoring moves past the ends', async () => {
  const { moveSection, moveArea, moveItem, moveById } = await import('../../src/domain/bill-tree.js');
  const bill = sampleBill();
  assert.deepEqual(moveSection(bill, 's3', -1).sections.map((s) => s.id), ['s1', 's3', 's2']);
  assert.equal(moveSection(bill, 's1', -1).sections, bill.sections);
  const withAreas = { ...bill, sections: [{ ...bill.sections[0], areas: [{ id: 'x', items: [] }, { id: 'y', items: [] }] }] };
  assert.deepEqual(moveArea(withAreas, 's1', 'x', 1).sections[0].areas.map((a) => a.id), ['y', 'x']);
  const withItems = { ...bill, sections: [{ id: 's1', areas: [{ id: 'a1', items: [{ id: 'p' }, { id: 'q' }, { id: 'r' }] }] }] };
  assert.deepEqual(moveItem(withItems, 's1', 'a1', 'r', -1).sections[0].areas[0].items.map((i) => i.id), ['p', 'r', 'q']);
  assert.deepEqual(moveById([{ id: 1 }], 99, 1), [{ id: 1 }]);
});

function twoRooms() {
  return {
    id: 'bill',
    sections: [
      { id: 's1', name: 'Floor 1', areas: [
        { id: 'a1', name: 'Bedroom 1', items: [{ id: 'i1', name: 'Tiles', rateId: 'tile', count: 1 }, { id: 'i2', name: 'Skirting', rateId: 'skirt', count: 1 }] },
        { id: 'a2', name: 'Hall', items: [{ id: 'i3', name: 'Tiles', rateId: 'tile', count: 1 }] }
      ] },
      { id: 's2', name: 'Floor 2', areas: [{ id: 'a3', name: 'Hall', items: [] }] },
      { id: 's3', name: 'Floor 3', areas: [] }
    ]
  };
}

test('duplicating a room puts a renamed copy with fresh ids right after it', () => {
  const bill = twoRooms();
  const copy = duplicateArea(bill, 's1', 'a1');
  const next = copy.apply(bill);
  const areas = next.sections[0].areas;
  assert.deepEqual(areas.map((area) => area.name), ['Bedroom 1', 'Bedroom 1 (copy)', 'Hall']);
  assert.equal(areas[1].items.length, 2);
  assert.notEqual(areas[1].id, 'a1');
  assert.notEqual(areas[1].items[0].id, 'i1');
  assert.equal(areas[1].items[0].rateId, 'tile'); // still linked to the same rate
  assert.equal(copy.result.areaId, areas[1].id);
  assert.equal(duplicateArea(bill, 's1', 'missing'), null);
});

test('duplicating a floor copies its rooms and entries right after it', () => {
  const bill = twoRooms();
  const copy = duplicateSection(bill, 's1');
  const next = copy.apply(bill);
  assert.deepEqual(next.sections.map((section) => section.name), ['Floor 1', 'Floor 1 (copy)', 'Floor 2', 'Floor 3']);
  const made = next.sections[1];
  assert.deepEqual(made.areas.map((area) => area.name), ['Bedroom 1', 'Hall']);
  assert.equal(made.areas[0].items.length, 2);
  assert.notEqual(made.id, 's1');
  assert.notEqual(made.areas[0].id, 'a1');
  assert.equal(copy.result.sectionId, made.id);
  assert.equal(next.sections[0].areas[0].items.length, 2); // the original is untouched
});

test('several rooms go into several floors at once, merging into a same-named room', () => {
  const bill = twoRooms();
  const op = copyAreasToSections(bill, 's1', ['a1', 'a2'], ['s2', 's3', 's1']); // copying into its own floor is ignored
  const next = op.apply(bill);
  const floor2 = next.sections[1];
  assert.deepEqual(floor2.areas.map((area) => area.name), ['Hall', 'Bedroom 1']);
  assert.equal(floor2.areas[0].items.length, 1); // Hall merged into the existing Hall
  assert.equal(floor2.areas[1].items.length, 2);
  const floor3 = next.sections[2];
  assert.deepEqual(floor3.areas.map((area) => area.name), ['Bedroom 1', 'Hall']);
  assert.equal(next.sections[0].areas.length, 2); // the source floor is unchanged
  assert.equal(op.result.count, 4);
  assert.equal(copyAreasToSections(bill, 's1', [], ['s2']), null);
  assert.equal(copyAreasToSections(bill, 's1', ['a1'], ['s1']), null);
});

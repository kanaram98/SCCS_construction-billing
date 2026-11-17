import test from 'node:test';
import assert from 'node:assert/strict';
import { relabelGeneratedNames } from '../../src/domain/relabel.js';

const hindiBill = {
  projectName: 'नमूना: 2BHK फ़्लैट (इसे हटा सकते हैं)',
  client: 'नमूना ग्राहक',
  sections: [
    { name: 'ग्राउंड फ़्लोर', areas: [{ name: 'हॉल', items: [{ note: 'विट्रिफ़ाइड 2×2' }, { note: 'मेरा नोट' }] }] },
    { name: 'मंज़िल 3', areas: [{ name: 'क्षेत्र 2', items: [] }] },
    { name: 'शर्मा जी का घर', areas: [] }
  ]
};

test('generated Hindi names switch to English; typed names stay', () => {
  const [bill] = relabelGeneratedNames([hindiBill], 'hi', 'en');
  assert.equal(bill.projectName, 'Sample: 2BHK flat (you can delete this)');
  assert.equal(bill.client, 'Sample client');
  assert.deepEqual(bill.sections.map((s) => s.name), ['Ground floor', 'Floor 3', 'शर्मा जी का घर']);
  assert.equal(bill.sections[0].areas[0].name, 'Hall');
  assert.equal(bill.sections[1].areas[0].name, 'Area 2');
  assert.deepEqual(bill.sections[0].areas[0].items.map((i) => i.note), ['Vitrified 2×2', 'मेरा नोट']);
});

test('converts back to Hindi and leaves same-language switches alone', () => {
  const [english] = relabelGeneratedNames([hindiBill], 'hi', 'en');
  const [hindi] = relabelGeneratedNames([english], 'en', 'hi');
  assert.deepEqual(hindi.sections.map((s) => s.name), hindiBill.sections.map((s) => s.name));
  const same = [hindiBill];
  assert.equal(relabelGeneratedNames(same, 'hi', 'hi'), same);
});

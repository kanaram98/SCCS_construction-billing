import test from 'node:test';
import assert from 'node:assert/strict';
import { countSearchResults, searchEntries } from '../../src/domain/entry-search.js';

const rates = [{ id: 'tile', name: 'Floor tiles', unit: 'sqft', type: 'area', rate: 1 }, { id: 'gas', name: 'Gas hole', unit: 'nos', type: 'count', rate: 1 }];
const sections = [
  { id: 's1', name: 'Ground floor', areas: [
    { id: 'a1', name: 'Hall', items: [{ id: 'i1', rateId: 'tile', length: '12.6', width: '10.0', note: 'Vitrified' }, { id: 'i2', rateId: 'gas' }] },
    { id: 'a2', name: 'Kitchen', items: [{ id: 'i3', rateId: 'gas' }] }
  ] },
  { id: 's2', name: 'Terrace', areas: [{ id: 'a3', name: 'Deck', items: [{ id: 'i4', rateId: 'tile' }] }] }
];
const ids = (results) => results.map(({ section, areas }) => `${section.id}:${areas.map(({ area, items }) => `${area.id}[${items.map((i) => i.id)}]`)}`);

test('blank query shows everything', () => {
  assert.equal(searchEntries(sections, rates, '  '), null);
});

test('matches entries by work item, note and measurement', () => {
  assert.deepEqual(ids(searchEntries(sections, rates, 'gas')), ['s1:a1[i2],a2[i3]']);
  assert.deepEqual(ids(searchEntries(sections, rates, 'VITRI')), ['s1:a1[i1]']);
  assert.deepEqual(ids(searchEntries(sections, rates, `12'6"`)), ['s1:a1[i1]']);
  assert.equal(countSearchResults(searchEntries(sections, rates, 'tiles')), 2);
});

test('a matching section or area name keeps all of its entries', () => {
  assert.deepEqual(ids(searchEntries(sections, rates, 'terrace')), ['s2:a3[i4]']);
  assert.deepEqual(ids(searchEntries(sections, rates, 'kitchen')), ['s1:a2[i3]']);
  assert.deepEqual(searchEntries(sections, rates, 'zzz'), []);
});

/**
 * A small example bill for first-time users to explore: two floors, a few
 * rooms and entries using the default work items. Names follow the app language.
 */
import { createArea, createBill, createItem, createSection } from './factories.js';
import { tr } from '../i18n/translate.js';

export function createSampleBill(number, rates, { gstEnabled = false } = {}) {
  const rate = (id) => rates.find((entry) => entry.id === id) || rates[0];
  const item = (id, values) => createItem(rate(id), values);
  return {
    ...createBill(number, { gstEnabled }),
    projectName: tr('Sample: 2BHK flat (you can delete this)'),
    client: tr('Sample client'),
    firstLevelName: 'Floor',
    secondLevelName: 'Room',
    advance: '5000',
    isSample: true,
    sections: [
      createSection(tr('Ground floor'), [
        createArea(tr('Hall'), [
          item('floor-tiles', { length: '14.6', width: '12.0', count: 1, note: tr('Vitrified 2×2') }),
          item('skirting', { length: '14.6', count: 2 })
        ]),
        createArea(tr('Kitchen'), [
          item('floor-tiles', { length: '10.0', width: '8.0', count: 1 }),
          item('gas-hole', { count: 1 })
        ])
      ]),
      createSection(tr('First floor'), [
        createArea(tr('Bedroom'), [
          item('floor-tiles', { length: '12.0', width: '11.6', count: 1 })
        ])
      ])
    ]
  };
}

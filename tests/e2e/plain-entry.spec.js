/**
 * Paper-first entry at phone size: open a room's entry sheet, type rows straight down with the
 * keyboard's Enter/Next, and check each row is saved and the room total is right.
 */
import { expect, test } from '@playwright/test';

const goTo = async (page, name) => {
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name }).click();
};

test('entry sheet: type rows down the page with Enter', async ({ page }) => {
  await page.addInitScript(() => {
    if (!window.localStorage.getItem('construction_billing_react_v1')) {
      window.localStorage.setItem('construction_billing_react_v1', JSON.stringify({
        bills: [{ id: 'b', number: '1', date: '2026-11-01', projectId: '', projectName: 'Site', client: 'C', sections: [{ id: 's', name: 'Ground floor', areas: [{ id: 'a', name: 'Hall', items: [] }] }] }],
        activeBillId: 'b', meta: { onboarded: true, lastBackupAt: '' }
      }));
    }
  });
  await page.goto('/');
  await goTo(page, 'Entry');
  await page.getByRole('button', { name: 'Add entry' }).first().click();
  const dialog = page.getByRole('dialog');

  await expect(page.locator('[data-sheet-input="item"]:focus')).toBeVisible(); // the cursor starts in the first empty row
  // Row 1: floor tiles 12.6 x 10 -> cursor starts in the work item of the first empty row
  await page.keyboard.type('floor');
  await page.keyboard.press('Enter'); // choose the highlighted work item
  await expect(page.locator('[data-sheet-input="length"]:focus')).toBeVisible(); // the cursor is on the measurement
  await page.keyboard.type('12.6');
  await page.keyboard.press('Enter');
  await page.keyboard.type('10');
  await page.keyboard.press('Enter'); // end of the row: saved, new row
  await expect(dialog.getByText('₹10,625').first()).toBeVisible(); // 12'6" x 10' = 125 sqft x Rs 85
  await page.screenshot({ path: 'test-results/screens/9-entry-sheet.png' });
  await page.getByRole('button', { name: 'Done' }).click();
  await expect(page.getByRole('dialog')).toHaveCount(0);
  const saved = await page.evaluate(() => JSON.parse(window.localStorage.getItem('construction_billing_react_v1')).bills[0].sections[0].areas[0].items);
  expect(saved).toHaveLength(1);
});

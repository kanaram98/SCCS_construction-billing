/**
 * The full app without cloud sign-in (phone size): a project, an advance, daily
 * expenses, and the PDF and Excel (CSV) exports.
 */
import fs from 'node:fs';
import { expect, test } from '@playwright/test';

const goTo = async (page, name) => {
  await page.getByRole('button', { name: 'Menu' }).click();
  await page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name }).click();
};

test('daily expenses table with PDF and Excel export', async ({ page }) => {
  await page.addInitScript(() => {
    if (!window.localStorage.getItem('construction_billing_react_v1')) {
      window.localStorage.setItem('construction_billing_react_v1', JSON.stringify({
        bills: [{ id: 'b', number: '1', date: '2026-11-01', projectName: 'Site', client: 'C', sections: [] }],
        activeBillId: 'b', meta: { onboarded: true, lastBackupAt: '' }
      }));
    }
  });
  await page.goto('/');

  await goTo(page, 'Projects');
  await page.getByRole('button', { name: 'Add project' }).click();
  await page.getByRole('dialog').getByLabel(/Project \/ site name/).fill('Sharma house');
  await page.getByRole('dialog').getByLabel(/Client name/).fill('Sharma ji');
  await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
  await expect(page.getByRole('heading', { name: 'Sharma house' })).toBeVisible();

  await page.getByRole('button', { name: 'Add advance' }).click();
  await page.getByRole('dialog').getByLabel(/Amount/).fill('50000');
  await page.getByRole('dialog').getByRole('button', { name: 'Save' }).click();
  await expect(page.getByText('Received from the client: ₹50,000')).toBeVisible();

  await goTo(page, 'Expenses');
  for (const [amount, note] of [['250', 'Tea and lunch'], ['400', 'Auto to site']]) {
    await page.getByRole('button', { name: 'Add expense' }).click();
    const dialog = page.getByRole('dialog');
    await dialog.getByLabel(/Amount/).fill(amount);
    await dialog.getByLabel(/Note/).fill(note);
    if (note.startsWith('Auto')) await dialog.getByRole('button', { name: 'Travel' }).click();
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(dialog).toHaveCount(0);
  }
  // Calendar tile for today shows the short amount (650 = green), the Table lists the rows.
  await expect(page.getByRole('button', { name: /: ₹650$/ })).toContainText('650');
  await page.getByRole('button', { name: 'Table' }).click();
  await expect(page.getByText('Tea and lunch').first()).toBeVisible();
  await page.getByRole('button', { name: 'PDF preview' }).click();
  await expect(page.locator('.expense-document').first()).toBeVisible();
  await expect(page.locator('.expense-document').first()).toContainText('Tea and lunch');
  await expect(page.getByText('₹650').first()).toBeVisible(); // the day total
  await page.screenshot({ path: 'test-results/screens/8-expenses.png' });

  const pdf = page.waitForEvent('download');
  await page.getByRole('button', { name: 'PDF', exact: true }).click();
  const pdfPath = await (await pdf).path();
  const pdfText = fs.readFileSync(pdfPath, 'latin1');
  expect(pdfText).toContain('DAILY SITE EXPENSES'); // the letterhead prints the title in capitals
  expect(pdfText).toContain('Tea and lunch');
  expect(pdfText).toContain('Day total');
  expect(pdfText).toContain('Rs. 650');

  const csv = page.waitForEvent('download');
  await page.getByRole('button', { name: 'Excel (CSV)' }).click();
  const download = await csv;
  expect(download.suggestedFilename()).toMatch(/^Expenses-All_projects-\d{4}-\d{2}\.csv$/);
  const csvText = fs.readFileSync(await download.path(), 'utf8');
  expect(csvText.startsWith('﻿Date,Project,Category,Note,Amount')).toBe(true);
  expect(csvText).toContain('Sharma house,Food & tea,Tea and lunch,250');
  expect(csvText).toContain('Sharma house,Travel,Auto to site,400');
  expect(csvText).toContain('Total,,,,650');
});

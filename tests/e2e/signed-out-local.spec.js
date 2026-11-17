/**
 * A phone that has never signed in shows only the sign-in screen, even if
 * it has data of its own (that data is kept and uploaded at the first sign-in).
 */
import { expect, test } from '@playwright/test';

const STATE_KEY = 'construction_billing_react_v1';

function localState() {
  const bill = { id: 'b1', number: '1', date: '2026-11-01', projectName: 'My site', client: 'Client', sections: [] };
  return {
    bills: [bill],
    activeBillId: 'b1',
    meta: { onboarded: true, lastBackupAt: '' },
    labour: {
      workers: [{ id: 'w1', name: 'Ramesh', dailyWage: 700, role: '', phone: '', active: true }],
      attendance: { [`${new Date().toISOString().slice(0, 7)}-02`]: { w1: { units: 2, wage: 700, at: '' } } },
      payments: []
    }
  };
}

test('never signed in on this phone: only sign-in, and Settings opens', async ({ page }) => {
  await page.addInitScript(([key, state]) => {
    if (!window.localStorage.getItem(key)) window.localStorage.setItem(key, JSON.stringify(state));
  }, [STATE_KEY, localState()]);
  await page.goto('/');
  await expect(page.getByText('Sign in with Google to open the app.')).toBeVisible();
  await expect(page.getByRole('button', { name: 'Labour' })).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Bills' })).toHaveCount(0);
  await page.getByRole('button', { name: 'App settings' }).click();
  await expect(page.getByRole('button', { name: 'Sign in with Google' })).toBeVisible();
  await page.getByRole('button', { name: 'Settings', exact: true }).click(); // the banner's button works too
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
});

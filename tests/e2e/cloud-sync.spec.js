/**
 * Real browser, real app, Firebase emulators: you (admin) and your father
 * (contractor) on two separate phones.
 *
 * Runs against the test-only emulators started by playwright.config.js
 * (never the ones you develop with); each run starts from empty data.
 */
import { expect, test } from '@playwright/test';

const PROJECT = 'demo-sccs';
const ADMIN = { email: 'admin@example.com', name: 'Admin' };
const FATHER = { email: 'father@example.com', name: 'Papa' };
const SYNCED = 'Synced. Your data is safe in the cloud.';
const OWNER = { Authorization: 'Bearer owner' };

async function resetEmulators(request) {
  await request.delete(`http://127.0.0.1:8180/emulator/v1/projects/${PROJECT}/databases/(default)/documents`);
  await request.delete(`http://127.0.0.1:9199/emulator/v1/projects/${PROJECT}/accounts`, { headers: OWNER });
  // You may create the workspace (the one-time console step).
  const created = await request.post(
    `http://127.0.0.1:8180/v1/projects/${PROJECT}/databases/(default)/documents/owners?documentId=${encodeURIComponent(ADMIN.email)}`,
    { headers: OWNER, data: { fields: {} } }
  );
  expect(created.ok()).toBeTruthy();
}

/** A tab in the bottom navigation bar. */
const nav = (page, name) => page.getByRole('navigation', { name: 'Main navigation' }).getByRole('button', { name });

async function openSettings(page) {
  await page.getByRole('button', { name: 'App settings' }).click();
  await expect(page.getByRole('heading', { name: 'Settings' })).toBeVisible();
}

/** Signs in through the emulator's Google sign-in page. */
async function signIn(page, person) {
  const popupPromise = page.waitForEvent('popup', { timeout: 15000 });
  await page.getByRole('button', { name: 'Sign in with Google' }).click();
  const popup = await popupPromise;
  await popup.waitForLoadState('networkidle');
  const existing = popup.getByText(person.email);
  if (await existing.count()) {
    await existing.first().click();
    return;
  }
  const email = popup.locator('#email-input');
  // The page's buttons work once its script has started; retry the click until the form opens.
  await expect(async () => {
    await popup.getByRole('button', { name: /add new account/i }).click({ timeout: 2000 });
    await expect(email).toBeVisible({ timeout: 2000 });
  }).toPass({ timeout: 15000 });
  await email.fill(person.email);
  await popup.locator('#display-name-input').fill(person.name);
  await popup.locator('#sign-in').click();
}

test('admin creates the workspace, invites the father, and changes sync both ways', async ({ browser, request }) => {
  await resetEmulators(request);

  // ── You: sample data, sign in, become admin, invite your father ──
  const adminContext = await browser.newContext();
  const admin = await adminContext.newPage();
  await admin.goto('/');
  // A phone that never signed in shows only sign-in: no tabs, no bills, no labour.
  await expect(admin.getByText('Sign in with Google to open the app.')).toBeVisible();
  await expect(admin.getByRole('button', { name: 'Labour' })).toHaveCount(0);
  await expect(admin.getByRole('button', { name: 'Bills' })).toHaveCount(0);
  await openSettings(admin);
  await signIn(admin, ADMIN);
  await expect(admin.getByText('Workspace created. You are the admin.')).toBeVisible();
  await admin.getByRole('button', { name: 'See a sample bill' }).click();
  await openSettings(admin);
  await expect(admin.getByText(SYNCED)).toBeVisible({ timeout: 20000 });
  await expect(admin.getByText('Admin', { exact: true }).first()).toBeVisible();
  await admin.getByLabel('Google account (Gmail)').fill(FATHER.email);
  await admin.getByRole('button', { name: 'Invite', exact: true }).click();
  await expect(admin.getByText('Invited as Contractor · not joined yet')).toBeVisible();
  await admin.screenshot({ path: 'test-results/screens/1-admin-settings.png' });

  // ── Your father: new phone, signs in, gets the shared data ──
  const fatherContext = await browser.newContext();
  const father = await fatherContext.newPage();
  await father.goto('/');
  await openSettings(father);
  await signIn(father, FATHER);
  await expect(father.getByText('You joined the workspace.')).toBeVisible();
  await expect(father.getByText(SYNCED)).toBeVisible({ timeout: 20000 });
  await expect(father.getByText('Contractor', { exact: true }).first()).toBeVisible();
  await expect(father.getByText('People')).toHaveCount(0); // members are admin-only
  await nav(father, 'Bills').click();
  await expect(father.getByText(/Sample: 2BHK flat/).first()).toBeVisible();
  await father.getByText(/Sample: 2BHK flat/).first().click(); // the open bill is per phone

  // Rates: he can add, not change.
  await nav(father, 'Rates').click();
  await expect(father.getByText('You can add rates. Only the admin can change or delete them.')).toBeVisible();
  await expect(father.getByRole('button', { name: /^Actions for / })).toHaveCount(0);
  await expect(father.getByRole('button', { name: 'Add item' })).toBeVisible();

  // Firm details are read-only for him.
  await nav(father, 'Project').click();
  await expect(father.getByText('Only the admin can change these details.')).toBeVisible();
  await expect(father.getByLabel(/Firm name/)).toBeDisabled();
  await father.screenshot({ path: 'test-results/screens/2-father-project.png' });

  // ── He edits the bill; it arrives on your phone ──
  const project = father.getByLabel(/Project \/ site/);
  await project.fill('Sharma house');
  await nav(admin, 'Project').click();
  await expect(admin.getByLabel(/Project \/ site/)).toHaveValue('Sharma house', { timeout: 20000 });

  // ── You change the firm name; it arrives on his phone ──
  await admin.getByLabel(/Firm name/).fill('SCCS Builders');
  await expect(father.getByLabel(/Firm name/)).toHaveValue('SCCS Builders', { timeout: 20000 });

  // ── History on your phone shows his change, with his name ──
  await openSettings(admin);
  await admin.getByRole('button', { name: 'Open history' }).click();
  const history = admin.getByRole('dialog');
  await expect(history.getByText(/· Papa/).first()).toBeVisible();
  await admin.screenshot({ path: 'test-results/screens/3-admin-history.png' });

  // ── Signed in, your father fills today's timesheet ──
  const addWorker = async (name, wage) => {
    await father.getByRole('tab', { name: 'Workers' }).click();
    await father.getByRole('button', { name: 'Add worker' }).click();
    const dialog = father.getByRole('dialog');
    await dialog.getByLabel(/Name/).fill(name);
    await dialog.getByLabel(/Daily wage/).fill(wage);
    await dialog.getByRole('button', { name: 'Save' }).click();
    await expect(dialog).toHaveCount(0);
  };
  await nav(father, 'Labour').click();
  await addWorker('Ramu', '650');
  await father.getByRole('tab', { name: 'Attendance' }).click();
  await father.getByRole('button', { name: /Mark today/ }).click();
  const sheet = father.getByRole('dialog');
  await sheet.getByRole('button', { name: 'Ramu 1P' }).click();
  await sheet.getByRole('button', { name: 'Done' }).click();

  // ── Workers: he can mark left but not edit/delete; an old day needs the admin ──
  await father.getByRole('tab', { name: 'Workers' }).click();
  await father.getByRole('button', { name: 'Actions for Ramu' }).click();
  await expect(father.getByRole('menuitem', { name: 'Mark as left' })).toBeVisible();
  await expect(father.getByRole('menuitem', { name: 'Pay / advance' })).toBeVisible();
  await expect(father.getByRole('menuitem', { name: 'Edit' })).toHaveCount(0);
  await expect(father.getByRole('menuitem', { name: 'Delete' })).toHaveCount(0);
  await father.keyboard.press('Escape');
  await father.getByRole('tab', { name: 'Attendance' }).click();
  const fiveDaysAgo = new Date(Date.now() - 5 * 24 * 60 * 60 * 1000);
  if (fiveDaysAgo.getMonth() !== new Date().getMonth()) await father.getByRole('button', { name: 'Previous month' }).click();
  const oldLabel = fiveDaysAgo.toLocaleDateString('en-IN', { weekday: 'short', day: 'numeric', month: 'short' });
  await father.getByRole('button', { name: new RegExp(`^${oldLabel}:`) }).click();
  await expect(father.getByText(/more than 2 days old. Only the admin can change it/)).toBeVisible();
  await expect(father.getByRole('button', { name: 'Ramu 1P' })).toBeDisabled();
  await father.getByRole('button', { name: 'Done' }).click();
  if (fiveDaysAgo.getMonth() !== new Date().getMonth()) await father.getByRole('button', { name: 'Next month' }).click();

  // ── He signs out (or is offline): his timesheet is still there, Labour only ──
  await openSettings(father);
  await expect(father.getByText(SYNCED)).toBeVisible({ timeout: 20000 }); // uploaded (else sign-out asks first)
  await father.getByRole('button', { name: 'Sign out' }).click();
  await expect(father.getByText(/Signed out: only Labour is available/)).toBeVisible();
  await expect(father.getByRole('button', { name: 'Bills' })).toHaveCount(0);
  await expect(father.getByRole('button', { name: 'Project' })).toHaveCount(0);
  await nav(father, 'Labour').click();
  await father.getByRole('button', { name: 'Ramu', exact: true }).click(); // his calendar
  await expect(father.getByRole('button', { name: /: 1P$/ }).first()).toBeVisible();
  await father.screenshot({ path: 'test-results/screens/4-father-signed-out-labour.png' });

  // ── More entries while signed out; they upload when he signs in again ──
  await addWorker('Shyam', '600');
  await openSettings(father);
  await signIn(father, FATHER);
  await expect(father.getByText(SYNCED)).toBeVisible({ timeout: 20000 });
  await expect(father.getByRole('button', { name: 'Bills' })).toBeVisible();
  await admin.getByRole('button', { name: 'Close' }).click();
  await nav(admin, 'Labour').click();
  await admin.getByRole('tab', { name: 'Workers' }).click();
  await expect(admin.getByText('Shyam').first()).toBeVisible({ timeout: 20000 });
  await expect(admin.getByText('Ramu').first()).toBeVisible();
  await admin.getByRole('tab', { name: 'Attendance' }).click();
  await admin.getByRole('button', { name: 'Ramu', exact: true }).click();
  await expect(admin.getByRole('button', { name: /: 1P$/ }).first()).toBeVisible();

  await adminContext.close();
  await fatherContext.close();
});

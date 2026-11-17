/**
 * Real browser, real app, Firebase emulators: you (admin) and your father
 * (contractor) on two separate phones.
 *
 * Needs the emulators running (`npm run emulators`). Each run wipes the
 * emulators' data first.
 */
import { expect, test } from '@playwright/test';

const PROJECT = 'demo-sccs';
const ADMIN = { email: 'admin@example.com', name: 'Admin' };
const FATHER = { email: 'father@example.com', name: 'Papa' };
const SYNCED = 'Synced. Your data is safe in the cloud.';
const OWNER = { Authorization: 'Bearer owner' };

async function resetEmulators(request) {
  await request.delete(`http://127.0.0.1:8080/emulator/v1/projects/${PROJECT}/databases/(default)/documents`);
  await request.delete(`http://127.0.0.1:9099/emulator/v1/projects/${PROJECT}/accounts`, { headers: OWNER });
  // You may create the workspace (the one-time console step).
  const created = await request.post(
    `http://127.0.0.1:8080/v1/projects/${PROJECT}/databases/(default)/documents/owners?documentId=${encodeURIComponent(ADMIN.email)}`,
    { headers: OWNER, data: { fields: {} } }
  );
  expect(created.ok()).toBeTruthy();
}

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
  // A phone that never signed in shows only sign-in: no tabs, no bills.
  await expect(admin.getByText('Sign in with Google to open the app.')).toBeVisible();
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
  await father.getByRole('button', { name: 'Bills' }).click();
  await expect(father.getByText(/Sample: 2BHK flat/).first()).toBeVisible();

  // Firm details are read-only for him.
  await father.getByRole('button', { name: 'Project' }).click();
  await expect(father.getByText('Only the admin can change these details.')).toBeVisible();
  await expect(father.getByLabel(/Firm name/)).toBeDisabled();
  await father.screenshot({ path: 'test-results/screens/2-father-project.png' });

  // ── He edits the bill; it arrives on your phone ──
  const project = father.getByLabel(/Project \/ site/);
  await project.fill('Sharma house');
  await admin.getByRole('button', { name: 'Project' }).click();
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

  // ── Signed out, your father can only use Labour; his entries upload when he signs in again ──
  await openSettings(father);
  await father.getByRole('button', { name: 'Sign out' }).click();
  await expect(father.getByText(/Signed out: only Labour is available/)).toBeVisible();
  await expect(father.getByRole('button', { name: 'Bills' })).toHaveCount(0);
  await expect(father.getByRole('button', { name: 'Project' })).toHaveCount(0);
  await father.getByRole('button', { name: 'Labour' }).click();
  await father.getByRole('tab', { name: 'Workers' }).click();
  await father.getByRole('button', { name: 'Add worker' }).click();
  const dialog = father.getByRole('dialog');
  await dialog.getByLabel(/Name/).fill('Ramu');
  await dialog.getByLabel(/Daily wage/).fill('650');
  await dialog.getByRole('button', { name: 'Save' }).click();
  await expect(father.getByText('Ramu').first()).toBeVisible();
  await father.screenshot({ path: 'test-results/screens/4-father-signed-out-labour.png' });

  await openSettings(father);
  await signIn(father, FATHER);
  await expect(father.getByText(SYNCED)).toBeVisible({ timeout: 20000 });
  await expect(father.getByRole('button', { name: 'Bills' })).toBeVisible();
  await admin.getByRole('button', { name: 'Close' }).click();
  await admin.getByRole('button', { name: 'Labour' }).click();
  await admin.getByRole('tab', { name: 'Workers' }).click();
  await expect(admin.getByText('Ramu').first()).toBeVisible({ timeout: 20000 });

  await adminContext.close();
  await fatherContext.close();
});

/**
 * Creates fake sign-in accounts in the TEST Firebase project only (never the live one):
 *
 *   node scripts/test-accounts.mjs
 *
 * Needs Email/Password sign-in switched on in the test project (Authentication > Sign-in method).
 * Accounts are created with a verified email (the server rules require it) through the Firebase CLI,
 * the password is random and saved in the untracked .env.staging, and a real sign-in is tried at the end.
 * Running it again resets the passwords.
 */
import { execFileSync } from 'node:child_process';
import crypto from 'node:crypto';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';

const ENV_FILE = '.env.staging';
const ACCOUNTS = [
  { email: 'admin.test@example.com', name: 'Test Admin' },
  { email: 'contractor.test@example.com', name: 'Test Contractor' }
];
const ROUNDS = 100000;

const env = fs.existsSync(ENV_FILE) ? fs.readFileSync(ENV_FILE, 'utf8') : '';
const value = (key) => (env.match(new RegExp(`^${key}=(.*)$`, 'm')) || [, ''])[1].trim();
const projectId = value('VITE_FIREBASE_PROJECT_ID');
const apiKey = value('VITE_FIREBASE_API_KEY');
if (!projectId || !apiKey) { console.error(`${ENV_FILE} has no test project settings.`); process.exit(1); }
if (!projectId.includes('test')) { console.error(`Refusing: "${projectId}" does not look like the test project.`); process.exit(1); }

const password = `T-${crypto.randomBytes(9).toString('base64url')}`;
const users = ACCOUNTS.map(({ email, name }) => {
  const salt = crypto.randomBytes(16);
  return {
    localId: crypto.createHash('sha1').update(email).digest('hex').slice(0, 28),
    email, displayName: name, emailVerified: true,
    passwordHash: crypto.pbkdf2Sync(password, salt, ROUNDS, 32, 'sha256').toString('base64'),
    salt: salt.toString('base64')
  };
});

const file = path.join(os.tmpdir(), `test-users-${process.pid}.json`);
fs.writeFileSync(file, JSON.stringify({ users }));
try {
  execFileSync('npx', ['firebase', 'auth:import', file, '--hash-algo=PBKDF2_SHA256', `--rounds=${ROUNDS}`, '--project', projectId], { stdio: 'inherit', shell: true });
} finally {
  fs.rmSync(file, { force: true });
}

// Prove one of them can really sign in.
const response = await fetch(`https://identitytoolkit.googleapis.com/v1/accounts:signInWithPassword?key=${apiKey}`, {
  method: 'POST', headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ email: ACCOUNTS[0].email, password, returnSecureToken: false })
});
const body = await response.json();
if (!response.ok) {
  console.error('Accounts were imported but a test sign-in failed:', body?.error?.message || response.status);
  console.error('Check that Email/Password sign-in is enabled in the test project.');
  process.exit(1);
}

// Remember the password (untracked file) and let the test admin create the test workspace.
let next = env.replace(/^TEST_PASSWORD=.*\n?/m, '');
const owners = value('OWNER_EMAILS').split(',').map((item) => item.trim()).filter(Boolean);
if (!owners.includes(ACCOUNTS[0].email)) owners.push(ACCOUNTS[0].email);
next = next.replace(/^OWNER_EMAILS=.*$/m, `OWNER_EMAILS=${owners.join(',')}`);
next = `${next.trimEnd()}\nTEST_PASSWORD=${password}\n`;
fs.writeFileSync(ENV_FILE, next);

console.log('\nTest accounts ready (same password for both, saved in .env.staging):');
for (const { email, name } of ACCOUNTS) console.log(`  ${name}: ${email}`);
console.log(`  Password: ${password}`);
console.log('\nNext: npm run deploy:test (adds the test admin as an owner), then sign in at the test address.');

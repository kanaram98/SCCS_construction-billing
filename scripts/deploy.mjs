/**
 * Release flow:  your PC  →  TEST  →  LIVE.
 *
 *   npm run deploy:test     tests, builds with .env.staging, publishes to the test Firebase project
 *   npm run deploy:live     publishes to the real project, but only the exact version that was tried on test
 *
 * Settings are read from .env.staging (test) and .env.production (live). Neither is committed.
 * The test deploy records which commit it published; the live deploy refuses anything else
 * (an untried version, or uncommitted edits). `--force-untested` overrides that, for emergencies only.
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import { buildRules, parseEmails } from './rules.mjs';

const TARGETS = {
  test: { envFile: '.env.staging', mode: 'staging', project: 'test', label: 'TEST' },
  live: { envFile: '.env.production', mode: 'production', project: 'live', label: 'LIVE' }
};
const MARKER = '.firebase-rules/tested.json';

function readEnv(file) {
  if (!fs.existsSync(file)) return {};
  const entries = fs.readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .filter((line) => line.includes('=') && !line.trim().startsWith('#'))
    .map((line) => [line.slice(0, line.indexOf('=')).trim(), line.slice(line.indexOf('=') + 1).trim()]);
  return Object.fromEntries(entries);
}

const run = (command) => execSync(command, { stdio: 'inherit' });
const out = (command) => execSync(command, { encoding: 'utf8' }).trim();
const fail = (message) => { console.error(`\n${message}\n`); process.exit(1); };

const name = process.argv[2];
const target = TARGETS[name];
if (!target) fail('Say where to deploy:  node scripts/deploy.mjs test   or   node scripts/deploy.mjs live');
if (!fs.existsSync(target.envFile)) fail(`${target.envFile} is missing. Copy ${target.envFile}.example (or .env.production.example) and fill it in.`);

const commit = out('git rev-parse HEAD');
const dirty = out('git status --porcelain').length > 0;

if (name === 'live' && !process.argv.includes('--force-untested')) {
  const tested = fs.existsSync(MARKER) ? JSON.parse(fs.readFileSync(MARKER, 'utf8')) : null;
  if (dirty) fail('There are uncommitted changes. Commit them, deploy to test, try it, then deploy live.');
  if (!tested || tested.dirty || tested.commit !== commit) {
    fail('This version has not been published to TEST yet.\nRun  npm run deploy:test , try it on your phone, then run  npm run deploy:live .');
  }
  console.log(`Publishing the version tried on test (${commit.slice(0, 7)}, tested ${tested.at}).`);
}

const emails = parseEmails(readEnv(target.envFile).OWNER_EMAILS);
if (!emails.length) console.warn('OWNER_EMAILS is empty: only accounts in the owners collection can create the workspace.');

fs.mkdirSync('.firebase-rules', { recursive: true });
fs.writeFileSync('.firebase-rules/firestore.rules', buildRules(fs.readFileSync('firestore.rules', 'utf8'), emails));

console.log(`\n=== ${target.label}: running the tests and building ===\n`);
run('npm test');
run(`npx vite build --mode ${target.mode}`);

console.log(`\n=== ${target.label}: publishing ===\n`);
run(`npx firebase deploy --only hosting,firestore:rules --config firebase.live.json --project ${target.project}`);

if (name === 'test') {
  fs.writeFileSync(MARKER, JSON.stringify({ commit, dirty, at: new Date().toISOString() }));
  console.log(dirty
    ? '\nTest is updated, but it includes uncommitted edits. Commit them and deploy to test again before going live.'
    : '\nTest is updated. Try it, then run  npm run deploy:live  to publish this same version.');
}

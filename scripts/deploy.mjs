/**
 * Tests, builds and publishes the site and rules to the live Firebase project.
 * Reads OWNER_EMAILS from .env.production (not committed).
 */
import { execSync } from 'node:child_process';
import fs from 'node:fs';
import { buildRules, parseEmails } from './rules.mjs';

function readEnv(file) {
  if (!fs.existsSync(file)) return {};
  const entries = fs.readFileSync(file, 'utf8')
    .split(/\r?\n/)
    .filter((line) => line.includes('=') && !line.trim().startsWith('#'))
    .map((line) => [line.slice(0, line.indexOf('=')).trim(), line.slice(line.indexOf('=') + 1).trim()]);
  return Object.fromEntries(entries);
}

const emails = parseEmails(readEnv('.env.production').OWNER_EMAILS);
if (!emails.length) console.warn('OWNER_EMAILS is empty: only accounts in the owners collection can create the workspace.');

fs.mkdirSync('.firebase-rules', { recursive: true });
fs.writeFileSync('.firebase-rules/firestore.rules', buildRules(fs.readFileSync('firestore.rules', 'utf8'), emails));
execSync('npm run verify', { stdio: 'inherit' });
execSync('npx firebase deploy --only hosting,firestore:rules --config firebase.live.json --project live', { stdio: 'inherit' });

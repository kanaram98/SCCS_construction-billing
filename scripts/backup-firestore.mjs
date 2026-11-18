/**
 * Copies the cloud workspace to files: the app backup (restore it from Settings →
 * Restore from file) and a raw copy of every document.
 *
 *   node scripts/backup-firestore.mjs --project sccs-billing-eb0c7 [--workspace sccs] [--out backups]
 *
 * Sign-in: set FIREBASE_SERVICE_ACCOUNT to the service-account key (JSON text), or
 * GOOGLE_APPLICATION_CREDENTIALS to its file. With FIRESTORE_EMULATOR_HOST set it reads the emulator.
 */
import fs from 'node:fs';
import path from 'node:path';
import { cert, initializeApp, applicationDefault } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { BACKUP_COLLECTIONS, backupStamp, buildBackup } from './backup-lib.mjs';

function option(name, fallback = '') {
  const index = process.argv.indexOf(`--${name}`);
  return index >= 0 ? process.argv[index + 1] : fallback;
}

const projectId = option('project', process.env.FIREBASE_PROJECT_ID || '');
const workspace = option('workspace', 'sccs');
const outDir = option('out', 'backups');
if (!projectId) {
  console.error('Give the Firebase project with --project <id>.');
  process.exit(1);
}

const credential = process.env.FIREBASE_SERVICE_ACCOUNT ? cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)) : applicationDefault();
initializeApp(process.env.FIRESTORE_EMULATOR_HOST ? { projectId } : { projectId, credential });
const db = getFirestore();

const workspaceDoc = await db.doc(`workspaces/${workspace}`).get();
if (!workspaceDoc.exists) {
  console.error(`Workspace "${workspace}" was not found in project ${projectId}. Nothing was written.`);
  process.exit(1);
}

const docs = [];
for (const collection of BACKUP_COLLECTIONS) {
  const snapshot = await db.collection(`workspaces/${workspace}/${collection}`).get();
  snapshot.forEach((item) => docs.push({ collection, id: item.id, data: item.data() }));
}

const now = new Date();
const { app, documents, counts } = buildBackup(docs, now);
fs.mkdirSync(outDir, { recursive: true });
const stamp = backupStamp(now);
fs.writeFileSync(path.join(outDir, `construction-billing-backup-${stamp}.json`), JSON.stringify(app));
fs.writeFileSync(path.join(outDir, `documents-${stamp}.json`), JSON.stringify({ project: projectId, workspace, exportedAt: now.toISOString(), documents }));
console.log(`Backup written to ${outDir}/ (${docs.length} documents).`, counts);

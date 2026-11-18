import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { initializeApp } from 'firebase-admin/app';
import { getFirestore, Timestamp } from 'firebase-admin/firestore';
import { toDocuments } from '../../src/backend/mapping.js';
import { parseBackup } from '../../src/domain/backup.js';
import { buildSampleState } from '../backend/sample-state.js';

// Runs the real nightly-backup script against the Firestore emulator (the workflow runs the same script against the live project).
describe('nightly backup script', () => {
  it('copies the workspace into a backup file the app can restore, and refuses a missing workspace', async () => {
    expect(process.env.FIRESTORE_EMULATOR_HOST).toBeTruthy();
    initializeApp({ projectId: 'demo-sccs' }, 'backup-test');
    const db = getFirestore(initializeApp({ projectId: 'demo-sccs' }, 'backup-test-db'));
    await db.doc('workspaces/sccs').set({ name: 'SCCS' });
    for (const doc of toDocuments(buildSampleState(), { by: 'admin-uid' })) {
      await db.doc(`workspaces/sccs/${doc.collection}/${doc.id}`).set({ ...doc.data, syncedAt: Timestamp.now() });
    }

    const out = fs.mkdtempSync(path.join(os.tmpdir(), 'backup-test-'));
    execFileSync('node', ['scripts/backup-firestore.mjs', '--project', 'demo-sccs', '--out', out], { stdio: 'pipe', env: process.env });
    const files = fs.readdirSync(out);
    expect(files.some((name) => name.startsWith('documents-'))).toBe(true);
    const appFile = files.find((name) => name.startsWith('construction-billing-backup'));
    const restored = parseBackup(fs.readFileSync(path.join(out, appFile), 'utf8'));
    expect(restored.billCount).toBe(3);
    expect(restored.state.labour.workers).toHaveLength(1);
    expect(restored.state.projects).toHaveLength(1);

    const none = path.join(out, 'none');
    expect(() => execFileSync('node', ['scripts/backup-firestore.mjs', '--project', 'demo-sccs', '--workspace', 'nope', '--out', none], { stdio: 'pipe', env: process.env })).toThrow();
    expect(fs.existsSync(none)).toBe(false);
  });
});

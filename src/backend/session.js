/**
 * Signing in and joining the workspace.
 *
 * After Google sign-in, `joinWorkspace` works out the person's place:
 *   - already a member                 → their role
 *   - invited by email                 → becomes a member with the invited role
 *   - an owner (firestore.rules) and the
 *     workspace doesn't exist yet      → creates it and becomes admin
 *   - otherwise                        → 'no-access' (ask the admin for an invite)
 *   - the server could not be reached  → 'unreachable' (never guessed as no access)
 *
 * Every function takes the Firestore instance and module (`db`, `fs`) so it
 * runs the same in the app and in emulator tests.
 */
import { SCHEMA_VERSION, docPath, workspacePath } from './schema.js';

const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Runs `read`, retrying while the database connection is still starting
 * (code 'unavailable', common right after signing in or switching account).
 */
export async function readWithRetry(read, { attempts = 5, delay = 1000, wait = sleep } = {}) {
  for (let attempt = 1; ; attempt += 1) {
    try {
      return await read();
    } catch (error) {
      if (error?.code !== 'unavailable' || attempt >= attempts) throw error;
      await wait(delay * attempt);
    }
  }
}

/** @returns {Promise<{ status: 'member'|'no-access'|'unreachable', role?: string, created?: boolean, joined?: boolean, reason?: string }>} */
export async function joinWorkspace({ db, fs }, wid, user, now = new Date(), options = {}) {
  const notes = []; // what was tried, shown to the user when there is no access
  // Always read from the server (never an old cached copy); a permission error means "not readable by this account".
  const read = async (ref, label) => {
    try {
      return await readWithRetry(() => fs.getDocFromServer(ref), options);
    } catch (error) {
      if (error?.code === 'unavailable') throw error;
      notes.push(`${label}: ${error.code}`);
      return null;
    }
  };

  try {
    await fs.enableNetwork(db).catch(() => {});
    const memberRef = fs.doc(db, docPath(wid, 'members', user.uid));
    const existing = await read(memberRef, 'member read');
    if (existing?.exists()) return { status: 'member', role: existing.data().role };

    const at = now.toISOString();
    const member = (role) => ({ uid: user.uid, name: user.displayName || user.email, email: user.email, role, addedAt: at, syncedAt: fs.serverTimestamp() });

    // Invited?
    const inviteRef = fs.doc(db, docPath(wid, 'invites', user.email));
    const invite = await read(inviteRef, 'invite read');
    if (invite && !invite.exists()) notes.push(`no invite for ${user.email}`);
    if (invite?.exists()) {
      const { role } = invite.data();
      await fs.setDoc(memberRef, member(role));
      await fs.deleteDoc(inviteRef).catch(() => {});
      return { status: 'member', role, joined: true };
    }

    // Not invited: the first owner creates the workspace. The server decides who
    // is an owner, so just try; anyone else is refused.
    const workspaceRef = fs.doc(db, workspacePath(wid));
    const workspace = await read(workspaceRef, 'workspace read');
    if (workspace?.exists()) notes.push('workspace exists');
    if (!workspace?.exists()) {
      try {
        await fs.setDoc(workspaceRef, { name: 'SCCS', schemaVersion: SCHEMA_VERSION, createdAt: at, createdBy: user.uid, syncedAt: fs.serverTimestamp() });
        await fs.setDoc(memberRef, member('admin'));
        return { status: 'member', role: 'admin', created: true };
      } catch (error) {
        if (error?.code !== 'permission-denied') throw error;
        notes.push('workspace create: permission-denied');
      }
    }
    console.warn('Workspace join: no access.', notes);
    return { status: 'no-access', reason: notes.join('; ') };
  } catch (error) {
    if (error?.code === 'unavailable') return { status: 'unreachable', reason: 'The server could not be reached.' };
    throw error;
  }
}

/** Members of the workspace, for names in History and the members screen. */
export async function listMembers({ db, fs }, wid) {
  const snapshot = await fs.getDocs(fs.collection(db, `${workspacePath(wid)}/members`));
  return snapshot.docs.map((item) => item.data());
}

export async function listInvites({ db, fs }, wid) {
  const snapshot = await fs.getDocs(fs.collection(db, `${workspacePath(wid)}/invites`));
  return snapshot.docs.map((item) => item.data());
}

/** Admin: invite a Google account (lower-case email) with a role. */
export function inviteMember({ db, fs }, wid, { email, role, invitedBy }, now = new Date()) {
  const address = String(email).trim().toLowerCase();
  return fs.setDoc(fs.doc(db, docPath(wid, 'invites', address)), {
    email: address, role, invitedAt: now.toISOString(), invitedBy, syncedAt: fs.serverTimestamp()
  });
}

export function cancelInvite({ db, fs }, wid, email) {
  return fs.deleteDoc(fs.doc(db, docPath(wid, 'invites', email)));
}

/** Admin: remove someone from the workspace (they lose access at once). */
export function removeMember({ db, fs }, wid, uid) {
  return fs.deleteDoc(fs.doc(db, docPath(wid, 'members', uid)));
}

/**
 * Signing in and joining the workspace.
 *
 * After Google sign-in, `joinWorkspace` works out the person's place:
 *   - already a member                 → their role
 *   - invited by email                 → becomes a member with the invited role
 *   - listed in owners/{email} and the
 *     workspace doesn't exist yet      → creates it and becomes admin
 *   - otherwise                        → 'no-access' (ask the admin for an invite)
 *
 * Every function takes the Firestore instance and module (`db`, `fs`) so it
 * runs the same in the app and in emulator tests.
 */
import { SCHEMA_VERSION, docPath, workspacePath } from './schema.js';

/** @returns {Promise<{ status: 'member'|'no-access', role?: string, created?: boolean, joined?: boolean }>} */
export async function joinWorkspace({ db, fs }, wid, user, now = new Date()) {
  const memberRef = fs.doc(db, docPath(wid, 'members', user.uid));
  const existing = await fs.getDoc(memberRef).catch(() => null);
  if (existing?.exists()) return { status: 'member', role: existing.data().role };

  const at = now.toISOString();
  const member = (role) => ({ uid: user.uid, name: user.displayName || user.email, email: user.email, role, addedAt: at, syncedAt: fs.serverTimestamp() });

  // Invited?
  const inviteRef = fs.doc(db, docPath(wid, 'invites', user.email));
  const invite = await fs.getDoc(inviteRef).catch(() => null);
  if (invite?.exists()) {
    const { role } = invite.data();
    await fs.setDoc(memberRef, member(role));
    await fs.deleteDoc(inviteRef).catch(() => {});
    return { status: 'member', role, joined: true };
  }

  // Allowed to create the workspace?
  const owner = await fs.getDoc(fs.doc(db, `owners/${user.email}`)).catch(() => null);
  if (owner?.exists()) {
    const workspaceRef = fs.doc(db, workspacePath(wid));
    const workspace = await fs.getDoc(workspaceRef).catch(() => null);
    if (!workspace?.exists()) {
      await fs.setDoc(workspaceRef, { name: 'SCCS', schemaVersion: SCHEMA_VERSION, createdAt: at, createdBy: user.uid, syncedAt: fs.serverTimestamp() });
      await fs.setDoc(memberRef, member('admin'));
      return { status: 'member', role: 'admin', created: true };
    }
  }
  return { status: 'no-access' };
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

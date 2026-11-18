import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useBilling } from '../../state/BillingContext.jsx';
import { useNotify } from '../../components/ui';
import { formatLogTime } from '../../domain/labour-log.js';
import { cloudConfig, isCloudConfigured } from '../../backend/config.js';
import { can as roleCan, canEditAttendanceDate, canRestore, canUndo } from '../../domain/permissions.js';
import { tr as t, trn } from '../../i18n/translate.js';

/**
 * Cloud sign-in and sync for the whole app.
 *
 * Firebase is loaded only when this device has signed in before or the user
 * taps "Sign in", so device-only use stays light. Without cloud settings
 * (see backend/config.js) everything here is inert and every action is allowed.
 *
 * What the phone may open (`access`):
 *   'full'    signed in as a workspace member (or no cloud set up): everything, by role
 *   'labour'  signed out on a phone where someone signed in before: Labour only
 *             (that person's timesheets); entries upload at their next sign-in
 *   'signin'  never signed in on this phone (or no access yet): sign in first
 *
 *   const cloud = useCloud();
 *   cloud.status   'off' | 'signed-out' | 'connecting' | 'no-access' | 'switch-blocked' | 'syncing' | 'synced' | 'offline' | 'error'
 *   cloud.access, cloud.user, cloud.lastUser, cloud.role, cloud.members, cloud.can('deleteForever')
 *   cloud.signIn(), cloud.signOut(), cloud.pendingChanges(), cloud.continueSwitch()
 */
const SIGNED_IN_FLAG = 'construction_billing_cloud_signed_in';
const LAST_USER_KEY = 'construction_billing_last_user';
const lastSyncedKey = (uid) => `construction_billing_last_synced:${uid}`;
/** Notices about other people's changes are shown at most this often (ms). */
const OTHERS_NOTICE_GAP = 20000;
/** After this long in "syncing", finishing is worth a notice (ms). */
const SLOW_SYNC_MS = 8000;
const syncStateKey = (uid) => `construction_billing_sync:${cloudConfig.workspaceId}:${uid}`;

const storage = {
  get(key) { try { return window.localStorage.getItem(key); } catch { return null; } },
  set(key, value) { try { window.localStorage.setItem(key, value); } catch { /* storage unavailable */ } },
  remove(key) { try { window.localStorage.removeItem(key); } catch { /* storage unavailable */ } },
  getJson(key) { try { return JSON.parse(window.localStorage.getItem(key)); } catch { return null; } }
};

const LOCAL_ONLY = Object.freeze({
  configured: false,
  access: 'full',
  status: 'off',
  user: null,
  lastUser: null,
  role: null,
  members: [],
  switchInfo: null,
  noAccessReason: '',
  pending: 0,
  syncing: false,
  lastSynced: null,
  syncNow: async () => {},
  can: () => true,
  canEditDate: () => true,
  canUndo: () => true,
  canRestore: () => true,
  signIn: async () => {},
  signOut: async () => {},
  pendingChanges: async () => 0,
  continueSwitch: async () => {},
  retry: async () => {},
  refreshMembers: async () => {},
  firebase: null
});

const CloudContext = createContext(LOCAL_ONLY);

export function useCloud() {
  return useContext(CloudContext);
}

export function CloudProvider({ children }) {
  if (!isCloudConfigured()) return <CloudContext.Provider value={LOCAL_ONLY}>{children}</CloudContext.Provider>;
  return <ConnectedCloud>{children}</ConnectedCloud>;
}

/** Changes made on this phone that the cloud doesn't have yet, for an account's sync state. */
async function countUnsynced(raw, syncState, uid) {
  if (!syncState) return 0;
  const { planUpload } = await import('../../backend/sync-core.js');
  return planUpload(raw, syncState, { by: uid }).ops.length;
}

function ConnectedCloud({ children }) {
  const { raw, actions } = useBilling();
  const notify = useNotify();
  // Refs so the sign-in handler and the sync engine always see the latest
  // values without being recreated (recreating them would restart sync).
  const rawRef = useRef(raw);
  rawRef.current = raw;
  const actionsRef = useRef(actions);
  actionsRef.current = actions;
  const notifyRef = useRef(notify);
  notifyRef.current = notify;
  const runRef = useRef(0);
  const firebaseRef = useRef(null);
  const engineRef = useRef(null);
  const [user, setUser] = useState(null);
  const [lastUser, setLastUser] = useState(() => storage.getJson(LAST_USER_KEY));
  const [role, setRole] = useState(null);
  const [members, setMembers] = useState([]);
  const [switchInfo, setSwitchInfo] = useState(null);
  const [noAccessReason, setNoAccessReason] = useState('');
  const [inFlight, setInFlight] = useState(0);
  const [unsent, setUnsent] = useState(0);
  const [syncing, setSyncing] = useState(false);
  const [lastSynced, setLastSynced] = useState(null);
  const membersRef = useRef([]);
  const noticeRef = useRef({ lastOthers: 0, syncingSince: 0, wasOffline: false, firstOnlineCheck: true });
  // A phone signed in before restores its session on start: treat it as signed in meanwhile.
  const [status, setStatus] = useState(() => (storage.get(SIGNED_IN_FLAG) ? 'connecting' : 'signed-out'));
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine !== false));

  const stopEngine = () => { engineRef.current?.stop(); engineRef.current = null; };

  const refreshMembers = useCallback(async () => {
    const firebase = firebaseRef.current;
    if (!firebase) return;
    const { listMembers } = await import('../../backend/session.js');
    const list = await listMembers({ db: firebase.db, fs: firebase.fs }, cloudConfig.workspaceId).catch(() => []);
    membersRef.current = list;
    setMembers(list);
  }, []);

  /** Starts syncing for a member (after any account-switch check). */
  const startSync = useCallback(async (nextUser, access, isCurrent) => {
    const firebase = firebaseRef.current;
    const { createSyncEngine } = await import('../../backend/cloud-sync.js');
    if (!isCurrent()) return;
    const remembered = { uid: nextUser.uid, email: nextUser.email, name: nextUser.displayName || nextUser.email, role: access.role };
    storage.set(LAST_USER_KEY, JSON.stringify(remembered));
    setLastUser(remembered);
    setRole(access.role);
    setSwitchInfo(null);
    if (access.created) notifyRef.current(t('Workspace created. You are the admin.'), 'success');
    if (access.joined) notifyRef.current(t('You joined the workspace.'), 'success');
    refreshMembers();

    const key = syncStateKey(nextUser.uid);
    const engine = createSyncEngine({
      db: firebase.db,
      fs: firebase.fs,
      wid: cloudConfig.workspaceId,
      uid: nextUser.uid,
      getRaw: () => rawRef.current,
      applyRaw: (next, conflicts = [], info = {}) => {
        rawRef.current = next;
        actionsRef.current.data.restore(next);
        const others = info.fromOthers || [];
        const notices = noticeRef.current;
        if (others.length && Date.now() - notices.lastOthers > OTHERS_NOTICE_GAP) {
          notices.lastOthers = Date.now();
          const names = [...new Set(others.map((item) => membersRef.current.find((member) => member.uid === item.by)?.name).filter(Boolean))];
          notifyRef.current(trn(others.length,
            '{count} change from {who} arrived. This phone is up to date.',
            '{count} changes from {who} arrived. This phone is up to date.',
            { who: names.length ? names.join(', ') : t('another device') }), 'info');
        }
        if (conflicts.length) notifyRef.current(trn(conflicts.length, '{count} item was also changed on another device. The newer version was kept; see History.', '{count} items were also changed on another device. The newer versions were kept; see History.'), 'warning');
      },
      loadState: () => storage.getJson(key),
      saveState: (state) => storage.set(key, JSON.stringify(state)),
      onStatus: (next) => {
        const notices = noticeRef.current;
        if (next === 'syncing' && !notices.syncingSince) notices.syncingSince = Date.now();
        if (next === 'synced') {
          const at = new Date().toISOString();
          storage.set(lastSyncedKey(nextUser.uid), at);
          setLastSynced(at);
          // A long wait (offline, slow network) deserves a confirmation; quick syncs stay quiet.
          if (notices.syncingSince && (notices.wasOffline || Date.now() - notices.syncingSince > SLOW_SYNC_MS)) {
            notifyRef.current(t('All changes are uploaded.'), 'success');
          }
          notices.syncingSince = 0;
          notices.wasOffline = false;
        }
        if (next === 'error') notifyRef.current(t('Sync problem. Changes are kept on this device; try again later.'), 'warning');
        setStatus(next);
      },
      onPending: setInFlight,
      onRefused: () => notifyRef.current(t('Only the admin can make that change. It was undone.'), 'warning')
    });
    engineRef.current = engine;
    setLastSynced(storage.get(lastSyncedKey(nextUser.uid)));
    try {
      await engine.start();
    } catch (error) {
      console.error('Sync could not start.', error);
      setStatus('error');
    }
  }, [refreshMembers]);

  const handleUser = useCallback(async (nextUser) => {
    const run = ++runRef.current;
    const isCurrent = () => run === runRef.current; // a newer sign-in state replaces this one
    stopEngine();
    setUser(nextUser);
    setRole(null);
    setSwitchInfo(null);
    if (!nextUser) {
      setStatus('signed-out');
      storage.remove(SIGNED_IN_FLAG);
      return;
    }
    storage.set(SIGNED_IN_FLAG, '1');
    setStatus('connecting');
    const firebase = firebaseRef.current;
    const { joinWorkspace } = await import('../../backend/session.js');
    let access;
    try {
      access = await joinWorkspace({ db: firebase.db, fs: firebase.fs }, cloudConfig.workspaceId, nextUser);
    } catch (error) {
      console.error('Could not open the workspace.', error);
      if (isCurrent()) setStatus('error');
      return;
    }
    if (!isCurrent()) return;
    if (access.status === 'unreachable') { setStatus('unreachable'); return; }
    if (access.status !== 'member') { setNoAccessReason(access.reason || ''); setStatus('no-access'); return; }

    // Another account's changes still waiting on this phone? Don't overwrite them.
    const previous = storage.getJson(LAST_USER_KEY);
    if (previous && previous.uid !== nextUser.uid) {
      const count = await countUnsynced(rawRef.current, storage.getJson(syncStateKey(previous.uid)), previous.uid);
      if (!isCurrent()) return;
      if (count > 0) {
        setRole(access.role);
        setSwitchInfo({ count, previous, resume: () => startSync(nextUser, access, isCurrent) });
        setStatus('switch-blocked');
        return;
      }
    }
    await startSync(nextUser, access, isCurrent);
  }, [startSync]);

  const connecting = useRef(null);
  /** Loads Firebase and listens for sign-in once, however often it is called. */
  const connect = useCallback(() => {
    if (!connecting.current) {
      connecting.current = import('../../backend/firebase.js')
        .then(({ loadFirebase }) => loadFirebase())
        .then((firebase) => {
          firebaseRef.current = firebase;
          firebase.authFns.onAuthStateChanged(firebase.auth, handleUser);
          return firebase;
        });
    }
    return connecting.current;
  }, [handleUser]);

  // Reconnect on start if this device signed in before; stop syncing when the app closes.
  useEffect(() => {
    if (storage.get(SIGNED_IN_FLAG)) connect().catch((error) => { console.error(error); setStatus('error'); });
  }, [connect]);
  useEffect(() => () => stopEngine(), []);

  // Send local changes shortly after they happen (and don't claim 'Synced' meanwhile).
  useEffect(() => {
    if (!engineRef.current) return undefined;
    setStatus((current) => (current === 'synced' ? 'syncing' : current));
    const timer = setTimeout(() => engineRef.current?.push(), 1200);
    return () => clearTimeout(timer);
  }, [raw]);

  // Changes still waiting to upload (counted shortly after each change).
  useEffect(() => {
    const engine = engineRef.current;
    if (!engine) { setUnsent(0); return undefined; }
    const timer = setTimeout(() => setUnsent(engine.unsentCount()), 400);
    return () => clearTimeout(timer);
  }, [raw, status, inFlight]);

  // Tell the user when the phone goes offline and when it is back.
  useEffect(() => {
    const notices = noticeRef.current;
    if (notices.firstOnlineCheck) { notices.firstOnlineCheck = false; if (online) return; }
    if (!engineRef.current) return;
    if (!online) {
      notices.wasOffline = true;
      notifyRef.current(t('You are offline. Everything is saved on this phone and uploads when the internet is back.'), 'info');
    } else if (notices.wasOffline) {
      notifyRef.current(t('Back online. Uploading your changes…'), 'info');
    }
  }, [online]);

  useEffect(() => {
    const update = () => setOnline(navigator.onLine !== false);
    window.addEventListener('online', update);
    window.addEventListener('offline', update);
    return () => { window.removeEventListener('online', update); window.removeEventListener('offline', update); };
  }, []);

  const signIn = useCallback(async () => {
    try {
      const firebase = await connect();
      await firebase.authFns.signInWithPopup(firebase.auth, new firebase.authFns.GoogleAuthProvider());
    } catch (error) {
      if (error?.code === 'auth/popup-closed-by-user' || error?.code === 'auth/cancelled-popup-request') return;
      console.error('Sign-in failed.', error);
      notify(t('Sign-in failed: {reason}', { reason: error.code || error.message }), 'error');
    }
  }, [connect, notify]);

  /** "Sync now": uploads everything, waits for the server to confirm, downloads what others changed. */
  const syncNow = useCallback(async () => {
    const engine = engineRef.current;
    if (!engine || syncing) return;
    setSyncing(true);
    try {
      const result = await engine.syncNow();
      if (result.ok) {
        notifyRef.current(t('All changes are uploaded and this phone is up to date.'), 'success');
      } else if (result.pending > 0) {
        notifyRef.current(trn(result.pending,
          '{count} change is still waiting to upload (no internet?). It is safe on this phone and uploads automatically.',
          '{count} changes are still waiting to upload (no internet?). They are safe on this phone and upload automatically.'), 'warning');
      } else {
        notifyRef.current(t('Everything is uploaded, but this phone could not check for new changes. Try again with internet.'), 'warning');
      }
    } finally {
      setSyncing(false);
    }
  }, [syncing]);

  const signOut = useCallback(async () => {
    stopEngine();
    const firebase = firebaseRef.current;
    if (firebase) await firebase.authFns.signOut(firebase.auth);
  }, []);

  /**
   * Changes not in the cloud yet: not sent, or sent but not confirmed by the
   * server (e.g. offline). Used to warn before signing out.
   */
  const pendingChanges = useCallback(async () => {
    const firebase = firebaseRef.current;
    if (!user || !firebase) return 0;
    const notSent = await countUnsynced(rawRef.current, storage.getJson(syncStateKey(user.uid)), user.uid);
    const confirmed = await Promise.race([
      firebase.fs.waitForPendingWrites(firebase.db).then(() => true),
      new Promise((resolve) => setTimeout(() => resolve(false), 1500))
    ]);
    return notSent + (confirmed ? 0 : 1);
  }, [user]);

  /** Tries joining again (e.g. after the connection was down). */
  const retry = useCallback(async () => {
    const firebase = firebaseRef.current;
    if (firebase?.auth.currentUser) await handleUser(firebase.auth.currentUser);
  }, [handleUser]);

  const continueSwitch = useCallback(async () => {
    if (switchInfo) await switchInfo.resume();
  }, [switchInfo]);

  const signedIn = Boolean(user) || status === 'connecting';
  const access = signedIn && status !== 'no-access' && status !== 'switch-blocked' && status !== 'unreachable'
    ? 'full'
    : !user && lastUser ? 'labour' : 'signin';
  // Signed out, the last role on this phone still applies (e.g. a contractor can't unlock months).
  const effectiveRole = role || (access === 'labour' ? lastUser?.role : null);

  const value = useMemo(() => ({
    configured: true,
    access,
    status: (status === 'synced' || status === 'syncing') && !online ? 'offline' : status,
    user,
    lastUser,
    role,
    members,
    switchInfo,
    noAccessReason,
    pending: unsent + inFlight,
    syncing,
    lastSynced,
    syncNow,
    can: (action) => (effectiveRole ? roleCan(effectiveRole, action) : true),
    /** Timesheet day: contractors only today and the 2 days before. */
    canEditDate: (date) => (effectiveRole ? canEditAttendanceDate(effectiveRole, date) : true),
    canUndo: (entry) => (effectiveRole ? canUndo(effectiveRole, entry) : true),
    canRestore: (entity) => (effectiveRole ? canRestore(effectiveRole, entity) : true),
    signIn,
    signOut,
    pendingChanges,
    continueSwitch,
    retry,
    refreshMembers,
    firebase: firebaseRef.current
  }), [access, status, online, user, lastUser, role, effectiveRole, members, switchInfo, noAccessReason, unsent, inFlight, syncing, lastSynced, syncNow, signIn, signOut, pendingChanges, continueSwitch, retry, refreshMembers]);

  return <CloudContext.Provider value={value}>{children}</CloudContext.Provider>;
}

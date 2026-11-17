import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { useBilling } from '../../state/BillingContext.jsx';
import { useNotify } from '../../components/ui';
import { cloudConfig, isCloudConfigured } from '../../backend/config.js';
import { can as roleCan } from '../../domain/permissions.js';
import { tr as t, trn } from '../../i18n/translate.js';

/**
 * Cloud sign-in and sync for the whole app.
 *
 * Firebase is loaded only when this device has signed in before or the user
 * taps "Sign in", so device-only use stays light. Without cloud settings
 * (see backend/config.js) everything here is inert and every action is allowed.
 *
 *   const cloud = useCloud();
 *   cloud.status   'off' | 'signed-out' | 'connecting' | 'no-access' | 'syncing' | 'synced' | 'offline' | 'error'
 *   cloud.user, cloud.role, cloud.members, cloud.can('deleteForever'), cloud.signIn(), cloud.signOut()
 */
const SIGNED_IN_FLAG = 'construction_billing_cloud_signed_in';
const syncStateKey = (uid) => `construction_billing_sync:${cloudConfig.workspaceId}:${uid}`;

const storage = {
  get(key) { try { return window.localStorage.getItem(key); } catch { return null; } },
  set(key, value) { try { window.localStorage.setItem(key, value); } catch { /* storage unavailable */ } },
  remove(key) { try { window.localStorage.removeItem(key); } catch { /* storage unavailable */ } }
};

const LOCAL_ONLY = Object.freeze({
  configured: false,
  status: 'off',
  user: null,
  role: null,
  members: [],
  can: () => true,
  signIn: async () => {},
  signOut: async () => {},
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
  const [role, setRole] = useState(null);
  const [members, setMembers] = useState([]);
  const [status, setStatus] = useState('signed-out');
  const [online, setOnline] = useState(() => (typeof navigator === 'undefined' ? true : navigator.onLine !== false));

  const stopEngine = () => { engineRef.current?.stop(); engineRef.current = null; };

  const refreshMembers = useCallback(async () => {
    const firebase = firebaseRef.current;
    if (!firebase) return;
    const { listMembers } = await import('../../backend/session.js');
    setMembers(await listMembers({ db: firebase.db, fs: firebase.fs }, cloudConfig.workspaceId).catch(() => []));
  }, []);

  const handleUser = useCallback(async (nextUser) => {
    const run = ++runRef.current;
    const current = () => run === runRef.current; // a newer sign-in state replaces this one
    stopEngine();
    setUser(nextUser);
    setRole(null);
    if (!nextUser) {
      setStatus('signed-out');
      storage.remove(SIGNED_IN_FLAG);
      return;
    }
    storage.set(SIGNED_IN_FLAG, '1');
    setStatus('connecting');
    const firebase = firebaseRef.current;
    const cloud = { db: firebase.db, fs: firebase.fs };
    const [{ joinWorkspace }, { createSyncEngine }] = await Promise.all([import('../../backend/session.js'), import('../../backend/cloud-sync.js')]);
    let access;
    try {
      access = await joinWorkspace(cloud, cloudConfig.workspaceId, nextUser);
    } catch (error) {
      console.error('Could not open the workspace.', error);
      if (current()) setStatus('error');
      return;
    }
    if (!current()) return;
    if (access.status !== 'member') { setStatus('no-access'); return; }
    setRole(access.role);
    const notify = notifyRef.current;
    if (access.created) notify(t('Workspace created. You are the admin.'), 'success');
    if (access.joined) notify(t('You joined the workspace.'), 'success');
    refreshMembers();

    const key = syncStateKey(nextUser.uid);
    const engine = createSyncEngine({
      ...cloud,
      wid: cloudConfig.workspaceId,
      uid: nextUser.uid,
      getRaw: () => rawRef.current,
      applyRaw: (next, conflicts = []) => {
        rawRef.current = next;
        actionsRef.current.data.restore(next);
        if (conflicts.length) notifyRef.current(trn(conflicts.length, '{count} item was also changed on another device. The newer version was kept; see History.', '{count} items were also changed on another device. The newer versions were kept; see History.'), 'warning');
      },
      loadState: () => { try { return JSON.parse(storage.get(key)); } catch { return null; } },
      saveState: (state) => storage.set(key, JSON.stringify(state)),
      onStatus: setStatus,
      onRefused: () => notifyRef.current(t('Only the admin can make that change. It was undone.'), 'warning')
    });
    if (!current()) return;
    engineRef.current = engine;
    try {
      await engine.start();
    } catch (error) {
      console.error('Sync could not start.', error);
      setStatus('error');
    }
  }, [refreshMembers]);

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

  // Send local changes shortly after they happen.
  useEffect(() => {
    if (!engineRef.current) return undefined;
    const timer = setTimeout(() => engineRef.current?.push(), 1200);
    return () => clearTimeout(timer);
  }, [raw]);

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

  const signOut = useCallback(async () => {
    stopEngine();
    const firebase = firebaseRef.current;
    if (firebase) await firebase.authFns.signOut(firebase.auth);
  }, []);

  const value = useMemo(() => ({
    configured: true,
    status: (status === 'synced' || status === 'syncing') && !online ? 'offline' : status,
    user,
    role,
    members,
    // Signed out, the device is used on its own: everything is allowed.
    can: (action) => (role ? roleCan(role, action) : true),
    signIn,
    signOut,
    refreshMembers,
    firebase: firebaseRef.current
  }), [status, online, user, role, members, signIn, signOut, refreshMembers]);

  return <CloudContext.Provider value={value}>{children}</CloudContext.Provider>;
}

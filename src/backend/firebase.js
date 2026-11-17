/**
 * Firebase, loaded only when cloud sync is used (keeps the app light for
 * everyone else). In development it connects to the local emulators.
 *
 *   const { auth, db, fs, authFns } = await loadFirebase();
 */
import { cloudConfig } from './config.js';

let loading = null;

export function loadFirebase() {
  if (!loading) loading = init();
  return loading;
}

async function init() {
  const [{ initializeApp }, authFns, fs] = await Promise.all([
    import('firebase/app'),
    import('firebase/auth'),
    import('firebase/firestore')
  ]);
  const app = initializeApp(cloudConfig.firebase);
  const auth = authFns.getAuth(app);
  // Keeps a copy on the device: works offline, and writes made offline are sent later.
  const db = fs.initializeFirestore(app, {
    localCache: fs.persistentLocalCache({ tabManager: fs.persistentMultipleTabManager() })
  });
  if (cloudConfig.useEmulators) {
    authFns.connectAuthEmulator(auth, 'http://127.0.0.1:9099', { disableWarnings: true });
    fs.connectFirestoreEmulator(db, '127.0.0.1', 8080);
  }
  return { app, auth, db, fs, authFns };
}

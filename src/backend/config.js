/**
 * Cloud settings from Vite env files (.env.development for the emulators;
 * the real project's values are added in Phase B3). Without them the app
 * runs on this device only and the cloud features stay hidden.
 */
const env = import.meta.env || {};

export const cloudConfig = Object.freeze({
  firebase: {
    apiKey: env.VITE_FIREBASE_API_KEY,
    authDomain: env.VITE_FIREBASE_AUTH_DOMAIN,
    projectId: env.VITE_FIREBASE_PROJECT_ID,
    appId: env.VITE_FIREBASE_APP_ID
  },
  useEmulators: env.VITE_USE_EMULATORS === 'true',
  workspaceId: env.VITE_WORKSPACE_ID || 'sccs'
});

export const isCloudConfigured = () => Boolean(cloudConfig.firebase.apiKey && cloudConfig.firebase.projectId);

/** Registers the offline service worker in production builds served over HTTPS or localhost. */
export function registerServiceWorker() {
  const isSecureHost = location.protocol === 'https:' ||
    location.hostname === 'localhost' ||
    location.hostname === '127.0.0.1';
  if (!import.meta.env.PROD || !('serviceWorker' in navigator) || !isSecureHost) return;

  navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`)
    .catch((error) => console.error('Could not register the offline app worker.', error));
}

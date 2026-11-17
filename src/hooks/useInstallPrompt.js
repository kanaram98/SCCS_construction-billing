import { useEffect, useState } from 'react';
import { tr } from '../i18n/translate.js';

const isStandalone = () =>
  window.matchMedia('(display-mode: standalone)').matches || window.navigator.standalone === true;

/** iOS has no install prompt; users must use Safari's "Add to Home Screen". */
export const isIosDevice = () => /iphone|ipad|ipod/i.test(navigator.userAgent);

/**
 * Tracks the browser's PWA install prompt.
 * @returns {{ canInstall: boolean, isInstalled: boolean, message: string, install: () => Promise<void> }}
 */
export function useInstallPrompt() {
  const [promptEvent, setPromptEvent] = useState(null);
  const [isInstalled, setIsInstalled] = useState(isStandalone);
  const [message, setMessage] = useState('');

  useEffect(() => {
    const handlePrompt = (event) => {
      event.preventDefault();
      setPromptEvent(event);
    };
    const handleInstalled = () => {
      setIsInstalled(true);
      setPromptEvent(null);
      setMessage(tr('App installed successfully.'));
    };
    window.addEventListener('beforeinstallprompt', handlePrompt);
    window.addEventListener('appinstalled', handleInstalled);
    return () => {
      window.removeEventListener('beforeinstallprompt', handlePrompt);
      window.removeEventListener('appinstalled', handleInstalled);
    };
  }, []);

  async function install() {
    if (!promptEvent) return;
    try {
      await promptEvent.prompt();
      const choice = await promptEvent.userChoice;
      setMessage(choice.outcome === 'accepted' ? tr('Installation started.') : tr('You can install it later from your browser menu.'));
    } catch (error) {
      console.error('Could not open the browser install prompt.', error);
      setMessage(tr('Use your browser menu to install this app.'));
    } finally {
      setPromptEvent(null);
    }
  }

  return { canInstall: Boolean(promptEvent) && !isInstalled, isInstalled, message, install };
}

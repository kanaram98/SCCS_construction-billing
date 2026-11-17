import { Notice } from '../ui/Feedback.jsx';
import { isIosDevice } from '../../hooks/useInstallPrompt.js';

/** App-level banners: storage problems and install guidance. */
export default function AppNotices({ storageError, isInstalled, installMessage }) {
  return (
    <>
      <Notice tone="error" className="no-print">{storageError}</Notice>
      {!isInstalled && isIosDevice() && (
        <Notice className="no-print">
          To install on iPhone or iPad, open this page in Safari, tap Share, then choose “Add to Home Screen”.
        </Notice>
      )}
      <Notice tone="success" className="no-print">{installMessage}</Notice>
    </>
  );
}

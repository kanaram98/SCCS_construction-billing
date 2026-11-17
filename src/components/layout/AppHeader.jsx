import { APP_NAME } from '../../config/app.js';
import Button from '../ui/Button.jsx';

export default function AppHeader({ subtitle, saveStatus, canInstall, onInstall }) {
  return (
    <header className="topbar no-print">
      <div className="brand-mark">₹</div>
      <div>
        <strong>{APP_NAME}</strong>
        <span>{subtitle || 'Feet-and-inches billing'}</span>
      </div>
      <span className="save-label">{saveStatus}</span>
      {canInstall && <Button variant="primary" className="install-button" onClick={onInstall}>Install app</Button>}
    </header>
  );
}

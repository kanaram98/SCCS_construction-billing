import { NAVIGATION } from '../../config/app.js';

export default function MainNav({ activeView, onNavigate }) {
  return (
    <nav className="tabs no-print" aria-label="Main navigation">
      {NAVIGATION.map(({ id, label }) => (
        <button
          key={id}
          type="button"
          className={activeView === id ? 'tab active' : 'tab'}
          aria-current={activeView === id ? 'page' : undefined}
          onClick={() => onNavigate(id)}
        >
          {label}
        </button>
      ))}
    </nav>
  );
}

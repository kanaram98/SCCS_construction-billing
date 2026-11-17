import { useState } from 'react';
import { BillingProvider, useBilling } from './state/BillingContext.jsx';
import { useInstallPrompt } from './hooks/useInstallPrompt.js';
import { VIEWS } from './config/app.js';
import AppHeader from './components/layout/AppHeader.jsx';
import MainNav from './components/layout/MainNav.jsx';
import AppNotices from './components/layout/AppNotices.jsx';
import DashboardPage from './features/dashboard/DashboardPage.jsx';
import EntryPage from './features/entry/EntryPage.jsx';
import RatesPage from './features/rates/RatesPage.jsx';
import ProjectPage from './features/project/ProjectPage.jsx';
import PrintPage from './features/print/PrintPage.jsx';

const PAGES = {
  [VIEWS.bills]: DashboardPage,
  [VIEWS.entry]: EntryPage,
  [VIEWS.rates]: RatesPage,
  [VIEWS.project]: ProjectPage,
  [VIEWS.print]: PrintPage
};

function AppShell() {
  const { bill, saveStatus, storageError } = useBilling();
  const installer = useInstallPrompt();
  const [view, setView] = useState(VIEWS.bills);
  const Page = PAGES[view];

  return (
    <div className="app-shell">
      <AppHeader
        subtitle={bill.projectName}
        saveStatus={saveStatus}
        canInstall={installer.canInstall}
        onInstall={installer.install}
      />
      <MainNav activeView={view} onNavigate={setView} />
      <main className="content">
        <AppNotices storageError={storageError} isInstalled={installer.isInstalled} installMessage={installer.message} />
        <Page onNavigate={setView} />
      </main>
      <footer className="app-footer no-print">Bills are stored on this device. Export a PDF to share or archive a copy.</footer>
    </div>
  );
}

export default function App() {
  return (
    <BillingProvider>
      <AppShell />
    </BillingProvider>
  );
}

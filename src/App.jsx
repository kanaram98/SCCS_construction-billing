import { Suspense, lazy, useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import { BillingProvider, useBilling } from './state/BillingContext.jsx';
import { CloudProvider, useCloud } from './features/account/CloudProvider.jsx';
import SignedOutBanner from './features/account/SignedOutBanner.jsx';
import { FeedbackProvider } from './components/ui';
import { useInstallPrompt } from './hooks/useInstallPrompt.js';
import { VIEWS } from './config/app.js';
import { BOTTOM_NAV_HEIGHT, DRAWER_WIDTH } from './theme.js';
import AppHeader from './components/layout/AppHeader.jsx';
import MainNav from './components/layout/MainNav.jsx';
import AppNotices from './components/layout/AppNotices.jsx';
import HomePage from './features/home/HomePage.jsx';
import LanguageGate from './i18n/LanguageGate.jsx';
import ScreenErrorBoundary from './components/layout/ScreenErrorBoundary.jsx';
import WelcomeDialog from './features/onboarding/WelcomeDialog.jsx';
import { tr as t } from './i18n/translate.js';

/**
 * The Bills screen ships in the main bundle; the others load on demand.
 * They are prefetched once the app is idle so they are cached for offline use.
 */
const loaders = {
  entry: () => import('./features/entry/EntryPage.jsx'),
  bills: () => import('./features/bills/BillsPage.jsx'),
  settings: () => import('./features/settings/SettingsPage.jsx'),
  rates: () => import('./features/rates/RatesPage.jsx'),
  project: () => import('./features/project/ProjectPage.jsx'),
  print: () => import('./features/print/PrintPage.jsx'),
  labour: () => import('./features/labour/LabourPage.jsx')
};
const EntryPage = lazy(loaders.entry);
const BillsPage = lazy(loaders.bills);
const SettingsPage = lazy(loaders.settings);
const RatesPage = lazy(loaders.rates);
const ProjectPage = lazy(loaders.project);
const PrintPage = lazy(loaders.print);
const LabourPage = lazy(loaders.labour);

function usePrefetchPages() {
  useEffect(() => {
    const prefetch = () => Object.values(loaders).forEach((load) => load().catch(() => {}));
    if ('requestIdleCallback' in window) {
      const id = window.requestIdleCallback(prefetch, { timeout: 4000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = window.setTimeout(prefetch, 2000);
    return () => window.clearTimeout(id);
  }, []);
}

const PAGES = {
  [VIEWS.home]: HomePage,
  [VIEWS.bills]: BillsPage,
  [VIEWS.entry]: EntryPage,
  [VIEWS.settings]: SettingsPage,
  [VIEWS.rates]: RatesPage,
  [VIEWS.project]: ProjectPage,
  [VIEWS.print]: PrintPage,
  [VIEWS.labour]: LabourPage
};

/** Screens available while signed out: Labour (phone signed in before) or only Settings to sign in. */
const LIMITED_VIEWS = { labour: [VIEWS.labour, VIEWS.settings], signin: [VIEWS.settings] };

function AppShell({ view: chosenView, setView }) {
  const { data, bill, saveStatus, storageError } = useBilling();
  const installer = useInstallPrompt();
  const cloud = useCloud();
  const allowed = LIMITED_VIEWS[cloud.access] || null;
  const view = allowed && !allowed.includes(chosenView) ? allowed[0] : chosenView;
  const Page = PAGES[view];
  usePrefetchPages();

  function navigate(nextView) {
    setView(nextView);
    window.scrollTo({ top: 0 });
  }

  return (
    <Box className="app-shell" sx={{ minHeight: '100vh' }}>
      <AppHeader
        subtitle={cloud.access === 'full' ? bill.projectName : ''}
        saveStatus={saveStatus}
        canInstall={installer.canInstall}
        onInstall={installer.install}
        onOpenSettings={() => navigate(VIEWS.settings)}
      />
      <MainNav activeView={view} onNavigate={navigate} views={allowed} />
      {!data.meta?.onboarded && cloud.access === 'full' && <WelcomeDialog onNavigate={navigate} />}
      <Box
        component="main"
        className="content"
        sx={{
          ml: { md: `${DRAWER_WIDTH}px` },
          pt: { xs: 2, md: 3 },
          pb: { xs: `calc(${BOTTOM_NAV_HEIGHT + 16}px + env(safe-area-inset-bottom))`, md: 4 }
        }}
      >
        <Container maxWidth="md" sx={{ px: { xs: 1.5, sm: 3 } }}>
          <SignedOutBanner onOpenSettings={() => navigate(VIEWS.settings)} />
          <AppNotices storageError={storageError} isInstalled={installer.isInstalled} installMessage={installer.message} />
          <ScreenErrorBoundary resetKey={view} onGoHome={() => navigate(VIEWS.home)}>
            <Suspense fallback={<LinearProgress sx={{ my: 2 }} aria-label={t('Loading')} />}>
              <Page onNavigate={navigate} />
            </Suspense>
          </ScreenErrorBoundary>
          <Typography className="no-print" variant="caption" color="text.secondary" component="footer" sx={{ display: 'block', textAlign: 'center', mt: 3 }}>
            {cloud.user ? t('Synced with the cloud. Export a PDF to share or archive a copy.') : t('Bills are stored on this device. Export a PDF to share or archive a copy.')}
          </Typography>
        </Container>
      </Box>
    </Box>
  );
}

/** Keeps the current screen and open settings across language changes (LanguageGate remounts its children). */
function LocalizedApp() {
  const [view, setView] = useState(VIEWS.home);
  return (
    <LanguageGate>
      <AppShell view={view} setView={setView} />
    </LanguageGate>
  );
}

export default function App() {
  return (
    <FeedbackProvider>
      <BillingProvider>
        <CloudProvider>
          <LocalizedApp />
        </CloudProvider>
      </BillingProvider>
    </FeedbackProvider>
  );
}

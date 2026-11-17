import { Suspense, lazy, useEffect, useState } from 'react';
import Box from '@mui/material/Box';
import LinearProgress from '@mui/material/LinearProgress';
import Container from '@mui/material/Container';
import Typography from '@mui/material/Typography';
import { BillingProvider, useBilling } from './state/BillingContext.jsx';
import { FeedbackProvider } from './components/ui';
import { useInstallPrompt } from './hooks/useInstallPrompt.js';
import { VIEWS } from './config/app.js';
import { BOTTOM_NAV_HEIGHT, DRAWER_WIDTH } from './theme.js';
import AppHeader from './components/layout/AppHeader.jsx';
import MainNav from './components/layout/MainNav.jsx';
import AppNotices from './components/layout/AppNotices.jsx';
import DashboardPage from './features/dashboard/DashboardPage.jsx';

/**
 * The Bills screen ships in the main bundle; the others load on demand.
 * They are prefetched once the app is idle so they are cached for offline use.
 */
const loaders = {
  entry: () => import('./features/entry/EntryPage.jsx'),
  rates: () => import('./features/rates/RatesPage.jsx'),
  project: () => import('./features/project/ProjectPage.jsx'),
  print: () => import('./features/print/PrintPage.jsx')
};
const EntryPage = lazy(loaders.entry);
const RatesPage = lazy(loaders.rates);
const ProjectPage = lazy(loaders.project);
const PrintPage = lazy(loaders.print);

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
  usePrefetchPages();

  function navigate(nextView) {
    setView(nextView);
    window.scrollTo({ top: 0 });
  }

  return (
    <Box className="app-shell" sx={{ minHeight: '100vh' }}>
      <AppHeader
        subtitle={bill.projectName}
        saveStatus={saveStatus}
        canInstall={installer.canInstall}
        onInstall={installer.install}
      />
      <MainNav activeView={view} onNavigate={navigate} />
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
          <AppNotices storageError={storageError} isInstalled={installer.isInstalled} installMessage={installer.message} />
          <Suspense fallback={<LinearProgress sx={{ my: 2 }} aria-label="Loading" />}>
            <Page onNavigate={navigate} />
          </Suspense>
          <Typography className="no-print" variant="caption" color="text.secondary" component="footer" sx={{ display: 'block', textAlign: 'center', mt: 3 }}>
            Bills are stored on this device. Export a PDF to share or archive a copy.
          </Typography>
        </Container>
      </Box>
    </Box>
  );
}

export default function App() {
  return (
    <FeedbackProvider>
      <BillingProvider>
        <AppShell />
      </BillingProvider>
    </FeedbackProvider>
  );
}

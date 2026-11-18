import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { ThemeProvider } from '@mui/material/styles';
import CssBaseline from '@mui/material/CssBaseline';
import App from './App.jsx';
import theme from './theme.js';
import { requestPersistentStorage } from './services/storage.js';
import { registerServiceWorker } from './services/service-worker.js';
import { setDefaultBranding } from './domain/app-state.js';
import { DEFAULT_BRANDING } from './config/brand.js';

setDefaultBranding(DEFAULT_BRANDING);
import './styles/index.css';

registerServiceWorker();
requestPersistentStorage();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ThemeProvider theme={theme}>
      <CssBaseline />
      <App />
    </ThemeProvider>
  </StrictMode>
);

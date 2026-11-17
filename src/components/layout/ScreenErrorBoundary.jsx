import { Component } from 'react';
import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import { tr as t } from '../../i18n/translate.js';

/**
 * Keeps one broken screen from blanking the whole app: shows a message with
 * Reload / Go to Home while the header and navigation keep working.
 * Your saved bills are not affected.
 */
export default class ScreenErrorBoundary extends Component {
  constructor(props) {
    super(props);
    this.state = { error: null };
  }

  static getDerivedStateFromError(error) {
    return { error };
  }

  componentDidCatch(error, info) {
    console.error('Screen crashed.', error, info?.componentStack);
  }

  componentDidUpdate(previous) {
    // Navigating to another screen clears the error.
    if (previous.resetKey !== this.props.resetKey && this.state.error) this.setState({ error: null });
  }

  render() {
    if (!this.state.error) return this.props.children;
    return (
      <Alert severity="error" sx={{ my: 2 }}>
        <AlertTitle>{t('Something went wrong on this screen.')}</AlertTitle>
        {t('Your bills are safe. Reload the app, or go to Home.')}
        <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
          <Button variant="contained" color="error" size="small" onClick={() => window.location.reload()}>{t('Reload')}</Button>
          <Button size="small" color="inherit" onClick={this.props.onGoHome}>{t('Go to Home')}</Button>
        </Stack>
      </Alert>
    );
  }
}

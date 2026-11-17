import { createContext, useCallback, useContext, useMemo, useRef, useState } from 'react';
import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogContentText from '@mui/material/DialogContentText';
import DialogTitle from '@mui/material/DialogTitle';
import Snackbar from '@mui/material/Snackbar';

const FeedbackContext = createContext(null);

/**
 * App-wide toast messages and confirmation dialogs.
 * Use `useNotify()` and `useConfirm()` instead of alert()/confirm().
 */
export function FeedbackProvider({ children }) {
  const [toast, setToast] = useState(null);
  const [confirmation, setConfirmation] = useState(null);
  const resolver = useRef(null);

  /** @param {{ label: string, onClick: () => void }} [action] optional button, e.g. Undo */
  const notify = useCallback((message, severity = 'success', action) => {
    if (message) setToast({ message, severity, action, key: Date.now() });
  }, []);

  const confirm = useCallback((options) => new Promise((resolve) => {
    resolver.current = resolve;
    setConfirmation(options);
  }), []);

  const close = (result) => {
    resolver.current?.(result);
    resolver.current = null;
    setConfirmation(null);
  };

  const value = useMemo(() => ({ notify, confirm }), [notify, confirm]);

  return (
    <FeedbackContext.Provider value={value}>
      {children}
      <Snackbar
        key={toast?.key}
        open={Boolean(toast)}
        autoHideDuration={toast?.action ? 6000 : 3500}
        onClose={(_event, reason) => { if (reason !== 'clickaway') setToast(null); }}
        className="no-print"
        // Sit above the bottom navigation and the BottomActionBar.
        sx={{ bottom: { xs: 'calc(148px + env(safe-area-inset-bottom))', md: 100 } }}
      >
        {toast ? (
          <Alert
            severity={toast.severity}
            variant="filled"
            onClose={() => setToast(null)}
            sx={{ width: '100%', alignItems: 'center' }}
            action={toast.action ? (
              <Button
                color="inherit"
                size="small"
                sx={{ fontWeight: 700 }}
                onClick={() => {
                  toast.action.onClick();
                  setToast(null);
                }}
              >
                {toast.action.label}
              </Button>
            ) : undefined}
          >
            {toast.message}
          </Alert>
        ) : undefined}
      </Snackbar>
      <Dialog open={Boolean(confirmation)} onClose={() => close(false)} maxWidth="xs" fullWidth className="no-print">
        {confirmation && (
          <>
            <DialogTitle>{confirmation.title}</DialogTitle>
            {confirmation.message && (
              <DialogContent><DialogContentText>{confirmation.message}</DialogContentText></DialogContent>
            )}
            <DialogActions>
              <Button onClick={() => close(false)}>Cancel</Button>
              <Button
                variant="contained"
                color={confirmation.danger ? 'error' : 'primary'}
                onClick={() => close(true)}
                autoFocus
              >
                {confirmation.confirmLabel || 'OK'}
              </Button>
            </DialogActions>
          </>
        )}
      </Dialog>
    </FeedbackContext.Provider>
  );
}

function useFeedback() {
  const context = useContext(FeedbackContext);
  if (!context) throw new Error('Feedback hooks must be used inside <FeedbackProvider>.');
  return context;
}

/** `notify(message, severity?, action?)` shows a short toast, optionally with a button such as Undo. */
export const useNotify = () => useFeedback().notify;

/** `await confirm({ title, message, confirmLabel, danger })` resolves to true when confirmed. */
export const useConfirm = () => useFeedback().confirm;

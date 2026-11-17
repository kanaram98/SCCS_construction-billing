import Dialog from '@mui/material/Dialog';
import DialogActions from '@mui/material/DialogActions';
import DialogContent from '@mui/material/DialogContent';
import DialogTitle from '@mui/material/DialogTitle';
import IconButton from '@mui/material/IconButton';
import CloseIcon from '@mui/icons-material/Close';
import { useIsPhone } from '../../hooks/useIsMobile.js';

/**
 * Dialog that fills the screen on phones and is a centred card elsewhere.
 * Pass `onSubmit` to render the body as a form (Enter submits).
 */
export default function ResponsiveDialog({ open, title, onClose, actions, onSubmit, maxWidth = 'sm', children }) {
  const fullScreen = useIsPhone();
  const formProps = onSubmit ? { component: 'form', onSubmit, noValidate: true } : {};
  return (
    <Dialog
      open={open}
      onClose={onClose}
      fullScreen={fullScreen}
      fullWidth
      maxWidth={maxWidth}
      className="no-print"
      slotProps={{ paper: formProps }}
    >
      <DialogTitle sx={{ pr: 6 }}>
        {title}
        <IconButton aria-label="Close" onClick={onClose} sx={{ position: 'absolute', right: 8, top: 8 }}>
          <CloseIcon />
        </IconButton>
      </DialogTitle>
      <DialogContent dividers>{children}</DialogContent>
      {actions && (
        <DialogActions sx={{ px: 2, py: 1.5, pb: 'calc(12px + env(safe-area-inset-bottom))', flexWrap: 'wrap', gap: 1 }}>
          {actions}
        </DialogActions>
      )}
    </Dialog>
  );
}

import Alert from '@mui/material/Alert';
import AlertTitle from '@mui/material/AlertTitle';
import Box from '@mui/material/Box';
import Paper from '@mui/material/Paper';
import Typography from '@mui/material/Typography';

/** Inline status banner; renders nothing without children. */
export function Notice({ tone = 'info', title, children, sx, className }) {
  if (!children) return null;
  return (
    <Alert severity={tone} sx={{ mb: 2, ...sx }} className={className}>
      {title && <AlertTitle>{title}</AlertTitle>}
      {children}
    </Alert>
  );
}

/** Placeholder for empty lists, with an optional icon and call-to-action. */
export function EmptyState({ icon, title, description, action, compact = false }) {
  return (
    <Paper
      variant="outlined"
      sx={{
        my: 2,
        px: 3,
        py: compact ? 2.5 : 5,
        textAlign: 'center',
        borderStyle: 'dashed',
        bgcolor: 'transparent'
      }}
    >
      {icon && <Box sx={{ color: 'text.secondary', mb: 1, '& svg': { fontSize: 40 } }}>{icon}</Box>}
      {title && <Typography variant="subtitle1">{title}</Typography>}
      {description && <Typography variant="body2" color="text.secondary">{description}</Typography>}
      {action && <Box sx={{ mt: 2 }}>{action}</Box>}
    </Paper>
  );
}

/** Bulleted list of messages; renders nothing when empty. */
export function MessageList({ messages }) {
  if (!messages.length) return null;
  return (
    <Box component="ul" sx={{ m: 0, pl: 2.5 }}>
      {messages.map((message, index) => <li key={`${message}-${index}`}>{message}</li>)}
    </Box>
  );
}

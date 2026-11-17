import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Collapse from '@mui/material/Collapse';
import { MessageList } from './Feedback.jsx';
import { pluralize } from '../../domain/formatters.js';

/** Compact one-line summary of problems, expandable to the full list. */
export default function IssuesAlert({ issues, severity = 'warning', suffix = 'to fix', className, sx }) {
  const [open, setOpen] = useState(false);
  if (!issues.length) return null;
  return (
    <Alert
      severity={severity}
      className={className}
      sx={{ mb: 1.5, ...sx }}
      action={<Button color="inherit" size="small" onClick={() => setOpen((shown) => !shown)}>{open ? 'Hide' : 'Show'}</Button>}
    >
      {issues.length} {pluralize(issues.length, 'issue')} {suffix}
      <Collapse in={open}><Box sx={{ mt: 1 }}><MessageList messages={issues} /></Box></Collapse>
    </Alert>
  );
}

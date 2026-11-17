import { useState } from 'react';
import Alert from '@mui/material/Alert';
import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Collapse from '@mui/material/Collapse';
import { MessageList } from './Feedback.jsx';
import { tr as t, trn } from '../../i18n/translate.js';

/** Compact one-line summary of problems, expandable to the full list. */
export default function IssuesAlert({ issues, severity = 'warning', suffix, className, sx }) {
  const [open, setOpen] = useState(false);
  if (!issues.length) return null;
  return (
    <Alert
      severity={severity}
      className={className}
      sx={{ mb: 1.5, ...sx }}
      action={<Button color="inherit" size="small" onClick={() => setOpen((shown) => !shown)}>{open ? t('Hide') : t('Show')}</Button>}
    >
      {trn(issues.length, '{count} issue', '{count} issues')} {suffix || t('to fix')}
      <Collapse in={open}><Box sx={{ mt: 1 }}><MessageList messages={issues} /></Box></Collapse>
    </Alert>
  );
}

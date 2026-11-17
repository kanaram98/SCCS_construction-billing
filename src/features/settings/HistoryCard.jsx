import { useState } from 'react';
import Button from '@mui/material/Button';
import HistoryIcon from '@mui/icons-material/History';
import { Card } from '../../components/ui';
import { tr as t } from '../../i18n/translate.js';
import HistoryDialog from '../history/HistoryDialog.jsx';

/** Opens History (undo any change) and the recycle bin. */
export default function HistoryCard() {
  const [open, setOpen] = useState(false);
  return (
    <Card title={t('History & recycle bin')} description={t('See every change to bills, rates, clients and settings, undo mistakes, and restore deleted items.')}>
      <Button variant="outlined" startIcon={<HistoryIcon />} onClick={() => setOpen(true)}>{t('Open history')}</Button>
      <HistoryDialog open={open} onClose={() => setOpen(false)} />
    </Card>
  );
}

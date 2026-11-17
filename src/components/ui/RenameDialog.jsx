import { useState } from 'react';
import Button from '@mui/material/Button';
import ResponsiveDialog from './ResponsiveDialog.jsx';
import { TextField } from './FormFields.jsx';
import { tr as t } from '../../i18n/translate.js';

/** Small dialog to rename something; saves on Enter. */
export default function RenameDialog({ open, title, label, value, onSave, onClose }) {
  return (
    <ResponsiveDialog open={open} title={title} onClose={onClose} maxWidth="xs">
      {open && <RenameForm label={label} initial={value} onSave={onSave} onClose={onClose} />}
    </ResponsiveDialog>
  );
}

function RenameForm({ label, initial, onSave, onClose }) {
  const [name, setName] = useState(initial || '');
  function save(event) {
    event.preventDefault();
    if (!name.trim()) return;
    onSave(name.trim());
    onClose();
  }
  return (
    <form onSubmit={save} style={{ paddingTop: 8 }}>
      <TextField label={label} value={name} onChange={setName} autoFocus slotProps={{ htmlInput: { onFocus: (event) => event.target.select() } }} />
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
        <Button onClick={onClose}>{t('Cancel')}</Button>
        <Button type="submit" variant="contained" disabled={!name.trim()}>{t('Save')}</Button>
      </div>
    </form>
  );
}

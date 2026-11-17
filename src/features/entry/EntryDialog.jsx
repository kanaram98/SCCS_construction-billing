import Alert from '@mui/material/Alert';
import Button from '@mui/material/Button';
import Grid from '@mui/material/Grid';
import Typography from '@mui/material/Typography';
import { MessageList, ResponsiveDialog, useNotify } from '../../components/ui';
import EntryFields from './EntryFields.jsx';
import WorkItemPicker from './WorkItemPicker.jsx';

/**
 * Add/edit entry dialog (full screen on phones). When adding, "Add & next"
 * saves and keeps the dialog open for the next measurement.
 */
export default function EntryDialog({ open, areaName, form, onClose }) {
  const notify = useNotify();
  const { entry, isEditing, availableRates, selectedRate } = form;

  function save(keepOpen) {
    const name = selectedRate?.name;
    if (!form.submit()) return;
    if (keepOpen) notify(`${name} added. Enter the next one.`);
    else onClose();
  }

  return (
    <ResponsiveDialog
      open={open}
      onClose={onClose}
      title={`${isEditing ? 'Edit entry' : 'Add entry'} · ${areaName}`}
      onSubmit={(event) => {
        event.preventDefault();
        save(false);
      }}
      actions={(
        <>
          <Button onClick={onClose}>Cancel</Button>
          {!isEditing && <Button variant="outlined" disabled={!form.canSubmit} onClick={() => save(true)}>Add &amp; next</Button>}
          <Button type="submit" variant="contained" disabled={!form.canSubmit}>{isEditing ? 'Save' : 'Add'}</Button>
        </>
      )}
    >
      <Grid container spacing={2} sx={{ pt: 1 }}>
        <Grid size={12}>
          <WorkItemPicker rates={availableRates} value={entry.rateId} onChange={(rateId) => form.update({ rateId })} />
        </Grid>
        {selectedRate && <EntryFields rate={selectedRate} entry={entry} showErrors={form.showFieldErrors} onChange={form.update} />}
      </Grid>
      {form.visibleErrors.length > 0 && (
        <Alert severity={form.errorsAreAlert ? 'error' : 'warning'} sx={{ mt: 2 }}>
          <MessageList messages={form.visibleErrors} />
        </Alert>
      )}
      {!selectedRate && (
        <Typography variant="body2" color="text.secondary" sx={{ mt: 2 }}>Select a work item to enter measurements.</Typography>
      )}
    </ResponsiveDialog>
  );
}

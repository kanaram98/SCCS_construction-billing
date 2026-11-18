import { useDeferredValue, useMemo, useState } from 'react';
import InputAdornment from '@mui/material/InputAdornment';
import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import ListSubheader from '@mui/material/ListSubheader';
import SearchIcon from '@mui/icons-material/Search';
import { EmptyState, ResponsiveDialog, TextField } from '../../components/ui';
import { useBilling } from '../../state/BillingContext.jsx';
import { SEARCH_TYPES, searchAll } from '../../domain/search.js';
import { tr as t } from '../../i18n/translate.js';

const GROUP_TITLES = { bills: 'Bills', projects: 'Projects', workers: 'Workers', expenses: 'Expenses', advances: 'Advances', rates: 'Rates' };

/** Search bills, projects, clients, workers, expenses, advances and rates in one place. */
export default function GlobalSearch({ open, onClose, onOpenResult }) {
  return (
    <ResponsiveDialog open={open} title={t('Search')} onClose={onClose} maxWidth="sm">
      {open && <SearchBody onClose={onClose} onOpenResult={onOpenResult} />}
    </ResponsiveDialog>
  );
}

function SearchBody({ onClose, onOpenResult }) {
  const { data } = useBilling();
  const [query, setQuery] = useState('');
  const deferred = useDeferredValue(query);
  const groups = useMemo(() => searchAll(data, deferred, { t }), [data, deferred]);
  const types = SEARCH_TYPES.filter((type) => groups[type]);

  return (
    <>
      <TextField
        type="search"
        autoFocus
        value={query}
        onChange={setQuery}
        placeholder={t('Bill number, client, project, worker, note…')}
        slotProps={{
          input: { startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> },
          htmlInput: { 'aria-label': t('Search everything') }
        }}
        sx={{ mb: 1 }}
      />
      {query.trim().length >= 2 && !types.length && <EmptyState title={t('Nothing found')} description={t('Try a bill number, a client or project name, a worker, or a word from a note.')} compact />}
      {types.map((type) => (
        <List key={type} dense subheader={<ListSubheader disableSticky sx={{ lineHeight: 2.2, bgcolor: 'transparent' }}>{`${t(GROUP_TITLES[type])} (${groups[type].total})`}</ListSubheader>}>
          {groups[type].items.map((result) => (
            <ListItemButton key={`${result.type}-${result.id}`} onClick={() => { onClose(); onOpenResult(result); }}>
              <ListItemText primary={result.title} secondary={result.subtitle} slotProps={{ primary: { noWrap: true }, secondary: { noWrap: true } }} />
            </ListItemButton>
          ))}
        </List>
      ))}
    </>
  );
}

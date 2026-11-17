import Checkbox from '@mui/material/Checkbox';
import IconButton from '@mui/material/IconButton';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import ArrowUpwardIcon from '@mui/icons-material/ArrowUpward';
import ArrowDownwardIcon from '@mui/icons-material/ArrowDownward';
import { CollapsibleCard } from '../../components/ui';
import { getPrintDocument } from '../../domain/print-settings.js';

/** Choose which documents to export and reorder them. */
export default function DocumentSelection({ settings, selectedCount, onToggle, onMove }) {
  const { documentOrder } = settings;
  return (
    <CollapsibleCard className="no-print" title="Documents" meta={`${selectedCount} selected`} defaultOpen>
      <List disablePadding>
        {documentOrder.map((documentId, index) => {
          const { label } = getPrintDocument(documentId);
          return (
            <ListItem
              key={documentId}
              disablePadding
              secondaryAction={(
                <Stack direction="row">
                  <IconButton aria-label={`Move ${label} up`} disabled={index === 0} onClick={() => onMove(documentId, -1)}>
                    <ArrowUpwardIcon fontSize="small" />
                  </IconButton>
                  <IconButton aria-label={`Move ${label} down`} disabled={index === documentOrder.length - 1} onClick={() => onMove(documentId, 1)}>
                    <ArrowDownwardIcon fontSize="small" />
                  </IconButton>
                </Stack>
              )}
            >
              <ListItemButton onClick={() => onToggle(documentId)} sx={{ pr: 12 }}>
                <ListItemIcon sx={{ minWidth: 40 }}>
                  <Checkbox edge="start" checked={settings.documents[documentId]} tabIndex={-1} disableRipple slotProps={{ input: { 'aria-label': label } }} />
                </ListItemIcon>
                <ListItemText primary={label} />
              </ListItemButton>
            </ListItem>
          );
        })}
      </List>
    </CollapsibleCard>
  );
}

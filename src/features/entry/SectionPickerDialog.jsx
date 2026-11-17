import List from '@mui/material/List';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemText from '@mui/material/ListItemText';
import Typography from '@mui/material/Typography';
import { ResponsiveDialog } from '../../components/ui';
import { pluralize } from '../../domain/formatters.js';

/** Lets the user choose a target section (excluding the current one). */
export default function SectionPickerDialog({ open, title, description, sections, currentSectionId, onPick, onClose }) {
  const targets = sections.filter((section) => section.id !== currentSectionId);
  return (
    <ResponsiveDialog open={open} title={title} onClose={onClose} maxWidth="xs">
      {description && <Typography variant="body2" color="text.secondary" sx={{ mb: 1 }}>{description}</Typography>}
      <List>
        {targets.map((section) => (
          <ListItemButton key={section.id} onClick={() => onPick(section.id)}>
            <ListItemText
              primary={section.name}
              secondary={`${section.areas.length} ${pluralize(section.areas.length, 'area')}`}
            />
          </ListItemButton>
        ))}
      </List>
    </ResponsiveDialog>
  );
}

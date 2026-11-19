import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Tab from '@mui/material/Tab';
import Tabs from '@mui/material/Tabs';
import AddIcon from '@mui/icons-material/Add';

/** Horizontally scrolling floor (section) chips with an add button at the end. */
export default function FloorBar({ sections, activeId, addLabel, onSelect, onAdd }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1.5, borderBottom: 1, borderColor: 'divider' }}>
      {sections.length > 0 && (
        <Tabs
          value={activeId || false}
          onChange={(_event, id) => onSelect(id)}
          variant="scrollable"
          scrollButtons="auto"
          allowScrollButtonsMobile
          sx={{ flex: 1, minWidth: 0, minHeight: 44, '& .MuiTab-root': { minHeight: 44, textTransform: 'none', fontWeight: 600 } }}
        >
          {sections.map((section) => <Tab key={section.id} value={section.id} label={section.name || '—'} />)}
        </Tabs>
      )}
      {onAdd && (
        <Button size="small" startIcon={<AddIcon />} onClick={onAdd} sx={{ flexShrink: 0, ml: sections.length ? 0 : 'auto' }}>
          {addLabel}
        </Button>
      )}
    </Box>
  );
}

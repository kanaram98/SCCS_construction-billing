import { useState } from 'react';
import Button from '@mui/material/Button';
import Checkbox from '@mui/material/Checkbox';
import FormControlLabel from '@mui/material/FormControlLabel';
import List from '@mui/material/List';
import ListItem from '@mui/material/ListItem';
import ListItemButton from '@mui/material/ListItemButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import { ResponsiveDialog } from '../../components/ui';
import { tr as t, trn } from '../../i18n/translate.js';

/** A titled list of tick boxes with "Select all". */
function Picks({ title, items, chosen, onToggle, onAll, describe }) {
  const all = items.length > 0 && chosen.length === items.length;
  return (
    <>
      <Stack direction="row" sx={{ alignItems: 'center', justifyContent: 'space-between', mt: 1 }}>
        <Typography variant="subtitle2">{title}</Typography>
        <FormControlLabel control={<Checkbox size="small" checked={all} indeterminate={chosen.length > 0 && !all} onChange={() => onAll(!all)} />} label={t('Select all')} sx={{ mr: 0 }} />
      </Stack>
      <List dense disablePadding>
        {items.map((item) => (
          <ListItem key={item.id} disablePadding>
            <ListItemButton onClick={() => onToggle(item.id)} sx={{ minHeight: 48 }}>
              <ListItemIcon sx={{ minWidth: 36 }}>
                <Checkbox edge="start" size="small" checked={chosen.includes(item.id)} tabIndex={-1} disableRipple slotProps={{ input: { 'aria-label': item.name } }} />
              </ListItemIcon>
              <ListItemText primary={item.name} secondary={describe(item)} />
            </ListItemButton>
          </ListItem>
        ))}
      </List>
    </>
  );
}

/**
 * Copy several rooms at once: tick the rooms of this floor, tick the floors they should go to.
 * A room goes into the same-named room of a floor when there is one, otherwise it becomes a new room there.
 */
export default function CopyAreasDialog({ open, section, sections, levelName, sublevelName, onCopy, onClose }) {
  return (
    <ResponsiveDialog open={open} title={t('Copy several {level}s', { level: sublevelName })} onClose={onClose} maxWidth="xs">
      {open && <Body key={section.id} section={section} sections={sections} levelName={levelName} sublevelName={sublevelName} onCopy={onCopy} onClose={onClose} />}
    </ResponsiveDialog>
  );
}

function Body({ section, sections, levelName, sublevelName, onCopy, onClose }) {
  const targets = sections.filter((entry) => entry.id !== section.id);
  const [areaIds, setAreaIds] = useState([]);
  const [targetIds, setTargetIds] = useState([]);
  const toggle = (setter) => (id) => setter((current) => (current.includes(id) ? current.filter((entry) => entry !== id) : [...current, id]));
  return (
    <>
      <Typography variant="body2" color="text.secondary">
        {t('Tick the {level}s of {name} to copy, then the {floor}s they should go to.', { level: sublevelName, name: section.name, floor: levelName.toLowerCase() })}
      </Typography>
      <Picks
        title={t('Copy these')}
        items={section.areas}
        chosen={areaIds}
        onToggle={toggle(setAreaIds)}
        onAll={(on) => setAreaIds(on ? section.areas.map((area) => area.id) : [])}
        describe={(area) => trn(area.items.length, '{count} entry', '{count} entries')}
      />
      <Picks
        title={t('Into these')}
        items={targets}
        chosen={targetIds}
        onToggle={toggle(setTargetIds)}
        onAll={(on) => setTargetIds(on ? targets.map((entry) => entry.id) : [])}
        describe={(entry) => trn(entry.areas.length, '{count} area', '{count} areas')}
      />
      <Stack direction="row" spacing={1} sx={{ justifyContent: 'flex-end', mt: 2 }}>
        <Button onClick={onClose}>{t('Cancel')}</Button>
        <Button variant="contained" disabled={!areaIds.length || !targetIds.length} onClick={() => onCopy(areaIds, targetIds)}>
          {t('Copy')}
        </Button>
      </Stack>
    </>
  );
}

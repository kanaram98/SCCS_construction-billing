import { useState } from 'react';
import IconButton from '@mui/material/IconButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import ListSubheader from '@mui/material/ListSubheader';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import Tooltip from '@mui/material/Tooltip';
import CheckIcon from '@mui/icons-material/Check';

/**
 * Icon button that opens a single-choice menu (e.g. sort order).
 * @param {{ options: Record<string, string>, value: string, onChange: (value: string) => void }} props
 */
export default function ChoiceMenu({ icon, label, title, options, value, onChange }) {
  const [anchor, setAnchor] = useState(null);
  return (
    <>
      <Tooltip title={`${label}: ${options[value]}`}>
        <IconButton aria-label={label} onClick={(event) => setAnchor(event.currentTarget)}>{icon}</IconButton>
      </Tooltip>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)}>
        {title && <ListSubheader sx={{ lineHeight: '36px' }}>{title}</ListSubheader>}
        {Object.entries(options).map(([optionValue, optionLabel]) => (
          <MenuItem
            key={optionValue}
            selected={optionValue === value}
            onClick={() => {
              onChange(optionValue);
              setAnchor(null);
            }}
          >
            <ListItemIcon>{optionValue === value && <CheckIcon fontSize="small" />}</ListItemIcon>
            <ListItemText>{optionLabel}</ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}

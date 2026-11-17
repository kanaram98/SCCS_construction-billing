import { useState } from 'react';
import IconButton from '@mui/material/IconButton';
import ListItemIcon from '@mui/material/ListItemIcon';
import ListItemText from '@mui/material/ListItemText';
import Menu from '@mui/material/Menu';
import MenuItem from '@mui/material/MenuItem';
import MoreVertIcon from '@mui/icons-material/MoreVert';

/**
 * "⋮" overflow menu.
 * @param {{ items: Array<{ label: string, icon?: React.ReactNode, onClick: () => void, danger?: boolean, disabled?: boolean, hidden?: boolean }> }} props
 */
export default function ActionMenu({ label = 'More actions', items, size = 'medium' }) {
  const [anchor, setAnchor] = useState(null);
  const visibleItems = items.filter((item) => !item.hidden);

  return (
    <>
      <IconButton
        aria-label={label}
        size={size}
        onClick={(event) => {
          event.stopPropagation();
          setAnchor(event.currentTarget);
        }}
      >
        <MoreVertIcon fontSize="small" />
      </IconButton>
      <Menu anchorEl={anchor} open={Boolean(anchor)} onClose={() => setAnchor(null)} onClick={(event) => event.stopPropagation()}>
        {visibleItems.map((item) => (
          <MenuItem
            key={item.label}
            disabled={item.disabled}
            sx={item.danger ? { color: 'error.main' } : undefined}
            onClick={() => {
              setAnchor(null);
              item.onClick();
            }}
          >
            {item.icon && <ListItemIcon sx={item.danger ? { color: 'error.main' } : undefined}>{item.icon}</ListItemIcon>}
            <ListItemText>{item.label}</ListItemText>
          </MenuItem>
        ))}
      </Menu>
    </>
  );
}

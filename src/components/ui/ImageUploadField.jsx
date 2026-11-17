import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Paper from '@mui/material/Paper';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import DeleteIcon from '@mui/icons-material/DeleteOutlined';
import ImageIcon from '@mui/icons-material/Image';
import { IMAGE_UPLOAD } from '../../config/app.js';

/**
 * Image picker with preview and remove button. `onSelect` receives the chosen File.
 * @param {{ variant?: 'default'|'signature' }} props `signature` draws ruled lines behind the preview
 */
export default function ImageUploadField({ label, value, onSelect, onRemove, variant = 'default' }) {
  return (
    <Paper variant="outlined" sx={{ p: 1.5, bgcolor: 'action.hover' }}>
      <Stack direction="row" sx={{ mb: 1, alignItems: 'baseline', justifyContent: 'space-between', gap: 1 }}>
        <Typography variant="subtitle2">{label}</Typography>
        <Typography variant="caption" color="text.secondary">PNG or JPG · up to 5 MB</Typography>
      </Stack>
      <Box
        sx={{
          display: 'grid',
          placeItems: 'center',
          height: 110,
          mb: 1,
          overflow: 'hidden',
          border: '1px dashed',
          borderColor: 'divider',
          borderRadius: 2,
          // Always white: previews how the image looks on paper.
          bgcolor: 'white',
          color: 'text.secondary',
          ...(variant === 'signature' && value
            ? { background: 'repeating-linear-gradient(0deg, #fff, #fff 23px, #edf0f3 24px, #fff 25px)' }
            : {})
        }}
      >
        {value
          ? <Box component="img" src={value} alt={`${label} preview`} sx={{ maxWidth: '100%', maxHeight: 100, objectFit: 'contain' }} />
          : <Typography variant="caption">No image selected</Typography>}
      </Box>
      <Stack direction="row" spacing={1}>
        <Button component="label" variant="outlined" size="small" startIcon={<ImageIcon />} sx={{ flex: 1 }}>
          {value ? 'Change' : 'Choose image'}
          <input
            hidden
            type="file"
            accept={IMAGE_UPLOAD.acceptedTypes.join(',')}
            onChange={(event) => {
              const file = event.target.files?.[0];
              event.target.value = '';
              if (file) onSelect(file);
            }}
          />
        </Button>
        <Button color="error" size="small" startIcon={<DeleteIcon />} disabled={!value} onClick={onRemove}>Remove</Button>
      </Stack>
    </Paper>
  );
}

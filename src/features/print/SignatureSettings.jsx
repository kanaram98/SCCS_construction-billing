import Box from '@mui/material/Box';
import Button from '@mui/material/Button';
import Slider from '@mui/material/Slider';
import Stack from '@mui/material/Stack';
import Typography from '@mui/material/Typography';
import RestartAltIcon from '@mui/icons-material/RestartAlt';
import { CollapsibleCard, SelectField } from '../../components/ui';
import { SIGNATURE_MODES, SIGNATURE_WIDTH_RANGE } from '../../domain/print-settings.js';

export default function SignatureSettings({ settings, hasSignature, onChange, onWidthChange, onResetPlacement }) {
  return (
    <CollapsibleCard className="no-print" title="Digital signature">
      <Stack spacing={2}>
        <SelectField label="Show signature on" value={settings.signatureMode} options={SIGNATURE_MODES} onChange={(signatureMode) => onChange({ signatureMode })} />
        <Box sx={{ px: 1 }}>
          <Typography variant="body2" id="signature-width-label" gutterBottom>Signature width · {settings.signatureWidth} mm</Typography>
          <Slider
            aria-labelledby="signature-width-label"
            min={SIGNATURE_WIDTH_RANGE.min}
            max={SIGNATURE_WIDTH_RANGE.max}
            value={Number(settings.signatureWidth)}
            onChange={(_event, value) => onWidthChange(value)}
          />
        </Box>
        {hasSignature ? (
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1} sx={{ alignItems: { sm: 'center' }, justifyContent: 'space-between' }}>
            <Typography variant="body2" color="text.secondary">
              Drag the signature in the preview to position it, or use its corner handle to resize.
            </Typography>
            <Button startIcon={<RestartAltIcon />} onClick={onResetPlacement} sx={{ alignSelf: 'flex-start', flexShrink: 0 }}>Reset placement</Button>
          </Stack>
        ) : (
          <Typography variant="body2" color="text.secondary">Add a signature image in Project → Your firm.</Typography>
        )}
      </Stack>
    </CollapsibleCard>
  );
}

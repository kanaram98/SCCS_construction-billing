import Button from '@mui/material/Button';
import Stack from '@mui/material/Stack';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import Typography from '@mui/material/Typography';
import { useColorScheme } from '@mui/material/styles';
import { useBilling } from '../../state/BillingContext.jsx';
import { ResponsiveDialog } from '../ui';
import { LANGUAGES, getLanguage, tr as t } from '../../i18n/translate.js';

const THEMES = { system: 'Match device', light: 'Light', dark: 'Dark' };
const TEXT_SIZES = { normal: 'Normal', large: 'Large' };

/** One labelled row of big, touch-friendly choice buttons. */
function Choice({ label, value, options, onChange, translateOptions = true }) {
  return (
    <div>
      <Typography variant="subtitle2" sx={{ mb: 1 }}>{label}</Typography>
      <ToggleButtonGroup
        exclusive
        fullWidth
        color="primary"
        value={value}
        onChange={(_event, next) => next && onChange(next)}
        aria-label={label}
      >
        {Object.entries(options).map(([optionValue, optionLabel]) => (
          <ToggleButton key={optionValue} value={optionValue} sx={{ py: 1.25, textTransform: 'none' }}>
            {translateOptions ? t(optionLabel) : optionLabel}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </div>
  );
}

/** App preferences: language, theme, text size, and re-opening the welcome guide. */
export default function AppSettingsDialog({ open, onClose }) {
  const { data, actions } = useBilling();
  const { mode, setMode } = useColorScheme();

  return (
    <ResponsiveDialog
      open={open}
      title={t('App settings')}
      onClose={onClose}
      maxWidth="xs"
      actions={<Button variant="contained" onClick={onClose}>{t('Done')}</Button>}
    >
      <Stack spacing={3} sx={{ pt: 1 }}>
        <Choice label={t('Language')} value={getLanguage()} options={LANGUAGES} translateOptions={false} onChange={actions.preferences.setLanguage} />
        <Choice label={t('Text size')} value={data.preferences?.textSize || 'normal'} options={TEXT_SIZES} onChange={actions.preferences.setTextSize} />
        {mode && <Choice label={t('Theme')} value={mode} options={THEMES} onChange={setMode} />}
        <Button
          variant="outlined"
          onClick={() => {
            actions.data.setOnboarded(false);
            onClose();
          }}
        >
          {t('Show the welcome guide again')}
        </Button>
      </Stack>
    </ResponsiveDialog>
  );
}

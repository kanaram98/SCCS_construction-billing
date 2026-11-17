import { useColorScheme } from '@mui/material/styles';
import BrightnessAutoIcon from '@mui/icons-material/BrightnessAutoOutlined';
import LightModeIcon from '@mui/icons-material/LightModeOutlined';
import DarkModeIcon from '@mui/icons-material/DarkModeOutlined';
import { ChoiceMenu } from '../ui';
import { tr as t } from '../../i18n/translate.js';

const MODES = { system: 'Match device', light: 'Light', dark: 'Dark' };
const ICONS = { system: <BrightnessAutoIcon />, light: <LightModeIcon />, dark: <DarkModeIcon /> };

/** Light / dark / match-device theme picker. MUI remembers the choice on this device. */
export default function ColorModeToggle() {
  const { mode, setMode } = useColorScheme();
  if (!mode) return null; // not resolved yet on first render
  return (
    <ChoiceMenu icon={ICONS[mode]} label={t('Theme')} title={t('Theme')} options={MODES} value={mode} onChange={setMode} />
  );
}

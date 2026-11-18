import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import TranslateIcon from '@mui/icons-material/Translate';
import { tr as t } from '../../i18n/translate.js';

/** Picks the language of the worker PDFs and WhatsApp messages (English or Hindi). */
export default function PdfLanguageToggle({ value, onChange }) {
  return (
    <ToggleButtonGroup
      exclusive
      size="small"
      value={value}
      onChange={(_event, next) => next && onChange(next)}
      aria-label={t('PDF language')}
    >
      <ToggleButton value="en" aria-label={t('PDF in English')} sx={{ px: 1, gap: 0.5, fontWeight: 700 }}>
        <TranslateIcon fontSize="small" />EN
      </ToggleButton>
      <ToggleButton value="hi" aria-label={t('PDF in Hindi')} sx={{ px: 1.25, fontWeight: 700 }}>हिं</ToggleButton>
    </ToggleButtonGroup>
  );
}

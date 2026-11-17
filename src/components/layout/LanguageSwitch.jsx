import TranslateIcon from '@mui/icons-material/Translate';
import { useBilling } from '../../state/BillingContext.jsx';
import { ChoiceMenu } from '../ui';
import { LANGUAGES, getLanguage, tr as t } from '../../i18n/translate.js';

/** English / हिंदी switch in the header. */
export default function LanguageSwitch() {
  const { actions } = useBilling();
  return (
    <ChoiceMenu
      icon={<TranslateIcon />}
      label={t('Language')}
      title={t('Language')}
      options={LANGUAGES}
      value={getLanguage()}
      onChange={actions.preferences.setLanguage}
    />
  );
}

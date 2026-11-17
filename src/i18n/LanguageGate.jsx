import { useEffect } from 'react';
import { useBilling } from '../state/BillingContext.jsx';
import { DEFAULT_LANGUAGE, LANGUAGES, setLanguage } from './translate.js';

/**
 * Applies the saved app language before its children render, and remounts them
 * when it changes so every translated string (including memoised ones) refreshes.
 */
export default function LanguageGate({ children }) {
  const { data } = useBilling();
  const language = LANGUAGES[data.preferences?.language] ? data.preferences.language : DEFAULT_LANGUAGE;
  setLanguage(language);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  return <div key={language} style={{ display: 'contents' }}>{children}</div>;
}

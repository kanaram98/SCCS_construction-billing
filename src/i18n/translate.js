/**
 * Minimal gettext-style translation.
 *
 * Text is written in English in the code and looked up in a dictionary keyed
 * by that English text, falling back to English when a translation is missing:
 *
 *   tr('Add entry')                         → 'एंट्री जोड़ें'
 *   tr('{name} deleted.', { name: 'Tiles' }) → 'Tiles हटाया गया।'
 *
 * `tr` uses the app's current language (set by I18nProvider). Documents use
 * `makeTranslator(language)` so a bill can be printed in a different language.
 */
import hi from './hi.js';

export const LANGUAGES = Object.freeze({ en: 'English', hi: 'हिंदी' });
export const DEFAULT_LANGUAGE = 'en';

const DICTIONARIES = { en: null, hi };

function format(text, params) {
  if (!params) return text;
  return text.replace(/\{(\w+)\}/g, (match, key) => (params[key] ?? match));
}

/** A translate function for a specific language. */
export function makeTranslator(language) {
  const dictionary = DICTIONARIES[language] || null;
  return (text, params) => format((dictionary && dictionary[text]) || text, params);
}

let current = makeTranslator(DEFAULT_LANGUAGE);
let currentLanguage = DEFAULT_LANGUAGE;

/** Sets the app language used by `tr`. */
export function setLanguage(language) {
  currentLanguage = LANGUAGES[language] ? language : DEFAULT_LANGUAGE;
  current = makeTranslator(currentLanguage);
}

export function getLanguage() {
  return currentLanguage;
}

/** Translates into the current app language. */
export function tr(text, params) {
  return current(text, params);
}

/**
 * Count-aware translation: picks the English singular/plural form, then
 * translates it. `{count}` is available in both forms.
 *   trn(3, '{count} entry', '{count} entries') → '3 entries' / '3 एंट्री'
 */
export function trn(count, singular, plural, params) {
  return current(count === 1 ? singular : plural, { count, ...params });
}

/** True when a value (or anything inside it) contains Hindi/Devanagari text. */
export function containsDevanagari(value) {
  return /[ऀ-ॿ]/.test(typeof value === 'string' ? value : JSON.stringify(value ?? ''));
}

/**
 * Builds the rules to deploy: firestore.rules with the owner emails from
 * OWNER_EMAILS (comma-separated) filled in. The emails live only in the
 * untracked .env.production and in the deployed rules, never in git.
 */
const MARKER = '[] /* OWNER_EMAILS */';
const EMAIL = /^[^\s@'"\\]+@[^\s@'"\\]+\.[^\s@'"\\]+$/;

export function parseEmails(value = '') {
  return String(value).split(',').map((email) => email.trim().toLowerCase()).filter(Boolean);
}

export function buildRules(source, emails) {
  if (!source.includes(MARKER)) throw new Error('firestore.rules has no OWNER_EMAILS marker.');
  const bad = emails.find((email) => !EMAIL.test(email));
  if (bad) throw new Error(`Not a valid email in OWNER_EMAILS: ${bad}`);
  const list = emails.map((email) => `'${email}'`).join(', ');
  return source.replace(MARKER, `[${list}] /* OWNER_EMAILS */`);
}

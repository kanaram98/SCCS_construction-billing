import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import { buildRules, parseEmails } from '../../scripts/rules.mjs';

const MARKER = '/* OWNER_EMAILS */';

test('owner emails are put into the rules at deploy time; the committed rules stay empty', () => {
  const source = fs.readFileSync('firestore.rules', 'utf8');
  assert.ok(source.includes(`return [] ${MARKER};`), 'the committed rules have an empty owner list');
  const built = buildRules(source, parseEmails(' Me@Gmail.com, other@x.in ,'));
  assert.ok(built.includes(`return ['me@gmail.com', 'other@x.in'] ${MARKER};`));
  assert.equal(buildRules(source, []), source);
  assert.throws(() => buildRules(source, ["a'b@x.com"]), /valid email/);
  assert.throws(() => buildRules('no marker', []), /marker/);
});

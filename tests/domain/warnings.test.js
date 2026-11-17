import test from 'node:test';
import assert from 'node:assert/strict';
import { dimensionWarning, futureDateWarning, gstinWarning, phoneWarning } from '../../src/domain/warnings.js';

test('GSTIN format', () => {
  assert.equal(gstinWarning(''), '');
  assert.equal(gstinWarning('27ABCDE1234F1Z5'), '');
  assert.equal(gstinWarning('27abcde1234f1z5'), '');
  assert.match(gstinWarning('27ABCDE1234'), /15 characters/);
});

test('phone numbers', () => {
  for (const ok of ['', '9876543210', '+91 98765 43210', '098765-43210', '919876543210']) assert.equal(phoneWarning(ok), '', ok);
  for (const bad of ['12345', '98765432101234', '98765abc10']) assert.match(phoneWarning(bad), /10 digits/, bad);
});

test('future dates and unusually large dimensions', () => {
  assert.equal(futureDateWarning('2026-11-17', '2026-11-17'), '');
  assert.match(futureDateWarning('2026-12-01', '2026-11-17'), /future/);
  assert.equal(dimensionWarning('15.4'), '');
  assert.match(dimensionWarning('450.0'), /Over 300 ft/);
  assert.equal(dimensionWarning('abc'), '');
});

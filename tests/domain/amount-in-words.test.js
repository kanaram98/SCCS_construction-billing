import test from 'node:test';
import assert from 'node:assert/strict';
import { amountInWords, numberToIndianWords } from '../../src/domain/amount-in-words.js';

test('converts numbers using the Indian system', () => {
  const cases = {
    0: 'Zero',
    7: 'Seven',
    15: 'Fifteen',
    40: 'Forty',
    51: 'Fifty-One',
    100: 'One Hundred',
    999: 'Nine Hundred Ninety-Nine',
    1005: 'One Thousand Five',
    19751: 'Nineteen Thousand Seven Hundred Fifty-One',
    100000: 'One Lakh',
    250000: 'Two Lakh Fifty Thousand',
    1234567: 'Twelve Lakh Thirty-Four Thousand Five Hundred Sixty-Seven',
    10000000: 'One Crore',
    1500000000: 'One Hundred Fifty Crore'
  };
  for (const [value, words] of Object.entries(cases)) assert.equal(numberToIndianWords(Number(value)), words, value);
});

test('formats rupees with paise and "Only"', () => {
  assert.equal(amountInWords(19751), 'Rupees Nineteen Thousand Seven Hundred Fifty-One Only');
  assert.equal(amountInWords(250000.5), 'Rupees Two Lakh Fifty Thousand and Fifty Paise Only');
  assert.equal(amountInWords(0), 'Rupees Zero Only');
  assert.equal(amountInWords(-5), 'Rupees Zero Only');
});

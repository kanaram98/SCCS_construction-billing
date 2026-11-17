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

test('Hindi amounts in words', async () => {
  const { amountInWordsFor, numberToHindiWords } = await import('../../src/domain/amount-in-words.js');
  assert.equal(numberToHindiWords(51), 'इक्यावन');
  assert.equal(numberToHindiWords(19751), 'उन्नीस हज़ार सात सौ इक्यावन');
  assert.equal(numberToHindiWords(1234567), 'बारह लाख चौंतीस हज़ार पाँच सौ सड़सठ');
  assert.equal(numberToHindiWords(15000000), 'एक करोड़ पचास लाख');
  assert.equal(amountInWordsFor(13895, 'hi'), 'रुपये तेरह हज़ार आठ सौ पचानबे मात्र');
  assert.equal(amountInWordsFor(250000.5, 'hi'), 'रुपये दो लाख पचास हज़ार और पचास पैसे मात्र');
  assert.equal(amountInWordsFor(13895, 'en'), 'Rupees Thirteen Thousand Eight Hundred Ninety-Five Only');
});

/**
 * Rupee amounts in words using the Indian numbering system
 * (thousand, lakh, crore), as printed on Indian bills:
 *   19751     → "Rupees Nineteen Thousand Seven Hundred Fifty-One Only"
 *   250000.5  → "Rupees Two Lakh Fifty Thousand and Fifty Paise Only"
 */

const ONES = [
  '', 'One', 'Two', 'Three', 'Four', 'Five', 'Six', 'Seven', 'Eight', 'Nine', 'Ten',
  'Eleven', 'Twelve', 'Thirteen', 'Fourteen', 'Fifteen', 'Sixteen', 'Seventeen', 'Eighteen', 'Nineteen'
];
const TENS = ['', '', 'Twenty', 'Thirty', 'Forty', 'Fifty', 'Sixty', 'Seventy', 'Eighty', 'Ninety'];

function belowHundred(n) {
  if (n < 20) return ONES[n];
  const unit = n % 10;
  return `${TENS[Math.floor(n / 10)]}${unit ? `-${ONES[unit]}` : ''}`;
}

function belowThousand(n) {
  const hundreds = Math.floor(n / 100);
  const rest = n % 100;
  return [hundreds ? `${ONES[hundreds]} Hundred` : '', rest ? belowHundred(rest) : ''].filter(Boolean).join(' ');
}

/** Whole number in Indian-system words ("Zero" for 0). */
export function numberToIndianWords(value) {
  let n = Math.floor(Math.abs(Number(value) || 0));
  if (n === 0) return 'Zero';
  const parts = [];
  const crore = Math.floor(n / 1e7);
  n %= 1e7;
  if (crore) parts.push(`${numberToIndianWords(crore)} Crore`);
  const lakh = Math.floor(n / 1e5);
  n %= 1e5;
  if (lakh) parts.push(`${belowHundred(lakh)} Lakh`);
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  if (thousand) parts.push(`${belowHundred(thousand)} Thousand`);
  if (n) parts.push(belowThousand(n));
  return parts.join(' ');
}

/** Rupee amount in words, including paise when present. */
export function amountInWords(value) {
  const amount = Math.max(0, Number(value) || 0);
  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);
  const paisePart = paise ? ` and ${numberToIndianWords(paise)} Paise` : '';
  return `Rupees ${numberToIndianWords(rupees)}${paisePart} Only`;
}

/** Hindi number names 0–99 (irregular, so listed in full). */
const HINDI_0_99 = [
  'शून्य', 'एक', 'दो', 'तीन', 'चार', 'पाँच', 'छह', 'सात', 'आठ', 'नौ',
  'दस', 'ग्यारह', 'बारह', 'तेरह', 'चौदह', 'पंद्रह', 'सोलह', 'सत्रह', 'अठारह', 'उन्नीस',
  'बीस', 'इक्कीस', 'बाईस', 'तेईस', 'चौबीस', 'पच्चीस', 'छब्बीस', 'सत्ताईस', 'अट्ठाईस', 'उनतीस',
  'तीस', 'इकतीस', 'बत्तीस', 'तैंतीस', 'चौंतीस', 'पैंतीस', 'छत्तीस', 'सैंतीस', 'अड़तीस', 'उनतालीस',
  'चालीस', 'इकतालीस', 'बयालीस', 'तैंतालीस', 'चवालीस', 'पैंतालीस', 'छियालीस', 'सैंतालीस', 'अड़तालीस', 'उनचास',
  'पचास', 'इक्यावन', 'बावन', 'तिरपन', 'चौवन', 'पचपन', 'छप्पन', 'सत्तावन', 'अट्ठावन', 'उनसठ',
  'साठ', 'इकसठ', 'बासठ', 'तिरसठ', 'चौंसठ', 'पैंसठ', 'छियासठ', 'सड़सठ', 'अड़सठ', 'उनहत्तर',
  'सत्तर', 'इकहत्तर', 'बहत्तर', 'तिहत्तर', 'चौहत्तर', 'पचहत्तर', 'छिहत्तर', 'सतहत्तर', 'अठहत्तर', 'उन्यासी',
  'अस्सी', 'इक्यासी', 'बयासी', 'तिरासी', 'चौरासी', 'पचासी', 'छियासी', 'सत्तासी', 'अट्ठासी', 'नवासी',
  'नब्बे', 'इक्यानबे', 'बानबे', 'तिरानबे', 'चौरानबे', 'पचानबे', 'छियानबे', 'सत्तानबे', 'अट्ठानबे', 'निन्यानबे'
];

/** Whole number in Hindi words using lakh/crore grouping. */
export function numberToHindiWords(value) {
  let n = Math.floor(Math.abs(Number(value) || 0));
  if (n === 0) return HINDI_0_99[0];
  const parts = [];
  const crore = Math.floor(n / 1e7);
  n %= 1e7;
  if (crore) parts.push(`${numberToHindiWords(crore)} करोड़`);
  const lakh = Math.floor(n / 1e5);
  n %= 1e5;
  if (lakh) parts.push(`${HINDI_0_99[lakh]} लाख`);
  const thousand = Math.floor(n / 1000);
  n %= 1000;
  if (thousand) parts.push(`${HINDI_0_99[thousand]} हज़ार`);
  const hundred = Math.floor(n / 100);
  n %= 100;
  if (hundred) parts.push(`${HINDI_0_99[hundred]} सौ`);
  if (n) parts.push(HINDI_0_99[n]);
  return parts.join(' ');
}

/** Rupee amount in words in the given language ('en' or 'hi'). */
export function amountInWordsFor(value, language = 'en') {
  if (language !== 'hi') return amountInWords(value);
  const amount = Math.max(0, Number(value) || 0);
  const rupees = Math.floor(amount);
  const paise = Math.round((amount - rupees) * 100);
  return `रुपये ${numberToHindiWords(rupees)}${paise ? ` और ${numberToHindiWords(paise)} पैसे` : ''} मात्र`;
}

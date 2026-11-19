/** Indian-grouped rupee amount for the UI, e.g. `₹1,25,000`. */
export function formatCurrency(value) {
  return `₹${Number(value || 0).toLocaleString('en-IN')}`;
}

/** ASCII rupee amount for PDFs, whose built-in fonts cannot render `₹`. */
export function formatCurrencyAscii(value) {
  return `Rs. ${Number(value || 0).toLocaleString('en-IN')}`;
}

/** A quantity the way a measurement sheet writes it: 9.00 rft. A count of nos stays whole. */
export function formatQuantity(value, type) {
  const number = Number(value) || 0;
  return type === 'count' ? String(number) : number.toFixed(2);
}

export function roundTo2(value) {
  return Math.round(value * 100) / 100;
}

export function todayIso() {
  return new Date().toISOString().slice(0, 10);
}

/** Trimmed string for any value, treating null/undefined as empty. */
export function text(value) {
  return String(value ?? '').trim();
}

export function sameText(left, right) {
  return text(left).toLocaleLowerCase() === text(right).toLocaleLowerCase();
}

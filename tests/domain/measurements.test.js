import test from 'node:test';
import assert from 'node:assert/strict';
import {
  addFeetInches, areaSqft, feetInchesError, formatDimension, calculateFeetInches as calculate, feetInchesToMetres, inchesToText, metresToFeetInches, parseFeetInches,
  perimeterFeetInches, sqftToSqm, sqmToSqft, subtractFeetInches, toInches
} from '../../src/domain/measurements.js';
import { getItemQuantity, getLineAmount } from '../../src/domain/calculations.js';
import { formatQuantity } from '../../src/domain/formatters.js';
import { resolveRate } from '../../src/domain/rates.js';
import { validateEntry } from '../../src/domain/validation.js';

test('feet.inches counts whole inches and writes them back', () => {
  assert.equal(toInches('15.4'), 184);
  assert.equal(toInches('15'), 180);
  assert.equal(toInches('15.1'), 181); // one inch, not ten
  assert.equal(toInches('15.10'), 190);
  assert.equal(toInches('15.12'), 0); // invalid inches
  assert.equal(inchesToText(184), '15.4');
  assert.equal(inchesToText(180), '15');
  assert.equal(inchesToText(190), '15.10');
  assert.equal(inchesToText(-5), '0');
});

test('adding and subtracting lengths carries inches into feet', () => {
  assert.equal(addFeetInches("4'10.5\"", '0.1.5'), '5');
  assert.equal(addFeetInches('10', '2.11'), '12.11');
  assert.equal(subtractFeetInches('9.2', '3.6').text, '5.8');
  assert.deepEqual(subtractFeetInches('3', '3.1'), { text: '', negative: true });
  assert.equal(perimeterFeetInches('12', '10.6'), '45'); // 2 × (12 ft + 10 ft 6 in) = 45 ft
});

test('areas and conversions to metric', () => {
  assert.equal(areaSqft('12', '10.6'), 126);
  assert.equal(feetInchesToMetres('10'), 3.048);
  assert.equal(metresToFeetInches(3.048), '10');
  assert.equal(sqftToSqm(100), 9.29);
  assert.equal(sqmToSqft(9.29), 100);
});

test('an entry can be measured its own way: perimeter and wall area', () => {
  const skirting = { id: 'skirting', name: 'Skirting', unit: 'rft', type: 'length', rate: 30 };
  const room = { rateId: 'skirting', count: '1', length: '12', width: '10', height: '9', rate: 30 };
  assert.equal(getItemQuantity(room, resolveRate(room, [skirting])), 12); // follows the work item: length only
  const perimeter = { ...room, calc: 'perimeter' };
  assert.equal(getItemQuantity(perimeter, resolveRate(perimeter, [skirting])), 44); // 2 × (12 + 10)
  assert.equal(getLineAmount(perimeter, resolveRate(perimeter, [skirting])), 1320);
  const walls = { ...room, calc: 'wall' };
  assert.equal(getItemQuantity(walls, resolveRate(walls, [skirting])), 396); // 44 × 9
  assert.equal(getItemQuantity({ ...room, calc: 'nonsense' }, resolveRate({ ...room, calc: 'nonsense' }, [skirting])), 12); // unknown choice is ignored
});

test('an entry measured another way asks for the boxes that way needs', () => {
  const tile = { id: 't', name: 'Tiles', unit: 'sqft', type: 'area', rate: 85 };
  const wall = { ...tile, type: 'wall' };
  assert.equal(validateEntry({ count: '1', length: '12', width: '10', height: '' }, wall).length, 1); // height missing
  assert.equal(validateEntry({ count: '1', length: '12', width: '10', height: '9' }, wall).length, 0);
});

test('the calculator gives lengths, areas and conversions', () => {
  assert.deepEqual(calculate('add', 'ft-m', '5.8', '3.6').text, '9.2');
  assert.ok(calculate('sub', 'ft-m', '3', '4').error);
  assert.equal(calculate('area', 'ft-m', '12', '10.6').area, 126);
  assert.equal(calculate('perimeter', 'ft-m', '12', '10.6').text, '45');
  assert.equal(calculate('convert', 'm-ft', '3.048', '').text, '10');
  assert.ok(calculate('add', 'ft-m', '5.12', '3').error); // 12 inches is not valid
  assert.deepEqual(calculate('add', 'ft-m', '', '').lines, []);
  assert.equal(parseFeetInches('5.6'), 5.5);
  assert.deepEqual(calculate('convert', 'sqm-sqft', '9.29', '').lines, ['9.29 sqm = 100 sqft']);
  assert.deepEqual(calculate('convert', 'sqft-sqm', '100', '').lines, ['100 sqft = 9.29 sqm']);
  assert.deepEqual(calculate('convert', 'ft-m', '10', '').lines, ["10' 0\" = 3.048 m"]);
});

test('running feet: fractions of an inch, marks and decimal feet are all understood', () => {
  assert.equal(parseFeetInches("4'10.5\""), (4 * 12 + 10.5) / 12);
  assert.equal(parseFeetInches("4' 10½\""), (4 * 12 + 10.5) / 12);
  assert.equal(parseFeetInches('4.10.5'), (4 * 12 + 10.5) / 12); // third part is the decimal of the inch
  assert.equal(parseFeetInches("0'6.25\""), 6.25 / 12);
  assert.equal(parseFeetInches("9'"), 9);
  assert.equal(parseFeetInches('27.08ft'), 27.08);
  assert.equal(parseFeetInches('27.08 ft'), 27.08);
  assert.equal(parseFeetInches('15.4'), 15 + 4 / 12); // the old way still means 15 ft 4 in
  assert.ok(feetInchesError("4'12\""));
  assert.ok(feetInchesError("4'1/0\""));
  assert.ok(feetInchesError('4.5.5.5'));
  assert.ok(feetInchesError('abc'));
  assert.equal(feetInchesError("4'10.5\""), null);
  assert.equal(formatDimension("4'10.5\""), "4' 10½\"");
  assert.equal(formatDimension('15.4'), "15' 4\"");
  assert.equal(formatDimension('27.08ft'), '27.08 ft');
  assert.equal(inchesToText(58.5), '4.10.5'); // the calculator gives what can be typed back into the box
  assert.equal(inchesToText(187.25), '15.7.25');
  assert.equal(addFeetInches("4'10.5\"", '0.1.5'), "4'12\"".replace("4'12\"", "5'0\"") === "5'0\"" ? inchesToText(58.5 + 1.5) : '');
});

test('the rows of a running-feet sheet: length × nos', () => {
  const frame = { id: 'f', name: 'Granite Moulding', unit: 'rft', type: 'lenw', rate: 85 };
  const row = (length, count, width = '') => getItemQuantity({ rateId: 'f', count, length, width, rate: 85 }, resolveRate({ rateId: 'f', rate: 85 }, [frame]));
  assert.equal(row('27.08ft', '15', "0'6.50\""), 406.2);
  assert.equal(row('26.58ft', '15', "0'7.25\""), 398.7);
  assert.equal(row("9'0\"", '2', "0'4.5\""), 18);
  assert.equal(row("4'9\"", '1', "0'9.5\""), 4.75);
  assert.equal(row("19'3\"", '2', "0'6.25\""), 38.5);
  assert.equal(row("19'11\"", '4'), 79.67); // the sheet rounds the inches first and shows 79.68
});

test('the civil work rates are in the standard rates and can be added to an existing list', async () => {
  const { CIVIL_LABOUR_RATES, DEFAULT_RATES, missingCivilRates } = await import('../../src/domain/rates.js');
  assert.equal(CIVIL_LABOUR_RATES.length, 13);
  assert.ok(CIVIL_LABOUR_RATES.every((rate) => (rate.unit === 'sqft' && rate.type === 'area') || (rate.unit === 'rft' && rate.type === 'lenw')));
  assert.equal(CIVIL_LABOUR_RATES.find((rate) => rate.name === 'Granite Moulding').rate, 85);
  assert.equal(new Set(DEFAULT_RATES.map((rate) => rate.id)).size, DEFAULT_RATES.length);
  assert.equal(missingCivilRates([]).length, 13);
  assert.equal(missingCivilRates(DEFAULT_RATES).length, 0);
  assert.equal(missingCivilRates([{ name: ' dhar polish ' }]).length, 12); // matched by name, ignoring case
});

test('lengths are written with a space, fractions like the labour sheet, other parts of an inch as a decimal', () => {
  assert.equal(formatDimension("9' 0\""), "9' 0\"");
  assert.equal(formatDimension('0.7'), "0' 7\""); // 0.7 is 0 ft 7 in
  assert.equal(formatDimension('10.10.5'), "10' 10½\""); // a third part is a part of an inch
  assert.equal(parseFeetInches('10.10.5'), (10 * 12 + 10.5) / 12);
  assert.equal(formatDimension("4'10.25\""), "4' 10¼\"");
  assert.equal(formatDimension('4.10.75'), "4' 10¾\"");
  assert.equal(formatDimension("0'4.5\""), "0' 4½\"");
  assert.equal(formatDimension('10.0.5'), "10' ½\"");
  assert.equal(formatDimension("10'4.6\""), "10' 4.6\"");
  assert.equal(formatDimension("10'4.33\""), "10' 4.33\"");
  assert.equal(formatDimension("6'7.07\""), "6' 7.07\"");
  assert.equal(formatDimension('27.08ft'), '27.08 ft');
  // what is printed can be typed back
  for (const text of ["10' 10½\"", "10' 10(1/2)\"", "10'10 ½\"", "0' ½\"", "4' 10½\"", "0' 4½\"", "(1/2)\"".replace('(1/2)', "0'(1/2)")]) assert.equal(feetInchesError(text), null, text);
  assert.equal(parseFeetInches("10' 10½\""), parseFeetInches('10.10.5'));
});

test('running feet: 9 ft 0 in by a width of 0 ft 4.5 in is 9.00 rft, the width is only noted', () => {
  const moulding = { id: 'm', name: 'Granite Moulding', unit: 'rft', type: 'lenw', rate: 85 };
  const item = { rateId: 'm', count: '1', length: "9' 0\"", width: "0' 4.5\"", rate: 85 };
  const rate = resolveRate(item, [moulding]);
  assert.equal(getItemQuantity(item, rate), 9);
  assert.equal(formatQuantity(getItemQuantity(item, rate), rate.type), '9.00');
  assert.equal(getLineAmount(item, rate), 765);
});

test('an entry can also change the unit of its quantity', async () => {
  const { formulaUnit, UNIT_CHOICES } = await import('../../src/domain/rates.js');
  const tiles = { id: 't', name: 'Tiles', unit: 'sqft', type: 'area', rate: 90 };
  const plain = { rateId: 't', count: '1', length: '10', width: '5', rate: 90 };
  assert.equal(resolveRate(plain, [tiles]).unit, 'sqft'); // follows the work item
  const metric = { ...plain, calc: 'perimeter', calcUnit: 'rft' };
  const resolved = resolveRate(metric, [tiles]);
  assert.deepEqual([resolved.type, resolved.unit, resolved.rate], ['perimeter', 'rft', 90]);
  assert.equal(getItemQuantity(metric, resolved), 30);
  assert.equal(resolveRate({ ...plain, calcUnit: 'sqm' }, [tiles]).unit, 'sqft'); // only a quantity entry has a free unit
  assert.equal(resolveRate({ ...plain, calc: 'wall', calcUnit: 'kg' }, [tiles]).unit, 'sqft'); // the unit goes with the way of measuring
  const typed = resolveRate({ ...plain, calc: 'direct', calcUnit: ' bags ', quantity: '12' }, [tiles]);
  assert.deepEqual([typed.type, typed.unit], ['direct', 'bags']); // typed as a quantity: any unit
  assert.equal(getItemQuantity({ ...plain, calc: 'direct', quantity: '12' }, typed), 12);
  assert.equal(resolveRate({ ...plain, calc: 'direct' }, [tiles]).unit, 'sqft'); // no unit typed: the work item's own
  assert.equal(formulaUnit('perimeter'), 'rft');
  assert.equal(formulaUnit('wall'), 'sqft');
  assert.equal(formulaUnit('volume'), 'cft');
  assert.ok(UNIT_CHOICES.includes('sqm') && UNIT_CHOICES.includes('rft'));
});

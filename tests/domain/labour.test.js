import test from 'node:test';
import assert from 'node:assert/strict';
import {
  createLabourState, createWorker, daySummary, daysOfMonth, formatUnits, monthReport, normalizeLabour,
  calendarWeeks, monthPayments, putMark, registerCell, purgeWorker, shiftDate, shiftMonth, workerBalance, workerMonth
} from '../../src/domain/labour.js';
import { hydrateState } from '../../src/domain/app-state.js';

const setMark = (attendance, date, worker, units, now = new Date()) =>
  putMark(attendance, date, worker.id, units === null ? null : { units, wage: worker.dailyWage, at: now.toISOString() });

const ramesh = createWorker({ id: 'w1', name: 'Ramesh', dailyWage: 600 });
const suresh = createWorker({ id: 'w2', name: 'Suresh', dailyWage: 800 });

function sample() {
  let attendance = {};
  attendance = setMark(attendance, '2026-10-30', ramesh, 1);
  attendance = setMark(attendance, '2026-11-01', ramesh, 2);
  attendance = setMark(attendance, '2026-11-02', ramesh, 1.5);
  attendance = setMark(attendance, '2026-11-03', ramesh, 0.5);
  attendance = setMark(attendance, '2026-11-04', ramesh, 0);
  attendance = setMark(attendance, '2026-11-01', suresh, 1);
  return {
    workers: [ramesh, suresh],
    attendance,
    payments: [
      { id: 'p1', workerId: 'w1', date: '2026-10-31', amount: 1000 },
      { id: 'p2', workerId: 'w1', date: '2026-11-02', amount: 500 }
    ]
  };
}

test('attendance is shown as P units', () => {
  assert.deepEqual([0, 0.5, 1, 1.5, 2].map(formatUnits), ['A', '0.5P', '1P', '1.5P', '2P']);
  assert.equal(registerCell(null), '');
  assert.equal(registerCell({ units: 0 }), 'A');
  assert.equal(registerCell({ units: 1.5 }), '1.5');
});

test('a mark saves the wage of that day; clearing removes empty days', () => {
  let attendance = setMark({}, '2026-11-01', ramesh, 2, new Date('2026-11-01T10:00:00Z'));
  assert.deepEqual(attendance['2026-11-01'].w1, { units: 2, wage: 600, at: '2026-11-01T10:00:00.000Z' });
  attendance = setMark(attendance, '2026-11-01', ramesh, null);
  assert.deepEqual(attendance, {});
});

test('day summary counts present workers, P and cost', () => {
  assert.deepEqual(daySummary(sample(), '2026-11-01'), { present: 2, marked: 2, units: 3, cost: 2000 });
});

test('worker month: wages, previous balance, payments and balance', () => {
  const month = workerMonth(sample(), 'w1', '2026-11');
  assert.equal(month.units, 4); // 2 + 1.5 + 0.5 + A
  assert.equal(month.days, 3);
  assert.equal(month.absent, 1);
  assert.equal(month.earned, 2400);
  assert.equal(month.opening, -400); // October: 600 earned − 1000 advance
  assert.equal(month.paid, 500);
  assert.equal(month.balance, 1500);
  assert.equal(month.marks.length, 30);
  assert.equal(month.marks[0].units, 2);
  assert.equal(workerBalance(sample(), 'w1'), 1500);
});

test('a changed wage does not rewrite past attendance', () => {
  const labour = sample();
  labour.workers = [{ ...ramesh, dailyWage: 1000 }, suresh];
  assert.equal(workerMonth(labour, 'w1', '2026-11').earned, 2400);
});

test('month report lists active workers and totals', () => {
  const labour = sample();
  labour.workers.push(createWorker({ id: 'w3', name: 'Old', dailyWage: 500, active: false }));
  const report = monthReport(labour, '2026-11');
  assert.deepEqual(report.rows.map((row) => row.worker.name), ['Ramesh', 'Suresh']);
  assert.equal(report.totals.earned, 3200);
  assert.equal(report.totals.balance, 2300);
});

test('purging a worker removes their attendance and payments', () => {
  const labour = purgeWorker(sample(), 'w1');
  assert.deepEqual(labour.workers.map((worker) => worker.id), ['w2']);
  assert.deepEqual(Object.keys(labour.attendance), ['2026-11-01']);
  assert.equal(labour.payments.length, 0);
});

test('date helpers work across month and year ends', () => {
  assert.equal(shiftDate('2026-12-31', 1), '2027-01-01');
  assert.equal(shiftDate('2026-03-01', -1), '2026-02-28');
  assert.equal(shiftMonth('2026-01', -1), '2025-12');
  assert.equal(daysOfMonth('2028-02').length, 29);
});

test('saved labour data is normalised and old saves get an empty labour book', () => {
  assert.deepEqual(normalizeLabour(null), createLabourState());
  const labour = normalizeLabour({ workers: [{ id: 'w1', name: 'A' }, {}], attendance: { bad: {}, '2026-11-01': { w1: { units: '1.5', wage: '600' }, w2: { units: -1 } } } });
  assert.equal(labour.workers.length, 1);
  assert.deepEqual(labour.attendance, { '2026-11-01': { w1: { units: 1.5, wage: 600, at: '' } } });
  assert.deepEqual([labour.workers[0].version, labour.workers[0].deletedAt], [1, null]);
  const state = hydrateState({ bills: [{ id: 'b1', sections: [] }] });
  assert.deepEqual(state.labour, createLabourState());
});

test('month summary counts each kind of mark', () => {
  const month = workerMonth(sample(), 'w1', '2026-11');
  assert.deepEqual(month.counts, { 0: 1, 0.5: 1, 1.5: 1, 2: 1 });
  const report = monthReport(sample(), '2026-11');
  assert.deepEqual(report.totals.counts, { 0: 1, 0.5: 1, 1: 1, 1.5: 1, 2: 1 });
  assert.equal(report.totals.days, 4);
});

test('payments keep their mode; month payments list every worker by date', () => {
  const labour = normalizeLabour({ ...sample(), payments: [...sample().payments, { id: 'p3', workerId: 'w2', date: '2026-11-01', amount: 200, mode: 'upi', note: 'Tea' }] });
  assert.equal(labour.payments[0].mode, 'cash'); // older payments default to cash
  assert.deepEqual(monthPayments(labour, '2026-11').map((payment) => [payment.date, payment.workerName, payment.mode]), [['2026-11-01', 'Suresh', 'upi'], ['2026-11-02', 'Ramesh', 'cash']]);
  assert.equal(monthReport(labour, '2026-11').payments.length, 2);
});

test('calendar weeks start on Sunday with blanks', () => {
  const weeks = calendarWeeks('2026-11'); // 1 Nov 2026 is a Sunday
  assert.equal(weeks[0][0], '2026-11-01');
  assert.equal(weeks.length, 5);
  assert.deepEqual(weeks[4].slice(0, 2), ['2026-11-29', '2026-11-30']);
  assert.equal(weeks[4][2], null);
});

test('a project view keeps its own and unassigned marks and hides other projects, and flags workers marked elsewhere', async () => {
  const { labourForSite, markedElsewhere, daySummary } = await import('../../src/domain/labour.js');
  const labour = {
    workers: [],
    attendance: {
      '2026-11-02': {
        w1: { units: 1, wage: 500, at: 'a', projectId: 'pa' },
        w2: { units: 2, wage: 500, at: 'a', projectId: 'pb' },
        w3: { units: 1, wage: 500, at: 'a' }
      },
      '2026-11-03': { w2: { units: 1, wage: 500, at: 'a', projectId: 'pb' } }
    }
  };
  const alpha = labourForSite(labour, 'pa');
  assert.deepEqual(Object.keys(alpha.attendance['2026-11-02']).sort(), ['w1', 'w3']);
  assert.equal(alpha.attendance['2026-11-03'], undefined);
  assert.equal(daySummary(alpha, '2026-11-02').cost, 1000);
  assert.equal(labourForSite(labour, ''), labour);
  assert.equal(markedElsewhere(labour, '2026-11-02', 'w2', 'pa'), 'pb');
  assert.equal(markedElsewhere(labour, '2026-11-02', 'w1', 'pa'), '');
  assert.equal(markedElsewhere(labour, '2026-11-02', 'w3', 'pa'), '');
});

import test from 'node:test';
import assert from 'node:assert/strict';
import {
  attachToSeries, laterBillOf, billStatus, canMoveToDraft, canTakePayment, cancelBill, deleteBlocker, hasMoney, isCounted, isEntryLocked,
  isFrozen, isNumberLocked, lockedFields, lockState, readyBlockers, reopenSubmitted, restoreCancelled, seriesBlocker, submitBill, withStatus
} from '../../src/domain/bill-guard.js';
import { backToDraft, markReady } from '../../src/domain/bill-final.js';
import { getDashboardSummary } from '../../src/domain/dashboard.js';
import { advanceRemaining } from '../../src/domain/payments.js';
import { DEFAULT_REPORT_SCOPE, billsInScope, stageBreakdown } from '../../src/domain/report-scope.js';

const bill = (extra = {}) => ({
  id: 'b1', number: '1', projectId: 'p1', projectName: 'Home', client: 'Sharma', payments: [], advance: '',
  sections: [{ id: 's', name: 'F', areas: [{ id: 'a', name: 'R', items: [{ id: 'i', rateId: 'r1', rate: 100, count: 10 }] }] }],
  discount: '', taxRate: 0, gstEnabled: false, ...extra
});
const paid = { payments: [{ id: 'x', date: '2026-01-01', amount: 100, mode: 'cash', note: '' }] };
const rates = [{ id: 'r1', name: 'Tiles', unit: 'sqft', type: 'count', rate: 100 }];

test('a bill is draft, ready or submitted; older final / settled flags are read the same way', () => {
  assert.equal(billStatus(bill()), 'draft');
  assert.equal(billStatus(bill({ status: 'ready' })), 'ready');
  assert.equal(billStatus(bill({ final: true })), 'ready');
  assert.equal(billStatus(bill({ final: true, settled: true })), 'submitted');
  const migrated = withStatus(bill({ final: true, finalizedAt: '2026-01-02T00:00:00Z' }));
  assert.equal(migrated.status, 'ready');
  assert.equal(migrated.final, undefined);
  assert.equal(migrated.readyAt, '2026-01-02T00:00:00Z');
  assert.deepEqual(withStatus(bill()), bill()); // plain drafts are left exactly as they are
});

test('a bill nothing depends on can be deleted; money, a stage or a running series force a cancel instead', () => {
  assert.equal(deleteBlocker(bill()), '');
  assert.equal(deleteBlocker(bill(paid)), 'money');
  assert.equal(deleteBlocker(bill({ advanceAdjustments: [{ id: 'a', advanceId: 'v', amount: 5, date: '2026-01-01' }] })), 'money');
  assert.equal(deleteBlocker(bill({ raSeriesId: 's' })), 'series');
  assert.equal(deleteBlocker(bill({ status: 'ready' })), 'ready');
  assert.equal(deleteBlocker(bill({ status: 'submitted' })), 'submitted');
  assert.equal(deleteBlocker(bill({ cancelled: true })), 'cancelled');
});

test('stages: ready freezes entries; submitted and cancelled freeze everything; only a ready bill takes payments', () => {
  assert.equal(lockState(bill()), '');
  assert.equal(isEntryLocked(bill({ status: 'ready' })), true);
  assert.equal(isFrozen(bill({ status: 'ready' })), false);
  assert.equal(isFrozen(bill({ status: 'submitted' })), true);
  assert.equal(canTakePayment(bill()), false); // a draft has not gone to the client yet
  assert.equal(canTakePayment(bill({ status: 'ready' })), true);
  assert.equal(canTakePayment(bill({ status: 'submitted' })), false);
  assert.equal(canTakePayment(bill({ status: 'ready', cancelled: true })), false);
  assert.equal(lockState(bill({ status: 'submitted', cancelled: true })), 'cancelled');
  assert.equal(isCounted(bill({ cancelled: true })), false);
});

test('fields that cannot change at each stage', () => {
  const draft = lockedFields(bill({ projectId: '' }));
  assert.ok(draft.includes('date'));
  assert.ok(draft.includes('payments') && draft.includes('advance')); // no payments or advance on a draft
  assert.ok(!draft.includes('discount') && !draft.includes('number'));
  const ready = lockedFields(bill({ status: 'ready' }));
  for (const key of ['discount', 'taxRate', 'gstEnabled', 'clientAddress', 'firstLevelName', 'number', 'quotationId']) assert.ok(ready.includes(key), key);
  assert.ok(!ready.includes('payments') && !ready.includes('advance') && !ready.includes('advanceAdjustments'));
  const submitted = lockedFields(bill({ status: 'submitted' }));
  for (const key of ['payments', 'advance', 'advanceAdjustments', 'footer', 'name']) assert.ok(submitted.includes(key), key);
  assert.ok(isNumberLocked(bill(paid)));
  assert.ok(lockedFields(bill()).includes('client')); // client is fixed once the bill has a project
});

test('mark ready needs entries, and a final quotation when one is attached; an estimate always needs one', () => {
  assert.deepEqual(readyBlockers(bill()), []);
  assert.deepEqual(readyBlockers(bill({ sections: [] })), ['empty']);
  assert.deepEqual(readyBlockers(bill({ quotationId: 'q' }), { status: 'draft' }), ['quotation-draft']);
  assert.deepEqual(readyBlockers(bill({ quotationId: 'q' }), { status: 'final' }), []);
  assert.deepEqual(readyBlockers(bill({ kind: 'estimate' })), ['quotation-missing']);
  assert.deepEqual(readyBlockers(bill({ kind: 'estimate', quotationId: 'q' }), { status: 'final' }), []);
});

test('ready → draft: free for the contractor until money is on the bill, always for the admin (with the reason kept)', () => {
  const ready = markReady(bill(), rates, new Date('2026-03-01T00:00:00Z'), { name: 'SCCS' });
  assert.equal(ready.status, 'ready');
  assert.equal(ready.sections[0].areas[0].items[0].rateId, undefined); // detached from the live rate
  assert.equal(canMoveToDraft(ready), true);
  assert.equal(backToDraft(ready, rates).status, 'draft');
  assert.equal(backToDraft(ready, rates).sections[0].areas[0].items[0].rateId, 'r1');
  const withPayment = { ...ready, ...paid };
  assert.equal(canMoveToDraft(withPayment), false);
  assert.equal(backToDraft(withPayment, rates).status, 'ready'); // refused
  assert.equal(canMoveToDraft(withPayment, { admin: true }), true);
  const back = backToDraft(withPayment, rates, { admin: true, reason: 'client asked for a discount' });
  assert.equal(back.status, 'draft');
  assert.equal(back.audit.at(-1).reason, 'client asked for a discount');
  assert.equal(canMoveToDraft(bill({ status: 'submitted' }), { admin: true }), false);
});

test('submitting closes a ready bill; an unpaid balance needs a reason; only the admin reopens it, back to ready', () => {
  const now = new Date('2026-03-01T10:00:00Z');
  assert.equal(billStatus(submitBill(bill(), { now })), 'draft'); // a draft cannot be submitted
  const ready = bill({ status: 'ready', ...paid });
  const submitted = submitBill(ready, { now });
  assert.equal(submitted.status, 'submitted');
  assert.equal(submitted.audit.at(-1).action, 'submitted');
  assert.equal(submitBill(ready, { reason: 'client pays next month', now }).audit.at(-1).action, 'submitted-unpaid');
  const settled = submitBill(ready, { now, settledOn: '2026-02-27', settlement: { kind: 'discount', amount: 500, reason: 'agreed' } });
  assert.equal(settled.settledOn, '2026-02-27');
  assert.deepEqual(settled.settlement, { kind: 'discount', amount: 500, reason: 'agreed' });
  assert.equal(submitted.settledOn, '2026-03-01'); // today when no date is given
  const reopened = reopenSubmitted(submitted, 'payment entered wrongly', now);
  assert.equal(reopened.status, 'ready');
  assert.equal(reopened.submittedAt, undefined);
  assert.equal(reopened.settledOn, undefined);
  assert.deepEqual(reopened.audit.map((entry) => entry.action), ['submitted', 'reopened']);
});

test('a cancelled bill is kept with its reason, and can be restored', () => {
  const cancelled = cancelBill(bill(paid), '  made by mistake ');
  assert.equal(cancelled.cancelled, true);
  assert.equal(cancelled.cancelReason, 'made by mistake');
  assert.equal(hasMoney(cancelled), true);
  const restored = restoreCancelled(cancelled, 'was right after all');
  assert.equal(restored.cancelled, undefined);
  assert.equal(restored.audit.length, 2);
});

test('draft bills are work in progress: they are not billed money; ready bills are awaiting payment', () => {
  const now = new Date('2026-11-17T10:00:00Z');
  const rate = [{ id: 'r', type: 'count', rate: 1000 }];
  const make = (id, extra) => ({ id, number: id, date: '2026-11-05', client: 'A', sections: [{ areas: [{ items: [{ rateId: 'r', count: 2 }] }] }], ...extra });
  const summary = getDashboardSummary([make('d', { status: 'draft' }), make('r1', { status: 'ready' }), make('s1', { status: 'submitted', payments: [{ date: '2026-11-06', amount: 2000 }] }), make('x', { status: 'ready', cancelled: true })], rate, now);
  assert.equal(summary.billCount, 2);
  assert.equal(summary.totalBilled, 4000);
  assert.equal(summary.draftCount, 1);
  assert.equal(summary.draftValue, 2000);
  assert.equal(summary.awaitingCount, 1);
  assert.equal(summary.awaitingValue, 2000);
  const advance = { id: 'adv', amount: 1000 };
  const adjusted = bill({ id: 'j', advanceAdjustments: [{ id: 'a', advanceId: 'adv', amount: 400, date: '2026-01-01' }] });
  assert.equal(advanceRemaining(advance, [adjusted]), 600);
  assert.equal(advanceRemaining(advance, [cancelBill(adjusted, 'x')]), 1000); // the advance is free again
});

test('report scope: submitted only, submitted + ready, or everything; and every stage is always broken down', () => {
  const rate = [{ id: 'r', type: 'count', rate: 1000 }];
  const make = (id, status, extra) => ({ id, status, number: id, date: '2026-11-05', sections: [{ areas: [{ items: [{ rateId: 'r', count: 1 }] }] }], ...extra });
  const all = [make('s', 'submitted'), make('r', 'ready'), make('d', 'draft'), make('c', 'ready', { cancelled: true }), make('e', 'ready', { kind: 'estimate' })];
  assert.equal(DEFAULT_REPORT_SCOPE, 'submitted');
  assert.deepEqual(billsInScope(all, 'submitted').map((entry) => entry.id), ['s']);
  assert.deepEqual(billsInScope(all, 'ready').map((entry) => entry.id), ['s', 'r']);
  assert.deepEqual(billsInScope(all, 'all').map((entry) => entry.id), ['s', 'r', 'd']);
  const stages = stageBreakdown(all, rate);
  assert.deepEqual([stages.submitted.count, stages.ready.count, stages.draft.count], [1, 1, 1]);
  assert.equal(stages.ready.total, 1000);
});

test('making a bill the next running bill of another: same project only', () => {
  const first = bill({ id: 'f', status: 'ready' });
  const stray = bill({ id: 's', number: '2' });
  assert.equal(seriesBlocker(stray, bill({ id: 'o', projectId: 'p2' })), 'project');
  assert.equal(seriesBlocker(stray, stray), 'same');
  assert.equal(seriesBlocker(stray, bill({ id: 'e', kind: 'estimate' })), 'estimate');
  assert.equal(seriesBlocker(bill({ id: 'x', status: 'ready' }), first), 'locked');
  assert.equal(seriesBlocker(stray, bill({ id: 'd', status: 'draft' })), 'source-state'); // only a ready or submitted bill can be followed
  const r1 = bill({ id: 'a1', status: 'ready', raSeriesId: 'a1', raNumber: 1 });
  const r2 = bill({ id: 'a2', status: 'ready', raSeriesId: 'a1', raNumber: 2 });
  assert.equal(seriesBlocker(stray, r1, [r1, r2]), 'not-latest');
  assert.equal(seriesBlocker(stray, r2, [r1, r2]), '');
  assert.equal(seriesBlocker(bill({ id: 'x', raSeriesId: 'z' }), first), 'series');
  assert.equal(seriesBlocker(stray, bill({ id: 'sub', status: 'submitted' })), ''); // a submitted bill can still be followed
  const result = attachToSeries([first, stray], stray, first);
  assert.equal(result.bill.raSeriesId, 'f');
  assert.equal(result.bill.raNumber, 2);
  assert.deepEqual(result.sourcePatch, { raSeriesId: 'f', raNumber: 1 });
  assert.equal(result.bill.number, '1');
  const ra1 = bill({ id: 'f', status: 'ready', raSeriesId: 'f', raNumber: 1 });
  const ra2 = bill({ id: 'g', status: 'ready', raSeriesId: 'f', raNumber: 2 });
  const third = attachToSeries([ra1, ra2, stray], stray, ra2);
  assert.equal(third.bill.raNumber, 3);
  assert.equal(third.sourcePatch, null);
  assert.equal(attachToSeries([first, stray], stray, bill({ id: 'q', projectId: 'p2' })), null);
  assert.equal(attachToSeries([ra1, ra2, stray], stray, ra1), null); // not the latest of its series
});

test('the last running bill of a series can be deleted (draft or ready, no money); one in the middle cannot', () => {
  const r1 = { id: 'r1', raSeriesId: 's', raNumber: 1, status: 'ready' };
  const r2 = { id: 'r2', raSeriesId: 's', raNumber: 2, status: 'ready' };
  const r3 = { id: 'r3', raSeriesId: 's', raNumber: 3, status: 'draft' };
  const all = [r1, r2, r3];
  assert.equal(deleteBlocker(r3, all), '');
  assert.equal(deleteBlocker(r2, all), 'series');
  assert.equal(deleteBlocker(r2, [r1, r2]), ''); // a ready last bill too
  assert.equal(deleteBlocker(r1, [r1]), 'series'); // the first bill of a series stays
  assert.equal(deleteBlocker({ ...r2, advance: '100' }, [r1, r2]), 'money');
  assert.equal(deleteBlocker({ ...r2, status: 'submitted' }, [r1, r2]), 'submitted');
});

test('a bill with a later running bill is found, so it cannot go back to draft', () => {
  const r1 = bill({ id: 'r1', status: 'ready', raSeriesId: 's', raNumber: 1 });
  const r2 = bill({ id: 'r2', status: 'draft', raSeriesId: 's', raNumber: 2 });
  assert.equal(laterBillOf([r1, r2], r1).id, 'r2');
  assert.equal(laterBillOf([r1, r2], r2), null);
  assert.equal(laterBillOf([r1, { ...r2, cancelled: true }], r1), null); // a cancelled bill does not count
  assert.equal(laterBillOf([bill({ id: 'x' })], bill({ id: 'x' })), null);
});

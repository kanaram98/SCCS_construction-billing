/**
 * A realistic raw state that uses every feature: bills and an estimate with
 * measurements and payments, a running bill, rates, a client, a template, a
 * deleted bill in the recycle bin, history, firm/quotation edits and labour
 * (workers, attendance, payments, a closed month, labour log).
 */
import { createInitialState } from '../../src/domain/app-state.js';
import { createSampleBill } from '../../src/domain/sample-bill.js';
import { createBill } from '../../src/domain/factories.js';
import { liveState, recordChanges } from '../../src/domain/history.js';
import { createWorker } from '../../src/domain/labour.js';
import * as ops from '../../src/domain/labour-ops.js';

const at = (day, minute = 0) => new Date(Date.UTC(2026, 10, day, 9, minute));
const apply = (raw, change, now) => recordChanges(raw, change(liveState(raw)), now);

export function buildSampleState() {
  let raw = createInitialState();
  const sample = { ...createSampleBill('1', raw.rates, { gstEnabled: true }), id: 'bill-1' };
  const estimate = { ...createBill('1'), id: 'est-1', kind: 'estimate', projectName: 'Shop' };
  const running = { ...createBill('2'), id: 'bill-2', raSeriesId: 'bill-1', raNumber: 2 };
  const doomed = { ...createBill('3'), id: 'bill-3', projectName: 'Mistake' };
  raw = apply(raw, (live) => ({ ...live, bills: [sample, estimate, running, doomed], activeBillId: 'bill-1' }), at(1));
  raw = apply(raw, (live) => ({
    ...live,
    bills: live.bills.map((bill) => bill.id === 'bill-1'
      ? { ...bill, client: 'Asha Builders', discount: '100', payments: [{ id: 'pay-1', date: '2026-11-05', amount: 5000, mode: 'upi', note: 'UTR 123' }] }
      : bill)
  }), at(2));
  raw = apply(raw, (live) => ({ ...live, bills: live.bills.filter((bill) => bill.id !== 'bill-3') }), at(3));
  raw = apply(raw, (live) => ({
    ...live,
    clients: [{ id: 'client-1', name: 'Asha Builders', phone: '9876543210', address: 'Pune', gstin: '' }],
    projects: [{ id: 'proj-1', name: 'Villa', clientId: 'client-1', client: 'Asha Builders', address: 'Pune', status: 'running', agreedAmount: '500000', notes: '' }],
    advances: [{ id: 'adv-1', projectId: 'proj-1', date: '2026-11-03', amount: 50000, mode: 'upi', note: 'First advance' }],
    expenses: [{ id: 'exp-1', projectId: 'proj-1', date: '2026-11-04', amount: 250, category: 'food', note: 'Tea and lunch' }],
    templates: [{ id: 'tpl-1', name: 'Bathroom', type: 'area', content: sample.sections[0].areas[0] }],
    firm: { ...live.firm, name: 'SCCS', phone: '12345', upiId: 'sccs@okbank' },
    quotation: { ...live.quotation, clientName: 'Asha Builders' }
  }), at(4));

  let labour = raw.labour;
  const ramesh = createWorker({ id: 'w1', name: 'Ramesh', dailyWage: 700, role: 'Mason' }, at(1));
  labour = ops.addWorker(labour, ramesh, at(1));
  labour = ops.markAttendance(labour, '2026-10-30', [{ worker: ramesh, units: 1 }], at(1));
  labour = ops.markAttendance(labour, '2026-11-02', [{ worker: ramesh, units: 2 }], at(2));
  labour = ops.markAttendance(labour, '2026-11-03', [{ worker: ramesh, units: 0 }], at(3));
  labour = ops.addPayment(labour, { workerId: 'w1', date: '2026-11-03', amount: 2000, mode: 'cash', note: 'Advance' }, at(3));
  labour = ops.closeMonth(labour, '2026-10', at(4));
  return { ...raw, labour };
}

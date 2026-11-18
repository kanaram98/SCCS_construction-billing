/**
 * The tables of a project statement, as plain data, so the on-screen preview,
 * the PDF and the Excel (CSV) file all show the same figures.
 * `t` translates labels; `money(n)` formats an amount for the output.
 */
import { billLabel } from '../domain/bill-kinds.js';
import { EXPENSE_CATEGORIES } from '../domain/projects.js';
import { PAYMENT_MODES } from '../domain/payments.js';
import { formatUnits } from '../domain/labour.js';

const row = (cells, bold = false) => ({ cells, bold });

export function statementTables(s, t, money) {
  const summary = [
    ...(s.agreed > 0 ? [row([t('Agreed amount'), money(s.agreed)])] : []),
    row([t('Billed (with tax)'), money(s.billed)]),
    ...(s.tax > 0 ? [row([t('of which tax'), money(s.tax)])] : []),
    row([t('Received on bills'), money(s.paidOnBills)]),
    row([t('Advances from the client'), money(s.advanceTotal)]),
    row([t('Total received'), money(s.received)], true),
    row([s.receivable < 0 ? t('Client paid ahead') : t('Client still owes'), money(Math.abs(s.receivable))], true),
    row([t('Site expenses'), money(s.expenseTotal)]),
    row([t('Labour cost'), money(s.labour.cost)]),
    row([t('Total costs'), money(s.costs)], true),
    row([t('Earning (billed before tax − costs)'), money(s.earning)], true),
    row([t('Cash in hand (received − costs)'), money(s.cash)], true)
  ];
  const tables = [{ title: t('Summary'), head: [t('Item'), t('Amount')], numericFrom: 1, rows: summary }];

  if (s.bills.length) {
    tables.push({
      title: t('Bills'),
      head: [t('Bill'), t('Date'), t('Total'), t('Paid'), t('Balance')],
      numericFrom: 2,
      rows: [
        ...s.bills.map((entry) => row([billLabel(entry.bill, t), entry.date, money(entry.total), money(entry.paid), money(entry.balance)])),
        row([t('Total'), '', money(s.billed), money(s.paidOnBills), money(s.billed - s.paidOnBills)], true)
      ]
    });
  }
  if (s.advances.length) {
    tables.push({
      title: t('Advances from the client'),
      head: [t('Date'), t('Paid by'), t('Note'), t('Amount')],
      numericFrom: 3,
      rows: [
        ...s.advances.map((advance) => row([advance.date, t(PAYMENT_MODES[advance.mode] || advance.mode), advance.note || '', money(advance.amount)])),
        row([t('Total'), '', '', money(s.advanceTotal)], true)
      ]
    });
  }
  if (s.expensesByCategory.length) {
    tables.push({
      title: t('Site expenses'),
      head: [t('Category'), t('Amount')],
      numericFrom: 1,
      rows: [
        ...s.expensesByCategory.map((entry) => row([t(EXPENSE_CATEGORIES[entry.category] || entry.category), money(entry.total)])),
        row([t('Total'), money(s.expenseTotal)], true)
      ]
    });
  }
  if (s.labour.rows.length) {
    tables.push({
      title: t('Labour cost'),
      head: [t('Worker'), t('Days'), t('P units'), t('Cost')],
      numericFrom: 1,
      rows: [
        ...s.labour.rows.map((entry) => row([entry.name || '—', String(entry.days), formatUnits(entry.units), money(entry.cost)])),
        row([t('Total'), '', formatUnits(s.labour.units), money(s.labour.cost)], true)
      ]
    });
  }
  return tables;
}

/** "All time" or "2026-11-01 to 2026-11-30". */
export function periodText(period, t) {
  if (!period.from && !period.to) return t('All time');
  return [period.from || '…', period.to || '…'].join(' – ');
}

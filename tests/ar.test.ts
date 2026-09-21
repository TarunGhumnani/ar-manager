import { describe, expect, it } from 'vitest';
import fixture from './fixtures/sample.json';
import {
  addDays, balanceByDocuments, balanceCheck, bucketFor, customerPositions, dso, dueDate, followUpsDue,
  fyLabel, gstSplit, invoicePositions, mapRows, nextNumber, promiseStatuses, statement, suggestAllocation, openInvoices,
} from '@/lib/ar';

const data = mapRows(fixture as never);
const inv = (no: string) => data.invoices.find((i) => i.invoiceNo === no)!;
const cust = (code: string) => data.customers.find((c) => c.code === code)!;
const pos = (no: string, asOf: string) => invoicePositions(data, asOf).find((p) => p.invoice.invoiceNo === no)!;
const cpos = (code: string, asOf: string) => customerPositions(data, asOf).find((p) => p.customer.code === code)!;

describe('spot checks (Part 1)', () => {
  it('1: BWA/26-27/0001 intra-state GST', () => {
    const i = inv('BWA/26-27/0001');
    expect(gstSplit('Maharashtra', i.taxableValue, 18)).toEqual({ cgst: 675000, sgst: 675000, igst: 0 });
    expect(i.total).toBe(8850000);
    expect(dueDate(i.invoiceDate, cust('C001').creditDays)).toBe('2026-05-05');
    expect(i.dueDate).toBe('2026-05-05');
  });
  it('2: BWA/26-27/0002 inter-state GST', () => {
    const i = inv('BWA/26-27/0002');
    expect(gstSplit('Telangana', i.taxableValue, 18)).toEqual({ cgst: 0, sgst: 0, igst: 6300000 });
    expect(i.total).toBe(41300000);
  });
  it('3: BWA/26-27/0003 as at 31-Aug', () => {
    const p = pos('BWA/26-27/0003', '2026-08-31');
    expect(p.outstanding).toBe(6960000);
    expect(p.status).toBe('Overdue');
    expect(p.isPartPaid).toBe(true);
    expect(p.daysPastDue).toBe(90);
    expect(p.bucket).toBe('61-90');
  });
  it('4: BWA/26-27/0021 across three dates', () => {
    expect(pos('BWA/26-27/0021', '2026-08-31')).toMatchObject({ status: 'Due', outstanding: 8850000 });
    expect(pos('BWA/26-27/0021', '2026-09-06')).toMatchObject({ status: 'Overdue', daysPastDue: 2, outstanding: 8850000 });
    expect(pos('BWA/26-27/0021', '2026-09-15')).toMatchObject({ status: 'Paid', outstanding: 0 });
  });
  it('5: C005 as at 31-Aug', () => {
    expect(cpos('C005', '2026-08-31')).toMatchObject({ outstanding: 18880000, unapplied: 10000000, netBalance: 8880000 });
  });
  it('6: C005 as at 12-Jul is a credit balance', () => {
    expect(cpos('C005', '2026-07-12').netBalance).toBe(-10000000);
  });
  it('7: BWA/26-27/0007 as at 31-Aug', () => {
    const p = pos('BWA/26-27/0007', '2026-08-31');
    expect(p.credited).toBe(2950000);
    expect(p.received).toBe(26250000);
    expect(p.outstanding).toBe(300000);
  });
  it('8: statement C002, 01-Apr to 31-Aug', () => {
    const s = statement(data, cust('C002').id, '2026-04-01', '2026-08-31');
    expect(s.opening).toBe(7080000);
    expect(s.closing).toBe(22300000);
    expect(s.lines).toHaveLength(7);
  });
  it('9: C002 promise of 20-Jul is Broken as at 31-Aug', () => {
    const p = promiseStatuses(data, '2026-08-31').find((x) => x.note.noteDate === '2026-07-20')!;
    expect(p.status).toBe('Broken');
  });
  it('10 + R14: control check is empty for every day from 2026-01-01 to 2026-10-31', () => {
    for (let d = '2026-01-01'; d <= '2026-10-31'; d = addDays(d, 1)) expect(balanceCheck(data, d)).toEqual([]);
  });
});

describe('statements', () => {
  it('closing balance equals balanceByDocuments for every customer and month end', () => {
    for (const c of data.customers) {
      for (const to of ['2026-03-31', '2026-06-30', '2026-08-31', '2026-09-30']) {
        const s = statement(data, c.id, '2026-04-01', to);
        expect(s.closing).toBe(balanceByDocuments(data, c.id, to));
      }
    }
  });
  it('TDS line follows its receipt and is left out when zero', () => {
    const s = statement(data, cust('C006').id, '2026-04-01', '2026-09-30');
    expect(s.lines.some((l) => l.kind === 'TDS')).toBe(false);
  });
});

describe('rules', () => {
  it('bucket boundaries', () => {
    expect([0, 1, 30, 31, 60, 61, 90, 91, 180, 181].map(bucketFor)).toEqual([
      'Not due', '1-30', '1-30', '31-60', '31-60', '61-90', '61-90', '91-180', '91-180', 'Over 180',
    ]);
    expect(bucketFor(-5)).toBe('Not due');
  });
  it('GST rounds halves up', () => {
    expect(gstSplit('Maharashtra', 1, 18)).toEqual({ cgst: 0, sgst: 0, igst: 0 }); // 0.09 paise
    expect(gstSplit('Maharashtra', 25, 18)).toEqual({ cgst: 2, sgst: 2, igst: 0 }); // 2.25 → 2
    expect(gstSplit('Gujarat', 25, 18).igst).toBe(5); // 4.5 → 5
  });
  it('due date crosses months and leap years', () => {
    expect(dueDate('2026-01-31', 30)).toBe('2026-03-02');
    expect(dueDate('2028-02-15', 15)).toBe('2028-03-01');
  });
  it('financial year and next numbers', () => {
    expect(fyLabel('2026-03-31')).toBe('25-26');
    expect(fyLabel('2026-04-01')).toBe('26-27');
    expect(nextNumber('invoice', data, '2026-09-21')).toBe('BWA/26-27/0025');
    expect(nextNumber('creditNote', data, '2026-09-21')).toBe('BWA/CN/26-27/002');
    expect(nextNumber('receipt', data, '2026-09-21')).toBe('RCT/26-27/0018');
    expect(nextNumber('invoice', data, '2027-04-01')).toBe('BWA/27-28/0001');
    expect(nextNumber('invoice', data, '2026-09-21').length).toBeLessThanOrEqual(16);
  });
  it('cancelled invoice is excluded everywhere', () => {
    expect(invoicePositions(data, '2026-09-30').some((p) => p.invoice.invoiceNo === 'BWA/26-27/0014')).toBe(false);
  });
  it('BWA/26-27/0017 is not part-paid as at 31-Aug (allocation date, not receipt date)', () => {
    expect(pos('BWA/26-27/0017', '2026-08-31').isPartPaid).toBe(false);
  });
  it('oldest-first suggestion', () => {
    const open = openInvoices(data, cust('C003').id, '2026-09-21');
    const s = suggestAllocation(open, 20000000);
    expect(open[0].invoice.invoiceNo).toBe('BWA/25-26/0141');
    expect(s.get(open[0].invoice.id)).toBe(open[0].outstanding);
  });
  it('follow-ups and DSO', () => {
    expect(followUpsDue(data, '2026-09-01').map((n) => n.followUpDate)).toEqual(['2026-09-01']);
    expect(dso(data, '2025-01-01')).toBeNull();
    expect(typeof dso(data, '2026-08-31')).toBe('number');
  });
});

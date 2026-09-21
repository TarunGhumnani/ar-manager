import { describe, expect, it } from 'vitest';
import { balance, csvField, fmtDate, money, parseRupees, plain, toCsv } from '@/lib/format';
import { parseAsOf, todayIST } from '@/lib/asof';

describe('format', () => {
  it('money uses Indian grouping', () => {
    expect(money(12345600)).toBe('₹1,23,456.00');
    expect(money(0)).toBe('₹0.00');
  });
  it('balances carry Dr / Cr', () => {
    expect(balance(8880000)).toBe('₹88,800.00 Dr');
    expect(balance(-10000000)).toBe('₹1,00,000.00 Cr');
  });
  it('dates', () => {
    expect(fmtDate('2026-08-31')).toBe('31-Aug-2026');
  });
  it('plain amounts and parsing', () => {
    expect(plain(7080000)).toBe('70800.00');
    expect(parseRupees('1,23,456.50')).toBe(12345650);
    expect(parseRupees('abc')).toBeNull();
    expect(parseRupees('0.1')).toBe(10);
  });
  it('CSV quoting and BOM', () => {
    expect(csvField('a,b')).toBe('"a,b"');
    expect(csvField('say "hi"')).toBe('"say ""hi"""');
    expect(toCsv([['x', 1]]).startsWith('﻿')).toBe(true);
  });
  it('as-at parsing defaults to today in India', () => {
    expect(parseAsOf('2026-08-31')).toBe('2026-08-31');
    expect(parseAsOf('2026-02-30', new Date('2026-09-20T19:00:00Z'))).toBe('2026-09-21'); // 00:30 IST
    expect(todayIST(new Date('2026-09-20T18:00:00Z'))).toBe('2026-09-20'); // 23:30 IST
  });
});

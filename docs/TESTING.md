# Manual release checklist

Run `npm test` first; everything must pass. Then **reset the workspace** (brief §3.2) and on the deployed site:

## Spot checks (as-at date in the header)

| # | Where | Expected |
|---|---|---|
| 1 | Invoice BWA/26-27/0001 | CGST 6,750 + SGST 6,750, total 88,500, due 05-May-2026 |
| 2 | Invoice BWA/26-27/0002 | IGST 63,000, total 4,13,000 |
| 3 | BWA/26-27/0003 as at 31-Aug-2026 | Outstanding 69,600, Overdue · part-paid, 90 days late, 61–90 |
| 4 | BWA/26-27/0021 at 31-Aug / 06-Sep / 15-Sep | Due 88,500 / Overdue 2 days / Paid |
| 5 | C005 as at 31-Aug-2026 | Outstanding 1,88,800, unapplied 1,00,000, net 88,800 Dr |
| 6 | C005 as at 12-Jul-2026 | Net 1,00,000 Cr |
| 7 | BWA/26-27/0007 as at 31-Aug-2026 | Outstanding 3,000 |
| 8 | Statement C002, 01-Apr to 31-Aug-2026 | Opening 70,800 Dr, closing 2,23,000 Dr, 7 lines |
| 9 | Dashboard as at 31-Aug-2026, Needs attention | C002 promise of 20-Jul is Broken |

## Flows

1. **Part-payment with TDS:** record a payment for C003 of ₹50,000 bank + ₹5,000 TDS, and accept the oldest-first suggestion. Check that the invoice, the customer page, the dashboard and the statement all agree, and that the statement shows a separate "TDS deducted by you" line.
2. **Advance / unapplied credit:** record a payment for a customer with no open invoices. It shows as unapplied credit, and the net balance is Cr. Allocate it from the customer page later.
3. **Over-allocation is caught:** try to allocate more than an invoice's outstanding. You should see a plain-language message, and nothing is saved.
4. **Credit note:** raise one on an invoice with an outstanding balance. The GST split matches the invoice, and a note larger than the outstanding is refused.
5. **Cancel:** an invoice with payments cannot be cancelled (with an explanation). Cancelling a fresh invoice keeps its number, shows it as Cancelled, and leaves it out of totals.
6. **Numbering:** a new invoice previews `BWA/26-27/0025` on fresh data.
7. **Credit limit:** an invoice that pushes a customer over the limit shows a warning but still saves.
8. **Inactive customer:** deactivate C006. It no longer appears in the new-invoice customer list.
9. **Notes:** add a note with a follow-up dated today. It appears under Follow-ups due; mark it done.
10. **Exports:** the invoice CSV, ageing CSV and statement CSV open in Excel with ₹-free plain amounts.
11. **Print:** print the statement. It fits A4, with no navigation or buttons.
12. **Reset** the workspace again when finished.

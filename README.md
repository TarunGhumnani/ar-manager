# AR Manager — Brightwater Advisory

An accounts receivable tool for a services firm: who owes money, how late each payment is, and what to do about it. Built for the Verve Advisory build assignment (brief: [docs/BRIEF.md](docs/BRIEF.md)).

**Stack:** Next.js 16 (App Router, TypeScript), Tailwind CSS, the shared Supabase database via `@supabase/supabase-js`, zod, Vitest, hosted on Vercel.

## What it does

| Area | Where |
|---|---|
| **Overdue at a glance** | `/`: summary figures (outstanding, unapplied credit, net receivable, overdue and its %, DSO, overdue count), ageing by customer with totals and click-through, red overdue list sorted by days late, and "needs attention" (over limit, broken promises, follow-ups due, unapplied credit). Ageing CSV export. |
| **Customer Master** | `/customers`: search, active/inactive filter, sort on every column. Add, edit, deactivate/reactivate. The customer page shows the profile, balance with a one-line ageing breakdown, over-limit warning, invoices, receipts with unapplied credit (and allocate / delete), a notes timeline and quick actions. |
| **Invoices** | `/invoices`: filter by customer, status (incl. Cancelled), disputed and date range, search by number, sort, totals row, CSV export. Create with a preview of the tax split, total, due date, next number and credit-limit warning. The invoice page shows the tax breakdown, allocations (removable), credit notes, notes, and has actions to raise a credit note, set/clear disputed, and cancel. |
| **Record a payment** | `/receipts/new`: bank + TDS (TDS pre-filled at the customer's rate on taxable value), mode and reference; open invoices with an editable oldest-first suggestion and a live "remains unapplied" figure. The receipt is deleted again if its allocations fail. |
| **Statement** | `/statement?customer=…&from=…&to=…`: on screen, print (clean A4) and CSV export. |

Every screen respects the **as-at date** in the header (`?asof=YYYY-MM-DD`, default today in Asia/Kolkata); every link keeps it.

## How it is built

- **All financial calculations live in [`lib/ar/`](lib/ar/)** as plain functions on whole paise (integers). Screens only display what these return.
  - `positions.ts`: `invoicePositions`, `receiptPositions`, `customerPositions`, `balanceByDocuments`, `balanceCheck` (R14 control check), `dso`
  - `statement.ts`: `statement` (R15) · `notes.ts`: `promiseStatuses`, `followUpsDue` (R16)
  - `gst.ts`: `gstSplit`, `creditNoteGst` · `dates.ts`: `dueDate`, `daysBetween` · `numbering.ts`: `fyLabel`, `nextNumber`
  - `allocation.ts`: open invoices oldest first and the allocation suggestion
  - `load.ts` loads all six tables per request and `map.ts` converts rupees to paise once.
- **Supabase is only called from the server** ([`lib/db.ts`](lib/db.ts) is `server-only`). The workspace id never reaches the browser.
- **Writes** are server actions in [`lib/actions/`](lib/actions/): validate (zod / explicit checks), check the business rules with `lib/ar`, write, then revalidate. Database errors are translated into plain language.

## Running it

Create `.env.local`:

```dotenv
SUPABASE_URL=https://jxllwhrinqlzvydzrscs.supabase.co
SUPABASE_ANON_KEY=<anon key from the brief>
AR_WORKSPACE_ID=<your workspace id>
```

```bash
npm install
npm run dev        # http://localhost:3000
```

On Vercel, add the same three environment variables and redeploy.

## Tests

```bash
npm test
```

The tests run offline against `tests/fixtures/sample.json`. They cover all 10 spot checks, `balanceCheck` being empty **for every day from 2026-01-01 to 2026-10-31**, every statement's closing balance against `balanceByDocuments`, bucket boundaries, GST rounding, due dates, numbering, and the formatting / CSV / as-at helpers.

To refresh the fixture, reset the workspace and run:

```bash
node --env-file=.env.local scripts/snapshot.ts
```

The manual release checklist is in [docs/TESTING.md](docs/TESTING.md).

## Assumptions

- **Allocation limits use all records, not only those up to the as-at date.** When recording a payment or allocating credit, "outstanding" means what is outstanding across all time, so a back-dated allocation can never over-allocate an invoice that later payments settle.
- **The credit-limit warning on a new invoice** compares the customer's current net balance (all records) plus the new invoice total with the credit limit.
- **Open invoices offered for a payment** are those dated on or before the receipt date (an allocation cannot pre-date its invoice).
- **Credit notes take the invoice's split:** IGST if the invoice was IGST, otherwise CGST + SGST, at the invoice's rate.
- **The TDS pre-fill** is the customer's rate on the taxable value of the invoices the bank amount clears in full, oldest first (pro-rated for part-paid invoices). The user always enters what was actually deducted.
- **"Limit used %"** is net balance ÷ credit limit, and shows "—" when the limit is zero.
- **Statement default period** is 1 April of the current financial year to the as-at date.
- **Follow-ups due** only include notes that exist as at the date (`note_date ≤ D`), in line with R10.
- **GST rate** defaults to 18%; the create form accepts 0–28%.

## Known gaps

- Forms use server-side validation with redirect-and-message, so a failed form re-renders with the message rather than keeping every typed value (the invoice and payment forms do keep their values in the URL).
- No pagination (the data set is small by design).
- The GSTIN is checked for 15 alphanumeric characters, not for its checksum or state code.

## What I would do next

- Inline field-level error messages with `useActionState`.
- A per-customer printable reminder letter listing overdue invoices.
- End-to-end tests (Playwright) for the payment and credit-note flows.

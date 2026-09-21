import type { ArData } from './types';

const paise = (rupees: number | string | null) => Math.round(Number(rupees ?? 0) * 100);

/* eslint-disable @typescript-eslint/no-explicit-any */
export function mapRows(t: Record<string, any[]>): ArData {
  return {
    customers: t.customers.map((r) => ({
      id: r.id, code: r.code, name: r.name, city: r.city ?? '', state: r.state ?? '',
      contactPerson: r.contact_person ?? '', email: r.email ?? '', phone: r.phone ?? null, gstin: r.gstin ?? null,
      creditDays: Number(r.credit_days), creditLimit: paise(r.credit_limit), tdsRatePct: Number(r.tds_rate_pct ?? 0),
      isActive: !!r.is_active,
    })),
    invoices: t.invoices.map((r) => ({
      id: r.id, invoiceNo: r.invoice_no, customerId: r.customer_id, invoiceDate: r.invoice_date, dueDate: r.due_date,
      description: r.description ?? '', taxableValue: paise(r.taxable_value), gstRatePct: Number(r.gst_rate_pct),
      cgst: paise(r.cgst), sgst: paise(r.sgst), igst: paise(r.igst), total: paise(r.total),
      isCancelled: !!r.is_cancelled, isDisputed: !!r.is_disputed,
    })),
    creditNotes: t.credit_notes.map((r) => ({
      id: r.id, creditNoteNo: r.credit_note_no, invoiceId: r.invoice_id, creditNoteDate: r.credit_note_date,
      taxableValue: paise(r.taxable_value), cgst: paise(r.cgst), sgst: paise(r.sgst), igst: paise(r.igst),
      total: paise(r.total), reason: r.reason ?? '',
    })),
    receipts: t.receipts.map((r) => ({
      id: r.id, receiptNo: r.receipt_no, customerId: r.customer_id, receiptDate: r.receipt_date,
      bankAmount: paise(r.bank_amount), tdsAmount: paise(r.tds_amount), mode: r.mode, reference: r.reference ?? '',
    })),
    allocations: t.allocations.map((r) => ({
      id: r.id, receiptId: r.receipt_id, invoiceId: r.invoice_id, allocationDate: r.allocation_date, amount: paise(r.amount),
    })),
    notes: t.notes.map((r) => ({
      id: r.id, customerId: r.customer_id, invoiceId: r.invoice_id ?? null, noteDate: r.note_date, noteType: r.note_type,
      body: r.body ?? '', followUpDate: r.follow_up_date ?? null, followUpDone: !!r.follow_up_done,
      promiseDate: r.promise_date ?? null, promiseAmount: r.promise_amount === null || r.promise_amount === undefined ? null : paise(r.promise_amount),
    })),
  };
}

import type { Paise } from './types';

export const SELLER_STATE = 'Maharashtra';

export interface GstSplit {
  cgst: Paise;
  sgst: Paise;
  igst: Paise;
}

export function isIntraState(state: string): boolean {
  return state.trim().toLowerCase() === SELLER_STATE.toLowerCase();
}

/** R3: CGST + SGST at half the rate each within Maharashtra, otherwise IGST. Halves round up. */
export function gstSplit(state: string, taxable: Paise, ratePct: number): GstSplit {
  if (isIntraState(state)) {
    const half = Math.round((taxable * ratePct) / 200);
    return { cgst: half, sgst: half, igst: 0 };
  }
  return { cgst: 0, sgst: 0, igst: Math.round((taxable * ratePct) / 100) };
}

/** R7: a credit note uses the invoice's rate and the invoice's split (intra vs inter). */
export function creditNoteGst(invoice: { cgst: Paise; igst: Paise; gstRatePct: number }, taxable: Paise): GstSplit {
  const intra = invoice.igst === 0 && invoice.cgst > 0;
  if (intra) {
    const half = Math.round((taxable * invoice.gstRatePct) / 200);
    return { cgst: half, sgst: half, igst: 0 };
  }
  if (invoice.igst > 0) return { cgst: 0, sgst: 0, igst: Math.round((taxable * invoice.gstRatePct) / 100) };
  return { cgst: 0, sgst: 0, igst: 0 }; // 0% invoice
}
